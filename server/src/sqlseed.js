import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { buildSeed } from './seed.js';

function sqlValue(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'number') return Number(value).toFixed(2);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, row, columns) {
  const values = columns.map((column) => sqlValue(row[column]));
  return `INSERT INTO AETHR.${table} (${columns.join(', ')})\nVALUES (${values.join(', ')});`;
}

export function toSeedSql(state) {
  const lines = [];
  lines.push('-- Generated from server/src/seed.js by `npm run sql`.');
  lines.push('-- Do not edit by hand. Regenerate so the load file matches the lab ledger.');
  lines.push('-- Review subsystem DB2P before running this on z/OS.');
  lines.push('');
  const customerCols = ['CUST_ID', 'FULL_NAME', 'PAN_NO', 'CITY', 'PHONE', 'KYC_STATUS', 'OPEN_DATE', 'EMAIL'];
  const accountCols = ['ACCT_NO', 'CUST_ID', 'ACCT_TYPE', 'BALANCE', 'RATE', 'STATUS', 'BRANCH_CODE', 'OPEN_DATE', 'LAST_INT_DATE', 'MATURITY_DATE'];
  const txnCols = ['TXN_ID', 'ACCT_NO', 'TXN_TS', 'DR_CR', 'AMOUNT', 'BAL_AFTER', 'NARRATIVE', 'CHANNEL', 'RELATED_ACCT', 'PROGRAM_ID', 'TELLER_ID'];
  const batchCols = ['RUN_ID', 'JOB_NAME', 'JOB_ID', 'STATUS', 'RETURN_CODE', 'SUBMITTED_AT', 'ENDED_AT', 'PROGRAM_ID', 'SPOOL'];
  for (const row of state.customer) lines.push(insert('CUSTOMER', row, customerCols), '');
  for (const row of state.account) lines.push(insert('ACCOUNT', row, accountCols), '');
  for (const row of state.txn) lines.push(insert('TXN', row, txnCols), '');
  for (const row of state.batch_run) {
    const spool = { ...row, RETURN_CODE: row.RETURN_CODE };
    lines.push(insert('BATCH_RUN', spool, batchCols), '');
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = path.join(root, 'mainframe', 'db2', 'SEED.sql');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toSeedSql(buildSeed()));
  console.log(`Wrote ${out}`);
}
