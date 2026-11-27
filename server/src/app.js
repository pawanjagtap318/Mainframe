import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { PROGRAMS } from './programs.js';
import { CoreError, httpStatus } from './errors.js';
import { requireAuth, requireRole, signToken } from './auth.js';
import { config as defaultConfig } from './config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mainframeRoot = path.join(root, 'mainframe');
const dist = path.join(root, 'client', 'dist');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function safeSource(rel) {
  const requested = path.resolve(mainframeRoot, rel || '');
  const relative = path.relative(mainframeRoot, requested);
  if (!rel || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!['.cbl', '.cpy', '.jcl', '.rexx', '.sql', '.bms', '.txt', '.json'].includes(path.extname(requested).toLowerCase())) {
    return null;
  }
  return requested;
}

function listSources(dir = mainframeRoot, base = mainframeRoot) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSources(full, base));
    else if (safeSource(path.relative(base, full))) files.push(path.relative(base, full).replaceAll('\\', '/'));
  }
  return files.sort();
}

async function remember(portal, req, fields) {
  await portal.addAudit({
    userId: req.user?.userId || fields.userId || '',
    role: req.user?.role || '',
    ...fields
  });
}

export function createApp({ ledger, portal, config = defaultConfig }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', wrap(async (_req, res) => {
    res.json({
      ok: true,
      name: 'CoreVista',
      runtime: config.runtime,
      portalStore: portal.mode,
      ledger: 'db2-model',
      region: 'DB2P',
      branch: '0142'
    });
  }));

  app.post('/api/login', wrap(async (req, res) => {
    const user = await portal.login(req.body.userId, req.body.password);
    if (!user) {
      await portal.addAudit({
        userId: String(req.body.userId || '').toUpperCase(),
        role: '',
        action: 'LOGIN',
        program: 'RACF',
        rc: 'E13',
        detail: 'Sign-on rejected'
      });
      res.status(401).json({ ok: false, code: 'E13', message: 'Sign-on rejected.' });
      return;
    }
    const token = signToken(user, config.tokenSecret);
    await portal.addAudit({
      userId: user.userId,
      role: user.role,
      action: 'LOGIN',
      program: 'RACF',
      rc: '00',
      detail: `${user.name} signed on`
    });
    res.json({ ok: true, token, user });
  }));

  const auth = requireAuth(config.tokenSecret);
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/login') return next();
    return auth(req, res, next);
  });

  app.get('/api/me', (req, res) => {
    res.json({ ok: true, user: req.user });
  });

  app.get('/api/dashboard', wrap(async (req, res) => {
    res.json(ledger.dashboard(req.user));
  }));

  app.get('/api/accounts', wrap(async (req, res) => {
    res.json({ accounts: ledger.listAccounts(req.user) });
  }));

  app.get('/api/accounts/:acctNo', wrap(async (req, res) => {
    const result = ledger.inquire(req.params.acctNo, req.user);
    await remember(portal, req, {
      action: 'INQUIRY',
      program: 'CBKINQ01',
      rc: '00',
      detail: req.params.acctNo
    });
    res.json(result);
  }));

  app.post('/api/transfers', requireRole('teller', 'customer'), wrap(async (req, res) => {
    const result = ledger.transfer(req.body, req.user);
    await remember(portal, req, {
      action: 'TRANSFER',
      program: 'CBKXFR01',
      rc: '00',
      detail: `${result.from.ACCT_NO} -> ${result.to.ACCT_NO} ${result.amount.toFixed(2)}`
    });
    const text = `CBKXFR01 posted ${result.amount.toFixed(2)} from ${result.from.ACCT_NO} to ${result.to.ACCT_NO}.`;
    await portal.addNote(req.user.userId, text);
    const owners = new Set([result.from.CUST_ID, result.to.CUST_ID]);
    for (const custId of owners) {
      const owner = await portal.findByCust(custId);
      if (owner && owner.userId !== req.user.userId) await portal.addNote(owner.userId, text);
    }
    res.json(result);
  }));

  app.get('/api/customers', requireRole('teller', 'operator'), wrap(async (_req, res) => {
    res.json({ customers: ledger.listCustomers() });
  }));

  app.post('/api/accounts', requireRole('teller'), wrap(async (req, res) => {
    const result = ledger.openAccount(req.body, req.user);
    await remember(portal, req, {
      action: 'OPEN',
      program: 'CBKOPN01',
      rc: '00',
      detail: result.account.ACCT_NO
    });
    await portal.addNote(req.user.userId, result.message);
    const owner = await portal.findByCust(result.account.CUST_ID);
    if (owner) await portal.addNote(owner.userId, result.message);
    res.json(result);
  }));

  app.get('/api/jobs', requireRole('operator'), wrap(async (_req, res) => {
    res.json(ledger.listJobs());
  }));

  app.post('/api/jobs/:name', requireRole('operator'), wrap(async (req, res) => {
    const result = ledger.runJob(req.params.name, req.user);
    await remember(portal, req, {
      action: 'JOB',
      program: result.program,
      rc: '00',
      detail: `${result.job.JOB_NAME} ${result.job.JOB_ID}`
    });
    await portal.addNote(req.user.userId, result.message);
    res.json(result);
  }));

  app.get('/api/catalog', requireRole('teller', 'operator'), wrap(async (_req, res) => {
    res.json(ledger.catalog());
  }));

  app.post('/api/catalog/query', requireRole('teller', 'operator'), wrap(async (req, res) => {
    const result = ledger.query(req.body.sql);
    await remember(portal, req, {
      action: 'QUERY',
      program: 'DB2',
      rc: '00',
      detail: result.sql
    });
    res.json(result);
  }));

  app.get('/api/audit', requireRole('operator'), wrap(async (_req, res) => {
    res.json({ events: await portal.listAudit() });
  }));

  app.get('/api/notes', wrap(async (req, res) => {
    res.json({ notes: await portal.listNotes(req.user.userId) });
  }));

  app.post('/api/notes/read', wrap(async (req, res) => {
    await portal.markNotesRead(req.user.userId);
    res.json({ ok: true });
  }));

  app.get('/api/programs', wrap(async (_req, res) => {
    res.json({ programs: PROGRAMS });
  }));

  app.get('/api/sources', wrap(async (_req, res) => {
    res.json({ files: listSources() });
  }));

  app.get('/api/sources/content', wrap(async (req, res) => {
    const file = safeSource(req.query.path);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.status(404).json({ ok: false, message: 'That source member is not in the lab library.' });
      return;
    }
    res.json({
      path: path.relative(mainframeRoot, file).replaceAll('\\', '/'),
      text: fs.readFileSync(file, 'utf8')
    });
  }));

  app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, message: 'That channel route does not exist.' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof CoreError) {
      const fields = {
        action: req.path.includes('transfer') ? 'TRANSFER' : 'REJECT',
        program: error.trace?.[0]?.split(' ')[0] || 'BRIDGE',
        rc: error.code,
        detail: error.message
      };
      portal.addAudit({
        userId: req.user?.userId || '',
        role: req.user?.role || '',
        ...fields
      }).catch((auditError) => {
        console.error('Failed to record rejected request audit event', auditError);
      });
      res.status(httpStatus(error.code)).json({
        ok: false,
        code: error.code,
        message: error.message,
        trace: error.trace || []
      });
      return;
    }
    console.error(error);
    res.status(500).json({ ok: false, message: 'The bridge failed. See the server log.' });
  });

  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('html').send(`<!doctype html><title>CoreVista</title><body style="font-family:Segoe UI,sans-serif;padding:32px">
        <h1>CoreVista API is running</h1>
        <p>The React desk is not built yet. From the project folder run <code>npm run build --prefix client</code> and start the server again.</p>
        <p>Health: <a href="/api/health">/api/health</a></p>
      </body>`);
    });
  }

  return app;
}
