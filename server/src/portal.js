import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { USERS } from './seed.js';
import { hashPassword, verifyPassword } from './auth.js';
import { nowStamp } from './money.js';
import { randomBytes } from 'crypto';

function publicUser(user) {
  return {
    userId: user.userId,
    name: user.name,
    role: user.role,
    custId: user.custId || '',
    branch: user.branch || '0142'
  };
}

function seedUsers() {
  return USERS.map((user) => ({
    userId: user.userId,
    name: user.name,
    role: user.role,
    custId: user.custId,
    branch: user.branch,
    password: hashPassword(user.password)
  }));
}

function newId(prefix) {
  return prefix + randomBytes(4).toString('hex');
}

/**
 * Channel directory. On z/OS the sign-on would be RACF.
 * MongoDB holds users, the audit, and desk notes. It does not hold balances.
 * If MongoDB is down, the same collections sit in data/portal.json so the viva still runs.
 */
export async function openPortal(dataDir, mongoUri) {
  try {
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000
    });
    await client.connect();
    await client.db().command({ ping: 1 });
    const portal = new MongoPortal(client);
    await portal.init();
    console.log('Portal store: MongoDB collection set users, audit, notes');
    return portal;
  } catch (error) {
    console.log(`Portal store: file (${error.message}). Start MongoDB on 27017 to use the MERN database.`);
    const portal = new FilePortal(dataDir);
    await portal.init();
    return portal;
  }
}

class FilePortal {
  constructor(dir) {
    this.mode = 'file';
    this.file = path.join(dir, 'portal.json');
    this.state = { users: [], audit: [], notes: [] };
  }

  async init() {
    if (fs.existsSync(this.file)) {
      this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    }
    if (!this.state.users?.length) {
      this.state.users = seedUsers();
      this.state.audit = this.state.audit || [];
      this.state.notes = this.state.notes || [];
      this.save();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  async login(userId, password) {
    const user = this.state.users.find((item) => item.userId.toUpperCase() === String(userId || '').toUpperCase());
    if (!user || !verifyPassword(password || '', user.password)) return null;
    return publicUser(user);
  }

  async findByCust(custId) {
    const user = this.state.users.find((item) => item.custId === custId);
    return user ? publicUser(user) : null;
  }

  async addAudit(event) {
    this.state.audit.unshift({
      id: newId('a'),
      ts: nowStamp(),
      ...event
    });
    this.state.audit = this.state.audit.slice(0, 300);
    this.save();
  }

  async listAudit() {
    return this.state.audit.slice(0, 200);
  }

  async addNote(userId, text) {
    this.state.notes.unshift({
      id: newId('n'),
      userId,
      text,
      ts: nowStamp(),
      read: false
    });
    this.state.notes = this.state.notes.slice(0, 300);
    this.save();
  }

  async listNotes(userId) {
    return this.state.notes.filter((note) => note.userId === userId).slice(0, 20);
  }

  async markNotesRead(userId) {
    for (const note of this.state.notes) {
      if (note.userId === userId) note.read = true;
    }
    this.save();
  }
}

class MongoPortal {
  constructor(client) {
    this.mode = 'mongodb';
    this.client = client;
    this.db = client.db('corevista');
  }

  async init() {
    const users = this.db.collection('users');
    await users.createIndex({ userId: 1 }, { unique: true });
    if (await users.countDocuments() === 0) {
      await users.insertMany(seedUsers());
    }
  }

  async login(userId, password) {
    const user = await this.db.collection('users').findOne({
      userId: String(userId || '').toUpperCase()
    });
    if (!user || !verifyPassword(password || '', user.password)) return null;
    return publicUser(user);
  }

  async findByCust(custId) {
    const user = await this.db.collection('users').findOne({ custId });
    return user ? publicUser(user) : null;
  }

  async addAudit(event) {
    await this.db.collection('audit').insertOne({
      id: newId('a'),
      ts: nowStamp(),
      ...event
    });
  }

  async listAudit() {
    return this.db.collection('audit').find({}, { projection: { _id: 0 } }).sort({ ts: -1 }).limit(200).toArray();
  }

  async addNote(userId, text) {
    await this.db.collection('notes').insertOne({
      id: newId('n'),
      userId,
      text,
      ts: nowStamp(),
      read: false
    });
  }

  async listNotes(userId) {
    return this.db.collection('notes')
      .find({ userId }, { projection: { _id: 0 } })
      .sort({ ts: -1 })
      .limit(20)
      .toArray();
  }

  async markNotesRead(userId) {
    await this.db.collection('notes').updateMany({ userId }, { $set: { read: true } });
  }
}
