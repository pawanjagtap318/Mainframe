import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { config } from './config.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
for (const name of ['db2.json', 'portal.json']) {
  const file = path.join(dataDir, name);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Removed ${file}`);
  }
}

try {
  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 1500 });
  await client.connect();
  const db = client.db('corevista');
  await db.collection('users').deleteMany({});
  await db.collection('audit').deleteMany({});
  await db.collection('notes').deleteMany({});
  await client.close();
  console.log('Cleared MongoDB collections users, audit, notes');
} catch {
  console.log('MongoDB was not cleared because it is not running. The file portal is reset.');
}
