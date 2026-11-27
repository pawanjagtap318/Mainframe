import fs from 'fs';
import path from 'path';
import { buildSeed } from './seed.js';
import { fail } from './errors.js';
import { CHANNEL_LIMIT, MINS, RATES } from './programs.js';
import { COLUMNS, TABLE_KEY } from './schema.js';
import {
  addMoney,
  addYears,
  daysBetween,
  fromPaise,
  interestPaise,
  nowStamp,
  parseAmount,
  subMoney,
  todayISO
} from './money.js';

function pad(value, width, align = 'left') {
  const text = String(value ?? '');
  if (text.length >= width) return text.slice(0, width);
  const gap = ' '.repeat(width - text.length);
  return align === 'right' ? gap + text : text + gap;
}

function stampTime(iso, time) {
  return `${iso} ${time}`;
}

function nextTxnId(state) {
  const max = state.txn.reduce((highest, txn) => Math.max(highest, Number(txn.TXN_ID.slice(1))), 0);
  return `T${String(max + 1).padStart(11, '0')}`;
}

function nextJobId(state) {
  const max = state.batch_run.reduce((highest, run) => {
    const n = Number(String(run.JOB_ID).replace(/\D/g, ''));
    return Math.max(highest, n);
  }, 4821);
  return `JOB${String(max + 1).padStart(5, '0')}`;
}

function nextRunId(state) {
  return state.batch_run.reduce((highest, run) => Math.max(highest, run.RUN_ID), 0) + 1;
}

function nextAccountNo(state) {
  const max = state.account.reduce((highest, acct) => Math.max(highest, Number(acct.ACCT_NO)), 142000000);
  return String(max + 1).padStart(10, '0');
}

export function canSee(user, account) {
  if (!user || user.role !== 'customer') return true;
  return account.CUST_ID === user.custId;
}

function reject(trace, code, message) {
  trace.push(`RESP ${code}  ${message}`);
  trace.push('EXEC SQL ROLLBACK');
  trace.push('EXEC CICS RETURN');
  throw fail(code, message, trace);
}

function findAccount(state, acctNo) {
  return state.account.find((item) => item.ACCT_NO === acctNo) || null;
}

function findCustomer(state, custId) {
  return state.customer.find((item) => item.CUST_ID === custId) || null;
}

/**
 * CBKINT01. One unit of work: nothing is visible until the caller saves state.
 * Interest = balance at batch time x (rate/100) x days / 365, half-up to the paise.
 * Days = batch date minus LAST_INT_DATE. This is simple interest, not a daily-balance file.
 */
export function accrue(state, asOf, actor = { userId: 'EODBATCH' }) {
  const trace = [
    'CBKINT01  A-MAIN',
    'CBKINT01  B-OPEN-CURSOR',
    "EXEC SQL DECLARE C_ACCT CURSOR FOR",
    "  SELECT ACCT_NO, ACCT_TYPE, BALANCE, RATE, LAST_INT_DATE",
    "    FROM AETHR.ACCOUNT",
    "   WHERE STATUS = 'A'",
    '   ORDER BY ACCT_NO',
    'EXEC SQL OPEN C_ACCT'
  ];
  const rows = [];
  let posted = 0;
  let totalPaise = 0;
  const ordered = [...state.account].sort((a, b) => a.ACCT_NO.localeCompare(b.ACCT_NO));

  for (const acct of ordered) {
    if (acct.STATUS !== 'A') continue;
    trace.push('CBKINT01  C-FETCH-LOOP');
    const days = daysBetween(acct.LAST_INT_DATE, asOf);
    let interest = 0;
    if (days > 0 && acct.RATE > 0) {
      const paise = interestPaise(acct.BALANCE, acct.RATE, days);
      interest = fromPaise(paise);
      totalPaise += paise;
    }
    const before = acct.BALANCE;
    trace.push(`CBKINT01  D-POST-ONE  ${acct.ACCT_NO}  DAYS ${days}  INT ${interest.toFixed(2)}`);
    if (interest > 0) {
      acct.BALANCE = addMoney(acct.BALANCE, interest);
      state.txn.push({
        TXN_ID: nextTxnId(state),
        ACCT_NO: acct.ACCT_NO,
        TXN_TS: stampTime(asOf, '23:45:00'),
        DR_CR: 'C',
        AMOUNT: interest,
        BAL_AFTER: acct.BALANCE,
        NARRATIVE: `Interest ${days} days`,
        CHANNEL: 'JES',
        RELATED_ACCT: '',
        PROGRAM_ID: 'CBKINT01',
        TELLER_ID: 'EODBATCH'
      });
      posted += 1;
    }
    if (days > 0) acct.LAST_INT_DATE = asOf;
    rows.push({ acct, before, interest, days, after: acct.BALANCE });
  }

  trace.push('CBKINT01  E-CLOSE');
  trace.push('EXEC SQL CLOSE C_ACCT');
  trace.push('CBKINT01  F-SUMMARY');
  trace.push('EXEC SQL COMMIT');
  const spool = formatInterestSpool(asOf, rows, fromPaise(totalPaise), posted);
  return { trace, spool, posted, total: fromPaise(totalPaise), actor };
}

function formatInterestSpool(asOf, rows, total, posted) {
  const lines = [];
  lines.push(`${pad('AETHER BANK', 24)}${pad('INTEREST ACCRUAL', 28)}${asOf}`);
  lines.push('PROGRAM CBKINT01   JOB EODINT   SUBSYSTEM DB2P   RC 00');
  lines.push('RULE  BALANCE x RATE x DAYS / 365   HALF-UP TO THE PAISE');
  lines.push('-'.repeat(72));
  lines.push(`${pad('ACCOUNT', 12)}${pad('TYPE', 6)}${pad('BALANCE', 14, 'right')}  DAYS ${pad('INTEREST', 12, 'right')} ${pad('NEW BAL', 14, 'right')}`);
  for (const row of rows) {
    lines.push(
      `${pad(row.acct.ACCT_NO, 12)}${pad(row.acct.ACCT_TYPE, 6)}` +
      `${pad(row.before.toFixed(2), 14, 'right')}  ${pad(row.days, 4, 'right')} ` +
      `${pad(row.interest.toFixed(2), 12, 'right')} ${pad(row.after.toFixed(2), 14, 'right')}`
    );
  }
  lines.push('-'.repeat(72));
  lines.push(`ACCOUNTS IN CURSOR ${pad(rows.length, 4, 'right')}   POSTED ${pad(posted, 4, 'right')}   INTEREST ${total.toFixed(2)}`);
  lines.push('ONE COMMIT FOR THE WHOLE JOB. A FAILURE ROLLS EVERY ROW BACK.');
  return lines;
}

function formatStatementSpool(state, asOf) {
  const lines = [];
  lines.push(`${pad('AETHER BANK', 24)}${pad('ACCOUNT STATEMENT', 28)}${asOf}`);
  lines.push('PROGRAM CBKSTM01   JOB STMTGEN   READ ONLY   RC 00');
  lines.push('LAST 8 MOVEMENTS ON EACH ACCOUNT. NOT A TAX CERTIFICATE.');
  const customers = [...state.customer].sort((a, b) => a.CUST_ID.localeCompare(b.CUST_ID));
  for (const customer of customers) {
    lines.push('-'.repeat(72));
    lines.push(`${customer.CUST_ID}  ${pad(customer.FULL_NAME, 28)} KYC ${customer.KYC_STATUS}  ${customer.CITY}`);
    const accounts = state.account.filter((acct) => acct.CUST_ID === customer.CUST_ID);
    for (const acct of accounts) {
      lines.push(`ACCT ${acct.ACCT_NO}  ${acct.ACCT_TYPE}  BAL ${acct.BALANCE.toFixed(2)}  STATUS ${acct.STATUS}`);
      const txns = state.txn
        .filter((txn) => txn.ACCT_NO === acct.ACCT_NO)
        .slice(-8);
      for (const txn of txns) {
        lines.push(
          `  ${txn.TXN_TS.slice(0, 10)}  ${pad(txn.NARRATIVE, 22)}  ${txn.DR_CR} ${pad(txn.AMOUNT.toFixed(2), 12, 'right')}  ${pad(txn.BAL_AFTER.toFixed(2), 12, 'right')}`
        );
      }
    }
  }
  lines.push('-'.repeat(72));
  lines.push('CBKSTM01  D-SUMMARY   NO BALANCE WAS CHANGED');
  return lines;
}

function formatCopySpool(asOf, jobId) {
  return [
    `${pad('DSNUTILB', 20)}${pad('IMAGE COPY', 24)}${asOf}`,
    `JOB DB2COPY   JOBID ${jobId}   SUBSYSTEM DB2P`,
    'COPY TABLESPACE AETHR.TSACCT',
    '  COPYDDN SYSCOPY',
    '  SHRLEVEL REFERENCE',
    'SYSCOPY  DSN=AETHR.COPY.TSACCT(+1)',
    'GENERATION DATA GROUP +1 IS THE NEWEST IMAGE COPY.',
    'THE LAB BRIDGE DOES NOT MOVE DB2 PAGES.',
    'IT RETURNS THE UTILITY REPORT THE CHANNEL WOULD READ FROM JES.',
    'UTILITY RETURN CODE 00'
  ];
}

export function jobstat(runs, jobName) {
  const lines = [
    'JOBSTAT  AETHER BANK OPERATOR',
    'REXX READS AETHR.BATCH_RUN. ON Z/OS SDSF IS THE OTHER CHOICE.',
    'JOB NAME  JOB ID    STATUS      RC  ENDED'
  ];
  const rows = runs
    .filter((run) => !jobName || run.JOB_NAME === jobName)
    .slice()
    .reverse();
  if (rows.length === 0) lines.push('NO ROWS');
  for (const run of rows.slice(0, 8)) {
    lines.push(
      `${pad(run.JOB_NAME, 10)}${pad(run.JOB_ID, 10)}${pad(run.STATUS, 12)}${pad(run.RETURN_CODE, 4, 'right')}  ${run.ENDED_AT}`
    );
  }
  lines.push('READY');
  return lines;
}

function logBatch(state, { jobName, program, spool, when }) {
  const jobId = nextJobId(state);
  const run = {
    RUN_ID: nextRunId(state),
    JOB_NAME: jobName,
    JOB_ID: jobId,
    STATUS: 'COMPLETED',
    RETURN_CODE: 0,
    SUBMITTED_AT: when,
    ENDED_AT: when,
    PROGRAM_ID: program,
    SPOOL: spool.join('\n')
  };
  state.batch_run.push(run);
  return run;
}

export class Ledger {
  constructor(dir) {
    this.file = path.join(dir, 'db2.json');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } else {
      this.state = buildSeed();
      this.save();
    }
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  /** Mutate a copy. The file changes only after a successful commit. */
  commit(work) {
    const draft = structuredClone(this.state);
    const result = work(draft);
    this.state = draft;
    this.save();
    return result;
  }

  visibleAccounts(user) {
    return this.state.account.filter((acct) => canSee(user, acct));
  }

  listAccounts(user) {
    return this.visibleAccounts(user)
      .map((acct) => ({
        ...acct,
        FULL_NAME: findCustomer(this.state, acct.CUST_ID)?.FULL_NAME || '',
        KYC_STATUS: findCustomer(this.state, acct.CUST_ID)?.KYC_STATUS || ''
      }))
      .sort((a, b) => a.ACCT_NO.localeCompare(b.ACCT_NO));
  }

  listCustomers() {
    return this.state.customer.map((customer) => {
      const accounts = this.state.account.filter((acct) => acct.CUST_ID === customer.CUST_ID);
      const deposits = accounts.reduce((sum, acct) => addMoney(sum, acct.BALANCE), 0);
      return { ...customer, ACCOUNTS: accounts.length, DEPOSITS: deposits };
    });
  }

  inquire(acctNo, user) {
    const trace = ['INQ1  TRANSACTION STARTED', 'CBKINQ01  A-MAIN', 'CBKINQ01  B-SELECT'];
    if (!/^\d{10}$/.test(acctNo || '')) {
      reject(trace, 'E07', 'ACCOUNT NUMBER MUST BE 10 DIGITS');
    }
    trace.push('EXEC SQL SELECT A.ACCT_NO, A.BALANCE, C.FULL_NAME, C.KYC_STATUS');
    trace.push('  INTO :HV-ACCT, :HV-BAL, :HV-NAME, :HV-KYC');
    trace.push('  FROM AETHR.ACCOUNT A JOIN AETHR.CUSTOMER C');
    trace.push('    ON C.CUST_ID = A.CUST_ID');
    trace.push(' WHERE A.ACCT_NO = :HV-ACCT');
    const account = findAccount(this.state, acctNo);
    if (!account) reject(trace, 'E01', `ACCOUNT ${acctNo} WAS NOT FOUND`);
    if (!canSee(user, account)) reject(trace, 'E08', 'THIS SIGN-ON CANNOT SEE THAT ACCOUNT');
    const customer = findCustomer(this.state, account.CUST_ID);
    const txns = this.state.txn.filter((txn) => txn.ACCT_NO === acctNo).slice().reverse();
    trace.push('SQLCODE +0');
    trace.push('CBKINQ01  C-REPLY  RESP 00');
    trace.push('EXEC CICS RETURN');
    return { ok: true, code: '00', program: 'CBKINQ01', transId: 'INQ1', message: 'INQUIRY COMPLETE', trace, account, customer, txns };
  }

  transfer(input, user) {
    const trace = ['XFR1  TRANSACTION STARTED', 'CBKXFR01  A-MAIN', 'CBKXFR01  B-VALIDATE'];
    if (user.role !== 'teller' && user.role !== 'customer') {
      reject(trace, 'E08', 'THE OPERATOR SIGN-ON CANNOT POST CUSTOMER MONEY');
    }
    return this.commit((draft) => {
      const amount = parseAmount(input.amount);
      const fromNo = String(input.from || '').trim();
      const toNo = String(input.to || '').trim();
      const narrative = String(input.narrative || '').replace(/[^\w ./-]/g, '').trim().slice(0, 40);

      if (!/^\d{10}$/.test(fromNo) || !/^\d{10}$/.test(toNo)) {
        reject(trace, 'E07', 'ACCOUNT NUMBER MUST BE 10 DIGITS');
      }
      if (fromNo === toNo) reject(trace, 'E06', 'FROM AND TO ACCOUNT ARE THE SAME');
      if (amount === null) {
        reject(trace, 'E07', `AMOUNT MUST BE A POSITIVE PAISE VALUE UP TO ${CHANNEL_LIMIT.toFixed(2)}`);
      }

      trace.push('CBKXFR01  C-READ-FROM');
      trace.push('EXEC SQL SELECT ACCT_TYPE, BALANCE, STATUS, CUST_ID');
      trace.push('  INTO :HV-TYPE, :HV-BAL, :HV-STATUS, :HV-CUST');
      trace.push('  FROM AETHR.ACCOUNT WHERE ACCT_NO = :HV-FROM');
      const from = findAccount(draft, fromNo);
      if (!from) reject(trace, 'E01', `FROM ACCOUNT ${fromNo} WAS NOT FOUND`);
      const fromCustomer = findCustomer(draft, from.CUST_ID);
      trace.push(`SQLCODE +0  KYC ${fromCustomer?.KYC_STATUS || '?'}`);

      trace.push('CBKXFR01  D-READ-TO');
      const to = findAccount(draft, toNo);
      if (!to) reject(trace, 'E01', `TO ACCOUNT ${toNo} WAS NOT FOUND`);
      trace.push('SQLCODE +0');

      trace.push('CBKXFR01  E-APPLY-RULES');
      if (from.STATUS !== 'A') reject(trace, 'E02', `FROM ACCOUNT ${fromNo} IS NOT ACTIVE`);
      if (to.STATUS !== 'A') reject(trace, 'E02', `TO ACCOUNT ${toNo} IS NOT ACTIVE`);
      if (from.ACCT_TYPE === 'FD') reject(trace, 'E03', 'A FIXED DEPOSIT CANNOT BE DEBITED ON THIS CHANNEL');
      if (fromCustomer?.KYC_STATUS !== 'V') reject(trace, 'E04', `KYC FOR ${fromCustomer?.FULL_NAME || from.CUST_ID} IS NOT VERIFIED`);
      if (user.role === 'customer' && from.CUST_ID !== user.custId) {
        reject(trace, 'E08', 'A CUSTOMER SIGN-ON CAN DEBIT ONLY ITS OWN ACCOUNTS');
      }
      const min = MINS[from.ACCT_TYPE] ?? 0;
      const after = subMoney(from.BALANCE, amount);
      trace.push(`MIN BALANCE ${min.toFixed(2)}  BALANCE AFTER DEBIT ${after.toFixed(2)}`);
      if (toPaiseSafe(after) < toPaiseSafe(min)) {
        reject(trace, 'E05', `INSUFFICIENT FUNDS. BALANCE ${from.BALANCE.toFixed(2)} MINIMUM ${min.toFixed(2)}`);
      }

      trace.push('CBKXFR01  F-POST');
      const when = nowStamp();
      const debitText = narrative || `Transfer to ${toNo}`;
      const creditText = narrative || `Transfer from ${fromNo}`;
      from.BALANCE = after;
      to.BALANCE = addMoney(to.BALANCE, amount);
      const debit = pushTxn(draft, {
        acct: from.ACCT_NO,
        when,
        drcr: 'D',
        amount,
        balance: from.BALANCE,
        narrative: debitText,
        related: to.ACCT_NO,
        program: 'CBKXFR01',
        teller: user.userId
      });
      const credit = pushTxn(draft, {
        acct: to.ACCT_NO,
        when,
        drcr: 'C',
        amount,
        balance: to.BALANCE,
        narrative: creditText,
        related: from.ACCT_NO,
        program: 'CBKXFR01',
        teller: user.userId
      });
      trace.push('EXEC SQL UPDATE AETHR.ACCOUNT SET BALANCE = :HV-BAL WHERE ACCT_NO = :HV-FROM');
      trace.push('EXEC SQL UPDATE AETHR.ACCOUNT SET BALANCE = :HV-BAL WHERE ACCT_NO = :HV-TO');
      trace.push('EXEC SQL INSERT INTO AETHR.TXN (DEBIT LEG) PROGRAM_ID CBKXFR01');
      trace.push('EXEC SQL INSERT INTO AETHR.TXN (CREDIT LEG) PROGRAM_ID CBKXFR01');
      trace.push('EXEC SQL COMMIT');
      trace.push('CBKXFR01  G-REPLY  RESP 00');
      trace.push(`DFHCOMMAREA FROM-BAL ${from.BALANCE.toFixed(2)} TO-BAL ${to.BALANCE.toFixed(2)}`);
      trace.push('EXEC CICS RETURN');
      return {
        ok: true,
        code: '00',
        program: 'CBKXFR01',
        transId: 'XFR1',
        message: `TRANSFER POSTED. ${from.ACCT_NO} IS NOW ${from.BALANCE.toFixed(2)}. ${to.ACCT_NO} IS NOW ${to.BALANCE.toFixed(2)}.`,
        trace,
        amount,
        from: publicAccount(from, draft),
        to: publicAccount(to, draft),
        debit,
        credit
      };
    });
  }

  openAccount(input, user) {
    const trace = ['OPN1  TRANSACTION STARTED', 'CBKOPN01  A-MAIN', 'CBKOPN01  B-VALIDATE'];
    if (user.role !== 'teller') reject(trace, 'E08', 'ONLY A TELLER CAN OPEN AN ACCOUNT');
    const custId = String(input.custId || '').trim().toUpperCase();
    const acctType = String(input.acctType || '').trim().toUpperCase();
    const amount = parseAmount(input.amount);
    if (!['SAV', 'CUR', 'FD'].includes(acctType)) reject(trace, 'E11', 'ACCOUNT TYPE MUST BE SAV, CUR, OR FD');
    if (amount === null) reject(trace, 'E07', 'OPENING AMOUNT IS INVALID');
    const min = MINS[acctType];
    if (amount < min) reject(trace, 'E10', `OPENING AMOUNT IS BELOW THE MINIMUM ${min.toFixed(2)}`);

    return this.commit((draft) => {
      const customer = findCustomer(draft, custId);
      if (!customer) reject(trace, 'E09', `CUSTOMER ${custId} WAS NOT FOUND`);
      const acctNo = nextAccountNo(draft);
      const today = todayISO();
      const account = {
        ACCT_NO: acctNo,
        CUST_ID: custId,
        ACCT_TYPE: acctType,
        BALANCE: amount,
        RATE: RATES[acctType],
        STATUS: 'A',
        BRANCH_CODE: '0142',
        OPEN_DATE: today,
        LAST_INT_DATE: today,
        MATURITY_DATE: acctType === 'FD' ? addYears(today, 1) : null
      };
      trace.push('CBKOPN01  C-INSERT');
      trace.push('EXEC SQL INSERT INTO AETHR.ACCOUNT');
      trace.push('EXEC SQL INSERT INTO AETHR.TXN PROGRAM_ID CBKOPN01');
      draft.account.push(account);
      const txn = pushTxn(draft, {
        acct: acctNo,
        when: nowStamp(),
        drcr: 'C',
        amount,
        balance: amount,
        narrative: 'Opening deposit',
        related: '',
        program: 'CBKOPN01',
        teller: user.userId
      });
      trace.push('EXEC SQL COMMIT');
      trace.push(`CBKOPN01  D-REPLY  RESP 00  ACCT ${acctNo}`);
      trace.push('EXEC CICS RETURN');
      return {
        ok: true,
        code: '00',
        program: 'CBKOPN01',
        transId: 'OPN1',
        message: `ACCOUNT ${acctNo} OPENED FOR ${customer.FULL_NAME}`,
        trace,
        account,
        customer,
        txn
      };
    });
  }

  runJob(jobName, user) {
    const name = String(jobName || '').toUpperCase();
    const when = nowStamp();
    const asOf = todayISO();
    if (user.role !== 'operator') {
      throw fail('E08', 'ONLY THE OPERATOR SIGN-ON CAN SUBMIT JCL', [
        'REXX OPSMENU REJECTED THE SIGN-ON',
        'JOB WAS NOT READ BY JES'
      ]);
    }
    if (!['EODINT', 'STMTGEN', 'DB2COPY'].includes(name)) {
      throw fail('E07', 'UNKNOWN JOB NAME', ['JOBSTAT FOUND NO SUCH MEMBER']);
    }

    return this.commit((draft) => {
      if (name === 'EODINT') {
        const accrual = accrue(draft, asOf, user);
        const run = logBatch(draft, { jobName: name, program: 'CBKINT01', spool: accrual.spool, when });
        const rexx = [
          'SUBMITTED LOCAL FILE mainframe/jcl/EODINT.jcl',
          'IKJEFT01 RUN PROGRAM(CBKINT01) PLAN(CBKPLAN)',
          ...jobstat([run], 'EODINT')
        ];
        return {
          ok: true,
          code: '00',
          program: 'CBKINT01',
          job: publicRun(run),
          message: `EODINT ${run.JOB_ID} ENDED RC 00. INTEREST ${accrual.total.toFixed(2)} ON ${accrual.posted} ACCOUNTS.`,
          spool: accrual.spool,
          rexx,
          trace: accrual.trace
        };
      }
      if (name === 'STMTGEN') {
        const trace = ['CBKSTM01  A-MAIN', 'CBKSTM01  B-READ', 'CBKSTM01  C-PRINT', 'CBKSTM01  D-SUMMARY'];
        const spool = formatStatementSpool(draft, asOf);
        const run = logBatch(draft, { jobName: name, program: 'CBKSTM01', spool, when });
        return {
          ok: true,
          code: '00',
          program: 'CBKSTM01',
          job: publicRun(run),
          message: `STMTGEN ${run.JOB_ID} ENDED RC 00. BALANCES WERE NOT CHANGED.`,
          spool,
          rexx: ['SUBMITTED LOCAL FILE mainframe/jcl/STMTGEN.jcl', ...jobstat([run], 'STMTGEN')],
          trace
        };
      }
      const jobIdPreview = nextJobId(draft);
      const spool = formatCopySpool(asOf, jobIdPreview);
      const run = logBatch(draft, { jobName: name, program: 'DSNUTILB', spool, when });
      return {
        ok: true,
        code: '00',
        program: 'DSNUTILB',
        job: publicRun(run),
        message: `DB2COPY ${run.JOB_ID} ENDED RC 00. IMAGE COPY LOGGED. NO BUSINESS ROW CHANGED.`,
        spool,
        rexx: ['SUBMITTED LOCAL FILE mainframe/jcl/DB2COPY.jcl', 'PGM=DSNUTILB', ...jobstat([run], 'DB2COPY')],
        trace: ['DSNUTILB IS AN IBM UTILITY. THIS SHOP DOES NOT CHANGE IT.', 'BRIDGE LOGGED AETHR.BATCH_RUN AFTER RC 00']
      };
    });
  }

  dashboard(user) {
    const accounts = this.visibleAccounts(user);
    const ids = new Set(accounts.map((acct) => acct.ACCT_NO));
    const txns = this.state.txn.filter((txn) => ids.has(txn.ACCT_NO));
    const today = todayISO();
    const deposits = accounts.reduce((sum, acct) => addMoney(sum, acct.BALANCE), 0);
    const series = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = shiftDays(today, -i);
      let credit = 0;
      let debit = 0;
      for (const txn of txns) {
        if (!txn.TXN_TS.startsWith(day)) continue;
        if (txn.DR_CR === 'C') credit = addMoney(credit, txn.AMOUNT);
        else debit = addMoney(debit, txn.AMOUNT);
      }
      series.push({ date: day, credit, debit });
    }
    const recent = txns.slice().reverse().slice(0, 8).map((txn) => ({
      ...txn,
      FULL_NAME: findCustomer(this.state, findAccount(this.state, txn.ACCT_NO)?.CUST_ID)?.FULL_NAME || ''
    }));
    const jobs = user.role === 'customer'
      ? []
      : this.state.batch_run.slice().reverse().slice(0, 4).map(publicRun);
    return {
      deposits,
      accountCount: accounts.length,
      customerCount: user.role === 'customer' ? 1 : this.state.customer.length,
      txnToday: txns.filter((txn) => txn.TXN_TS.startsWith(today)).length,
      series,
      recent,
      jobs,
      asOf: today
    };
  }

  listJobs() {
    const runs = this.state.batch_run.slice().reverse();
    return { runs, rexx: jobstat(this.state.batch_run) };
  }

  catalog() {
    const counts = {};
    for (const [name, key] of Object.entries(TABLE_KEY)) counts[name] = this.state[key].length;
    return { schema: 'AETHR', subsystem: 'DB2P', columns: COLUMNS, counts };
  }

  query(sql) {
    const text = String(sql || '').trim().replace(/;+\s*$/, '');
    if (!/^select\b/i.test(text)) {
      throw fail('E07', "THE LAB CATALOG RUNS A SINGLE SELECT. EXAMPLE: SELECT * FROM ACCOUNT WHERE ACCT_TYPE = 'FD'");
    }
    const match = text.match(/^select\s+\*\s+from\s+([a-z_][a-z0-9_]*)(?:\s+where\s+(.+?))?(?:\s+limit\s+(\d+))?$/i);
    if (!match) {
      throw fail('E07', "USE SELECT * FROM TABLE, AN OPTIONAL WHERE OF COLUMN = 'VALUE' JOINED BY AND, AND AN OPTIONAL LIMIT.");
    }
    const table = match[1].toUpperCase();
    const key = TABLE_KEY[table];
    if (!key) throw fail('E07', `UNKNOWN TABLE ${table}. USE CUSTOMER, ACCOUNT, TXN, OR BATCH_RUN.`);
    const where = match[2];
    const limit = Math.min(Number(match[3] || 50), 100);
    let rows = this.state[key];
    if (where) {
      const parts = where.split(/\s+AND\s+/i);
      rows = rows.filter((row) => parts.every((part) => compare(row, part)));
    }
    rows = rows.slice(0, limit).map((row) => {
      if (!row.SPOOL) return row;
      return { ...row, SPOOL: String(row.SPOOL).slice(0, 80) };
    });
    return {
      ok: true,
      sql: text,
      table,
      count: rows.length,
      columns: COLUMNS[table].map((col) => col[0]),
      rows
    };
  }
}

function compare(row, part) {
  const match = part.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?))$/);
  if (!match) {
    throw fail('E07', "EACH WHERE CLAUSE MUST LOOK LIKE CITY = 'Pune' OR RETURN_CODE = 0");
  }
  const column = match[1].toUpperCase();
  if (!(column in row)) throw fail('E07', `COLUMN ${column} IS NOT ON THAT TABLE`);
  const cell = row[column];
  if (match[2] !== undefined) return String(cell ?? '') === match[2];
  return Number(cell) === Number(match[3]);
}

function pushTxn(state, spec) {
  const txn = {
    TXN_ID: nextTxnId(state),
    ACCT_NO: spec.acct,
    TXN_TS: spec.when,
    DR_CR: spec.drcr,
    AMOUNT: spec.amount,
    BAL_AFTER: spec.balance,
    NARRATIVE: spec.narrative,
    CHANNEL: 'CICS',
    RELATED_ACCT: spec.related,
    PROGRAM_ID: spec.program,
    TELLER_ID: spec.teller
  };
  state.txn.push(txn);
  return txn;
}

function publicAccount(acct, state) {
  const customer = findCustomer(state, acct.CUST_ID);
  return { ...acct, FULL_NAME: customer?.FULL_NAME || '' };
}

function publicRun(run) {
  return {
    RUN_ID: run.RUN_ID,
    JOB_NAME: run.JOB_NAME,
    JOB_ID: run.JOB_ID,
    STATUS: run.STATUS,
    RETURN_CODE: run.RETURN_CODE,
    SUBMITTED_AT: run.SUBMITTED_AT,
    ENDED_AT: run.ENDED_AT,
    PROGRAM_ID: run.PROGRAM_ID
  };
}

function shiftDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function toPaiseSafe(value) {
  return Math.round(Number(value) * 100);
}
