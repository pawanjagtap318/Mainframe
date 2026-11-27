import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Ledger } from './ledger.js';
import { buildSeed } from './seed.js';
import { createApp } from './app.js';
import { PROGRAMS } from './programs.js';
import { COLUMNS, TABLE_KEY } from './schema.js';
import { daysBetween, interestPaise, todayISO } from './money.js';
import { CoreError } from './errors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL  ${message}`);
    return;
  }
  console.log(`PASS  ${message}`);
}

function throws(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

const state = buildSeed();
assert(interestPaise(150000, 4, 31) === 50959, 'interest on 1,50,000 at 4% for 31 days is 509.59');
assert(daysBetween('2026-11-01', '2026-11-27') === 26, '27 Nov minus 1 Nov is 26 days');

for (const [table, columns] of Object.entries(COLUMNS)) {
  const row = state[TABLE_KEY[table]][0];
  for (const [name] of columns) {
    assert(Object.prototype.hasOwnProperty.call(row, name), `${table}.${name} exists on the ledger`);
  }
}

const accrual = structuredClone(state);
const { accrue } = await import('./ledger.js');
const first = accrue(accrual, '2026-11-27', { userId: 'EODBATCH' });
assert(first.posted > 0, 'accrual on 27 Nov posts interest');
const second = accrue(accrual, '2026-11-27', { userId: 'EODBATCH' });
assert(second.posted === 0 && second.total === 0, 'a second accrual the same day posts nothing');

for (const program of PROGRAMS) {
  const file = path.join(root, 'mainframe', program.file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.length > 72) {
      failed += 1;
      console.error(`FAIL  ${program.file}:${index + 1} is ${line.length} columns`);
    }
  });
  for (const paragraph of program.paragraphs) {
    assert(text.includes(`${paragraph}.`), `${program.program} has paragraph ${paragraph}`);
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corevista-'));
const ledger = new Ledger(dir);
const teller = { userId: 'EMP0142', role: 'teller', custId: '', name: 'Maya Iyer' };
const operator = { userId: 'OPS1001', role: 'operator', custId: '', name: 'Vikram Patil' };
const customer = { userId: 'CUST1001', role: 'customer', custId: 'CUST1001', name: 'Arun Deshpande' };

const before = ledger.inquire('0142001001', teller).account.BALANCE;
const moved = ledger.transfer({ from: '0142001001', to: '0142002001', amount: '2500' }, teller);
assert(moved.ok && moved.from.BALANCE === before - 2500, 'transfer of 2500 reduces the debit account');
assert(moved.trace.some((line) => line.includes('EXEC SQL COMMIT')), 'transfer trace commits one unit of work');

const snapshot = ledger.inquire('0142001001', teller).account.BALANCE;
const poor = throws(() => ledger.transfer({ from: '0142001001', to: '0142002001', amount: '900000' }, teller));
assert(poor instanceof CoreError && poor.code === 'E05', 'a transfer above the available balance is E05');
assert(ledger.inquire('0142001001', teller).account.BALANCE === snapshot, 'a rejected transfer does not change the balance');

const fd = throws(() => ledger.transfer({ from: '0142001003', to: '0142001001', amount: '1000' }, teller));
assert(fd?.code === 'E03', 'a fixed deposit debit is E03');
const kyc = throws(() => ledger.transfer({ from: '0142006001', to: '0142001001', amount: '500' }, teller));
assert(kyc?.code === 'E04', 'a pending KYC debit is E04');
const frozen = throws(() => ledger.transfer({ from: '0142003002', to: '0142001001', amount: '100' }, teller));
assert(frozen?.code === 'E02', 'a frozen account debit is E02');
const stolen = throws(() => ledger.transfer({ from: '0142002001', to: '0142001001', amount: '100' }, customer));
assert(stolen?.code === 'E08', 'a customer cannot debit another customer');
const ops = throws(() => ledger.transfer({ from: '0142001001', to: '0142001002', amount: '100' }, operator));
assert(ops?.code === 'E08', 'an operator cannot post money');

const nandini = ledger.inquire('0142008002', teller).account.BALANCE;
const edge = throws(() => ledger.transfer({ from: '0142008002', to: '0142001002', amount: (nandini - 4999.99).toFixed(2) }, teller));
assert(edge?.code === 'E05', 'a current account cannot fall below 5000');

const opened = ledger.openAccount({ custId: 'CUST1002', acctType: 'SAV', amount: '2500' }, teller);
assert(opened.account.ACCT_NO === '0142008003', 'the next account number follows the highest number');
assert(opened.account.BALANCE === 2500, 'an opened account holds the opening deposit');

const days = daysBetween('2026-11-01', todayISO());
const job = ledger.runJob('EODINT', operator);
assert(job.job.RETURN_CODE === 0, 'EODINT ends with return code 0');
if (days > 0) assert(job.message.includes('INTEREST') && !job.message.includes('ON 0 ACCOUNTS'), 'EODINT posts interest when days have passed');
const again = ledger.runJob('EODINT', operator);
assert(again.message.includes('ON 0 ACCOUNTS'), 'running EODINT twice on the same day posts no more interest');
const statement = ledger.runJob('STMTGEN', operator);
assert(statement.program === 'CBKSTM01' && statement.spool.at(-1).includes('NO BALANCE'), 'STMTGEN is read only');
const copy = ledger.runJob('DB2COPY', operator);
assert(copy.program === 'DSNUTILB' && copy.job.RETURN_CODE === 0, 'DB2COPY logs utility RC 00');
const blocked = throws(() => ledger.runJob('EODINT', teller));
assert(blocked?.code === 'E08', 'a teller cannot submit JCL');

const fds = ledger.query("SELECT * FROM ACCOUNT WHERE ACCT_TYPE = 'FD'");
assert(fds.count === 2, 'catalog query finds two fixed deposits');
const badSql = throws(() => ledger.query('DROP TABLE ACCOUNT'));
assert(badSql?.code === 'E07', 'the catalog rejects anything that is not a single SELECT');

const seedFile = fs.readFileSync(path.join(root, 'mainframe', 'db2', 'SEED.sql'), 'utf8');
assert(seedFile.includes('0142001001') && seedFile.includes('CUST1006'), 'SEED.sql matches the lab customers and accounts');

const { openPortal } = await import('./portal.js');
const portal = await openPortal(dir, 'mongodb://127.0.0.1:1/corevista');
assert(portal.mode === 'file', 'a closed MongoDB port falls back to the file portal');
const signed = await portal.login('EMP0142', 'Ledger@142');
assert(signed?.role === 'teller', 'Maya can sign on');
const rejected = await portal.login('EMP0142', 'wrong');
assert(rejected === null, 'a bad password is rejected');

const app = createApp({
  ledger,
  portal,
  config: { ... (await import('./config.js')).config, tokenSecret: 'test' }
});
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const login = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'cust1001', password: 'Arun@142' })
  });
  const body = await login.json();
  assert(login.status === 200 && body.user.role === 'customer', 'HTTP sign-on accepts a lowercase user id');
  const denied = await fetch(`${base}/api/jobs`, { headers: { Authorization: `Bearer ${body.token}` } });
  assert(denied.status === 403, 'a customer token cannot list batch jobs');
} finally {
  server.close();
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll CoreVista checks passed');
