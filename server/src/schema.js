/** Column list for the DB2 catalog page. Keys match the JSON ledger and DDL.sql. */
export const COLUMNS = {
  CUSTOMER: [
    ['CUST_ID', 'CHAR(8)', 'Primary key'],
    ['FULL_NAME', 'VARCHAR(60)', 'Customer or pool name'],
    ['PAN_NO', 'CHAR(10)', 'Tax id, fictional in this lab'],
    ['CITY', 'VARCHAR(30)', 'City'],
    ['PHONE', 'CHAR(10)', 'Mobile'],
    ['KYC_STATUS', 'CHAR(1)', 'V verified, P pending'],
    ['OPEN_DATE', 'DATE', 'Relationship start'],
    ['EMAIL', 'VARCHAR(40)', 'Contact mail']
  ],
  ACCOUNT: [
    ['ACCT_NO', 'CHAR(10)', 'Primary key, branch 0142'],
    ['CUST_ID', 'CHAR(8)', 'Foreign key to CUSTOMER'],
    ['ACCT_TYPE', 'CHAR(3)', 'SAV, CUR, or FD'],
    ['BALANCE', 'DECIMAL(15,2)', 'Current ledger balance'],
    ['RATE', 'DECIMAL(5,2)', 'Annual simple rate'],
    ['STATUS', 'CHAR(1)', 'A active, F frozen, C closed'],
    ['BRANCH_CODE', 'CHAR(4)', '0142 Deccan'],
    ['OPEN_DATE', 'DATE', 'Account open date'],
    ['LAST_INT_DATE', 'DATE', 'Last successful accrual date'],
    ['MATURITY_DATE', 'DATE', 'Fixed deposits only']
  ],
  TXN: [
    ['TXN_ID', 'CHAR(12)', 'Primary key'],
    ['ACCT_NO', 'CHAR(10)', 'Foreign key to ACCOUNT'],
    ['TXN_TS', 'TIMESTAMP', 'Posting stamp'],
    ['DR_CR', 'CHAR(1)', 'D debit, C credit'],
    ['AMOUNT', 'DECIMAL(15,2)', 'Always positive'],
    ['BAL_AFTER', 'DECIMAL(15,2)', 'Running balance'],
    ['NARRATIVE', 'VARCHAR(60)', 'Statement text'],
    ['CHANNEL', 'CHAR(4)', 'CICS or JES'],
    ['RELATED_ACCT', 'CHAR(10)', 'Other leg of a transfer'],
    ['PROGRAM_ID', 'CHAR(8)', 'COBOL program that posted the row'],
    ['TELLER_ID', 'CHAR(8)', 'Sign-on or EODBATCH']
  ],
  BATCH_RUN: [
    ['RUN_ID', 'INTEGER', 'Primary key'],
    ['JOB_NAME', 'CHAR(8)', 'EODINT, STMTGEN, DB2COPY'],
    ['JOB_ID', 'CHAR(8)', 'JES job id, for example JOB04821'],
    ['STATUS', 'CHAR(10)', 'COMPLETED'],
    ['RETURN_CODE', 'SMALLINT', '0 means the step succeeded'],
    ['SUBMITTED_AT', 'TIMESTAMP', 'Reader time'],
    ['ENDED_AT', 'TIMESTAMP', 'Output time'],
    ['PROGRAM_ID', 'CHAR(8)', 'COBOL program or DSNUTILB'],
    ['SPOOL', 'CLOB', 'SYSPRINT image']
  ]
};

export const TABLE_KEY = {
  CUSTOMER: 'customer',
  ACCOUNT: 'account',
  TXN: 'txn',
  BATCH_RUN: 'batch_run'
};
