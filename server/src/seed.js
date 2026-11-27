import { addMoney, subMoney, daysBetween } from './money.js';
import { accrue } from './ledger.js';

const STAFF_TELLER = 'EMP0142';

const customers = [
  ['CUST1001', 'Arun Deshpande', 'ABCPD1234E', 'Pune', '9822001100', 'V', '2024-04-12', 'arun@aether.example'],
  ['CUST1002', 'Meera Kulkarni', 'BBCPK5678F', 'Pune', '9822002200', 'V', '2024-08-01', 'meera@aether.example'],
  ['CUST1003', 'Rahul Shenoy', 'CDBPS9012G', 'Bengaluru', '9845003300', 'V', '2023-02-14', 'rahul@aether.example'],
  ['CUST1004', 'Fatima Qureshi', 'DDEQF3456H', 'Hyderabad', '9849004400', 'V', '2024-11-20', 'fatima@aether.example'],
  ['CUST1005', 'Joseph Mathew', 'EEGPM6789J', 'Kochi', '9847005500', 'V', '2022-06-01', 'joseph@aether.example'],
  ['CUST1006', 'Kavita Singh', 'FFHKS1122K', 'Jaipur', '9829006600', 'P', '2025-01-09', 'kavita@aether.example'],
  ['CUST1007', 'Nandini Rao', 'GGINR4455L', 'Chennai', '9840007700', 'V', '2025-05-16', 'nandini@aether.example'],
  ['CUST9001', 'Aether Payroll Pool', 'AETHP0001A', 'Pune', '0204000142', 'V', '2020-01-01', 'payroll@aether.example']
];

const accountSpecs = [
  ['0142001001', 'CUST1001', 'SAV', 4, 'A', '2024-04-12', null],
  ['0142001002', 'CUST1001', 'CUR', 0, 'A', '2024-04-12', null],
  ['0142001003', 'CUST1001', 'FD', 6.5, 'A', '2026-01-15', '2027-01-15'],
  ['0142002001', 'CUST1002', 'SAV', 4, 'A', '2024-08-01', null],
  ['0142002002', 'CUST1002', 'CUR', 0, 'A', '2024-08-01', null],
  ['0142003001', 'CUST1003', 'SAV', 4, 'A', '2023-02-14', null],
  ['0142003002', 'CUST1003', 'CUR', 0, 'F', '2023-02-14', null],
  ['0142004001', 'CUST1004', 'SAV', 4, 'A', '2024-11-20', null],
  ['0142004002', 'CUST1004', 'FD', 6.5, 'A', '2025-11-27', '2026-11-27'],
  ['0142005001', 'CUST1005', 'CUR', 0, 'A', '2022-06-01', null],
  ['0142006001', 'CUST1006', 'SAV', 4, 'A', '2025-01-09', null],
  ['0142007001', 'CUST9001', 'CUR', 0, 'A', '2020-01-01', null],
  ['0142008001', 'CUST1007', 'SAV', 4, 'A', '2025-05-16', null],
  ['0142008002', 'CUST1007', 'CUR', 0, 'A', '2025-05-16', null]
];

/** Customer-ledger movements. Not a full general ledger. See the report. */
const movements = [
  ['0142001001', '2024-04-12', '10:15:00', 'C', 150000, 'Opening deposit', 'CBKOPN01'],
  ['0142001001', '2026-11-02', '09:05:00', 'C', 85000, 'Salary credit', 'CBKXFR01'],
  ['0142001001', '2026-11-10', '11:40:00', 'D', 42000, 'Rent debit', 'CBKXFR01'],
  ['0142001001', '2026-11-18', '16:20:00', 'D', 10549.5, 'Household UPI', 'CBKXFR01'],
  ['0142001002', '2024-04-12', '10:20:00', 'C', 40000, 'Opening deposit', 'CBKOPN01'],
  ['0142001002', '2026-11-09', '15:10:00', 'D', 15400, 'Brokerage payment', 'CBKXFR01'],
  ['0142001003', '2026-01-15', '12:00:00', 'C', 500000, 'Fixed deposit booked', 'CBKOPN01'],
  ['0142002001', '2024-08-01', '10:15:00', 'C', 70000, 'Opening deposit', 'CBKOPN01'],
  ['0142002001', '2026-11-03', '09:10:00', 'C', 40000, 'Salary credit', 'CBKXFR01'],
  ['0142002001', '2026-11-12', '13:05:00', 'D', 18000, 'School fees', 'CBKXFR01'],
  ['0142002002', '2024-08-01', '10:25:00', 'C', 25000, 'Opening deposit', 'CBKOPN01'],
  ['0142002002', '2026-11-08', '18:40:00', 'D', 9569.75, 'Card settlement', 'CBKXFR01'],
  ['0142003001', '2023-02-14', '10:15:00', 'C', 250000, 'Opening deposit', 'CBKOPN01'],
  ['0142003001', '2026-10-28', '17:00:00', 'C', 100000, 'Annual bonus', 'CBKXFR01'],
  ['0142003001', '2026-11-15', '12:30:00', 'D', 40000, 'Family support', 'CBKXFR01'],
  ['0142003002', '2023-02-14', '10:30:00', 'C', 8000, 'Opening deposit', 'CBKOPN01'],
  ['0142004001', '2024-11-20', '10:15:00', 'C', 50000, 'Opening deposit', 'CBKOPN01'],
  ['0142004001', '2026-11-01', '11:00:00', 'C', 30000, 'Freelance receipt', 'CBKXFR01'],
  ['0142004001', '2026-11-19', '14:15:00', 'D', 12110, 'Medical bill', 'CBKXFR01'],
  ['0142004002', '2025-11-27', '12:00:00', 'C', 250000, 'Fixed deposit booked', 'CBKOPN01'],
  ['0142005001', '2022-06-01', '10:15:00', 'C', 100000, 'Opening deposit', 'CBKOPN01'],
  ['0142005001', '2026-11-07', '16:45:00', 'D', 15789.25, 'Vendor payment', 'CBKXFR01'],
  ['0142006001', '2025-01-09', '10:15:00', 'C', 20000, 'Opening deposit', 'CBKOPN01'],
  ['0142006001', '2026-11-05', '19:05:00', 'D', 7950, 'ATM withdrawal', 'CBKXFR01'],
  ['0142007001', '2020-01-01', '09:00:00', 'C', 1500000, 'Payroll float', 'CBKOPN01'],
  ['0142008001', '2025-05-16', '10:15:00', 'C', 60000, 'Opening deposit', 'CBKOPN01'],
  ['0142008001', '2026-11-11', '13:50:00', 'D', 15500, 'Travel debit', 'CBKXFR01'],
  ['0142008002', '2025-05-16', '10:25:00', 'C', 20000, 'Opening deposit', 'CBKOPN01'],
  ['0142008002', '2026-11-21', '18:10:00', 'D', 10100, 'ATM withdrawal', 'CBKXFR01']
];

let txnSeq = 1;

function nextTxnId() {
  const id = `T${String(txnSeq).padStart(11, '0')}`;
  txnSeq += 1;
  return id;
}

function post(state, row) {
  const [acctNo, date, time, drcr, amount, narrative, program] = row;
  const acct = state.account.find((item) => item.ACCT_NO === acctNo);
  if (!acct) throw new Error(`Seed account missing ${acctNo}`);
  acct.BALANCE = drcr === 'D' ? subMoney(acct.BALANCE, amount) : addMoney(acct.BALANCE, amount);
  if (acct.BALANCE < 0) throw new Error(`Seed overdraw ${acctNo}`);
  state.txn.push({
    TXN_ID: nextTxnId(),
    ACCT_NO: acctNo,
    TXN_TS: `${date} ${time}`,
    DR_CR: drcr,
    AMOUNT: amount,
    BAL_AFTER: acct.BALANCE,
    NARRATIVE: narrative,
    CHANNEL: program === 'CBKINT01' ? 'JES' : 'CICS',
    RELATED_ACCT: '',
    PROGRAM_ID: program,
    TELLER_ID: program === 'CBKINT01' ? 'EODBATCH' : STAFF_TELLER
  });
}

export function buildSeed() {
  txnSeq = 1;
  const state = {
    customer: customers.map((row) => ({
      CUST_ID: row[0],
      FULL_NAME: row[1],
      PAN_NO: row[2],
      CITY: row[3],
      PHONE: row[4],
      KYC_STATUS: row[5],
      OPEN_DATE: row[6],
      EMAIL: row[7]
    })),
    account: accountSpecs.map((row) => ({
      ACCT_NO: row[0],
      CUST_ID: row[1],
      ACCT_TYPE: row[2],
      BALANCE: 0,
      RATE: row[3],
      STATUS: row[4],
      BRANCH_CODE: '0142',
      OPEN_DATE: row[5],
      LAST_INT_DATE: '2026-10-01',
      MATURITY_DATE: row[6]
    })),
    txn: [],
    batch_run: []
  };

  const before = movements.filter((row) => row[1] <= '2026-11-01');
  const after = movements.filter((row) => row[1] > '2026-11-01');
  before.forEach((row) => post(state, row));

  const accrual = accrue(state, '2026-11-01', { userId: 'EODBATCH' });
  state.batch_run.push({
    RUN_ID: 1,
    JOB_NAME: 'EODINT',
    JOB_ID: 'JOB04821',
    STATUS: 'COMPLETED',
    RETURN_CODE: 0,
    SUBMITTED_AT: '2026-11-01 23:40:00',
    ENDED_AT: '2026-11-01 23:44:12',
    PROGRAM_ID: 'CBKINT01',
    SPOOL: accrual.spool.join('\n')
  });

  after.forEach((row) => post(state, row));

  for (const acct of state.account) {
    const rows = state.txn.filter((txn) => txn.ACCT_NO === acct.ACCT_NO);
    let balance = 0;
    for (const txn of rows) {
      balance = txn.DR_CR === 'D' ? subMoney(balance, txn.AMOUNT) : addMoney(balance, txn.AMOUNT);
      if (!Object.is(balance, txn.BAL_AFTER) && balance !== txn.BAL_AFTER) {
        throw new Error(`Running balance drift on ${acct.ACCT_NO} ${txn.TXN_ID}`);
      }
    }
    if (balance !== acct.BALANCE) {
      throw new Error(`Closing balance drift on ${acct.ACCT_NO}`);
    }
    if (acct.LAST_INT_DATE !== '2026-11-01' && acct.STATUS === 'A') {
      throw new Error(`Interest date was not rolled on ${acct.ACCT_NO}`);
    }
  }

  const frozen = state.account.find((acct) => acct.ACCT_NO === '0142003002');
  if (frozen.STATUS !== 'F' || daysBetween('2026-10-01', frozen.LAST_INT_DATE) !== 0) {
    throw new Error('Frozen account must stay outside the accrual cursor');
  }

  return state;
}

export const USERS = [
  { userId: 'EMP0142', name: 'Maya Iyer', role: 'teller', custId: '', branch: '0142', password: 'Ledger@142' },
  { userId: 'OPS1001', name: 'Vikram Patil', role: 'operator', custId: '', branch: '0142', password: 'Batch@142' },
  { userId: 'CUST1001', name: 'Arun Deshpande', role: 'customer', custId: 'CUST1001', branch: '0142', password: 'Arun@142' }
];
