/**
 * Spine of the submission. Paragraph names must exist in the COBOL source.
 * server/src/check.js fails if a name here is missing from the .cbl file.
 * The Node ledger follows this same order. It does not compile COBOL.
 */
export const PROGRAMS = [
  {
    program: 'CBKINQ01',
    transId: 'INQ1',
    kind: 'CICS COBOL',
    file: 'cobol/CBKINQ01.cbl',
    api: 'GET /api/accounts/:acctNo',
    db2: 'SELECT account joined to customer',
    paragraphs: ['A-MAIN', 'B-SELECT', 'C-REPLY', 'Z-REJECT']
  },
  {
    program: 'CBKXFR01',
    transId: 'XFR1',
    kind: 'CICS COBOL',
    file: 'cobol/CBKXFR01.cbl',
    api: 'POST /api/transfers',
    db2: 'UPDATE two balances, INSERT two ledger rows, one COMMIT',
    paragraphs: ['A-MAIN', 'B-VALIDATE', 'C-READ-FROM', 'D-READ-TO', 'E-APPLY-RULES', 'F-POST', 'G-REPLY', 'Z-REJECT']
  },
  {
    program: 'CBKOPN01',
    transId: 'OPN1',
    kind: 'CICS COBOL',
    file: 'cobol/CBKOPN01.cbl',
    api: 'POST /api/accounts',
    db2: 'INSERT account and the opening ledger row',
    paragraphs: ['A-MAIN', 'B-VALIDATE', 'C-INSERT', 'D-REPLY', 'Z-REJECT']
  },
  {
    program: 'CBKINT01',
    transId: 'batch',
    kind: 'Batch COBOL',
    file: 'cobol/CBKINT01.cbl',
    jcl: 'jcl/EODINT.jcl',
    api: 'POST /api/jobs/EODINT',
    db2: 'Cursor of active accounts, then one COMMIT',
    paragraphs: ['A-MAIN', 'B-OPEN-CURSOR', 'C-FETCH-LOOP', 'D-POST-ONE', 'E-CLOSE', 'F-SUMMARY']
  },
  {
    program: 'CBKSTM01',
    transId: 'batch',
    kind: 'Batch COBOL',
    file: 'cobol/CBKSTM01.cbl',
    jcl: 'jcl/STMTGEN.jcl',
    api: 'POST /api/jobs/STMTGEN',
    db2: 'Read-only extract of customers, accounts, and transactions',
    paragraphs: ['A-MAIN', 'B-READ', 'C-PRINT', 'D-SUMMARY']
  }
];

export const RATES = { SAV: 4, CUR: 0, FD: 6.5 };
export const MINS = { SAV: 1000, CUR: 5000, FD: 10000 };
export const CHANNEL_LIMIT = 1000000;

export const TYPE_NAME = {
  SAV: 'Savings',
  CUR: 'Current',
  FD: 'Fixed deposit'
};
