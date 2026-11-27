# CoreVista — Mainframe Banking Operations Lab

**Advanced Mainframe Technology project**  
An educational banking system that connects a modern MERN web channel to a
modeled z/OS banking core. The project is designed to be easy to demonstrate:
sign in, inspect an account, post a controlled transfer, submit a batch job,
and then follow the matching COBOL/DB2/JCL source.

> **Scope:** This is a local learning simulation, not production banking
> software. Node.js models the DB2 ledger and the batch job reports; it does not
> compile COBOL or connect to a real z/OS, CICS, JES, or DB2 subsystem. MongoDB
> stores the portal user directory, audit events, and notes when available.

## Technical stack

| Submission field | Technology used |
|---|---|
| Primary languages | **COBOL** (CICS online and batch programs), **JCL** (JES job streams), **REXX** (operator tools), JavaScript (React and Node.js) |
| Database / storage | **IBM Db2 for z/OS** schema and SQL examples for banking data; local JSON ledger model for a no-mainframe demo; **MongoDB** collections for portal users, audit, and notes |
| Open-source elements | **Node.js**, **Express**, **React**, **Vite**, **MongoDB Node driver**, **Recharts**, **Lucide React**, and **Zowe CLI** command examples |

This is a MERN-style application with a mainframe learning layer: React is the
channel, Express/Node.js is the API bridge, MongoDB is the portal store, and the
DB2 business ledger is modeled locally. It deliberately does not claim that
MongoDB replaces DB2 in a mainframe design.

## What to demonstrate

1. Sign in as a teller and open **Accounts**. Open an account to see an account
   master row and its opening-credit transaction created together.
2. Use **Fund transfer**. The API validates both accounts, KYC, account status,
   minimum balance, and role; it then writes debit and credit rows and commits
   them as one unit of work. Try an invalid transfer to show the rollback path.
3. Open an account's details and read its CICS response and SQL trace.
4. Sign in as an operator and use **Batch operations** to run `EODINT`,
   `STMTGEN`, and `DB2COPY`. Inspect the return code, job history, and spool.
   `EODINT` accrues simple interest once per date; `STMTGEN` is read-only.
5. In **DB2 data catalog**, inspect the schema and run the preset query.
   The simulated workbench accepts a restricted, read-only `SELECT` subset.
6. In **Mainframe library**, browse the COBOL programs, DB2 DDL, JCL, and REXX
   members that correspond to the actions in the UI.
7. As operator, open **Audit trail** to show successful and rejected
   sign-ons and business actions.

## Run locally (Windows)

Requirements: Node.js 20 or newer and npm. MongoDB is optional; the application
uses a JSON portal fallback when MongoDB is unavailable.

```powershell
npm install
npm run sql
npm run check
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
The React development server proxies `/api` to Express on port `4000`.

To run a production-style local build:

```powershell
npm run build
npm start
```

Then open `http://localhost:4000`. The generated database files are written to
`server/data/` and are excluded from source control. To reset the demo ledger
and portal, stop the server and run:

```powershell
npm run reset --workspace server
```

Optional MongoDB: start MongoDB locally on port `27017` before the server. The
portal selects the `corevista` database and creates `users`, `audit`, and
`notes` collections. Account and transaction rows remain in the local DB2
model. Configure `MONGO_URI` if using a different local URI. For any shared
deployment, set a private `TOKEN_SECRET`; the development fallback is not a
production secret.

## Demo sign-ons

| Role | User ID | Password | Demonstrates |
|---|---|---|---|
| Teller | `EMP0142` | `Ledger@142` | Accounts, inquiry, opening and transfers |
| Operator | `OPS1001` | `Batch@142` | Batch jobs, catalog, source and audit |
| Customer | `CUST1001` | `Arun@142` | Own-account inquiry and transfer controls |

All names, identifiers, and balances are fictional teaching data. The demo
passwords are intentionally public and must never be reused.

## Architecture

```text
React + Vite channel (client/)
        │ HTTP / JSON, bearer token
        ▼
Express API bridge (server/src/app.js)
        ├── Portal adapter ── MongoDB users / audit / notes
        │                    └─ JSON fallback for offline demos
        └── Ledger model ──── JSON snapshot of DB2 table behavior
                              │
                              └─ mirrored learning artifacts:
                                 COBOL + embedded SQL, JCL, REXX, DB2 DDL
```

| Channel action | API / model | Mainframe teaching member |
|---|---|---|
| Account inquiry | `GET /api/accounts/:acctNo` | `CBKINQ01` CICS COBOL |
| Transfer | `POST /api/transfers` | `CBKXFR01` CICS COBOL |
| Open account | `POST /api/accounts` | `CBKOPN01` CICS COBOL |
| Daily interest | `POST /api/jobs/EODINT` | `EODINT.jcl` → `CBKINT01` |
| Statements | `POST /api/jobs/STMTGEN` | `STMTGEN.jcl` → `CBKSTM01` |
| Image copy report | `POST /api/jobs/DB2COPY` | `DB2COPY.jcl` → DSNUTILB example |

`server/src/programs.js` maps API operations to program names and paragraphs.
`server/src/check.js` checks those paragraph references and tests the main
business rules. The model uses integer paise arithmetic to avoid binary
floating-point currency drift. A failed transfer does not save its working
copy; a successful transfer saves both transaction legs together.

## Source map

```text
client/                 React operations UI
server/src/              Express API, portal adapter, ledger and checks
mainframe/cobol/         CICS inquiry, transfer, open and batch programs
mainframe/db2/DDL.sql    Db2 tables, keys, constraints and indexes
mainframe/db2/SEED.sql   Generated Db2-compatible teaching load
mainframe/jcl/           EODINT, STMTGEN and DB2COPY job streams
mainframe/rexx/          Operator menu and job-status examples
mainframe/zowe/          Zowe CLI learning commands (not executed locally)
```

## Mainframe concepts covered

- **CICS** transaction IDs, COMMAREA request/response, `RESP`, return and
  transaction-level rollback.
- **COBOL** program structure, paragraphized processing, packed-decimal
  amounts and embedded SQL host variables.
- **Db2** relational design, primary/foreign keys, check constraints, indexes,
  cursors, SQLCODE handling and `COMMIT` / `ROLLBACK`.
- **JCL / JES** job steps, DD statements, `IKJEFT01`, Db2 attachment, utility
  execution and spool/return-code inspection.
- **Batch processing** cursor fetch, date-based interest, restart/idempotency
  behavior in the simulator, and a read-only statement extract.
- **REXX / SDSF / Zowe** operator workflow and a bridge to commands that can be
  adapted for an authorized training LPAR.
- **Modern integration** API-to-program mapping, role-based channel access,
  auditability, JSON transport, and separation of portal identity from ledger
  data.

## Important adaptation notes

The members are instructional examples and need site-specific work before
compilation or execution on z/OS: CICS translator and compiler settings,
Db2 precompile/bind and package/plan setup, table-space and storage names,
dataset/HLQ names, RACF access, and local standards. Review `mainframe/zowe/
commands.txt` and replace placeholders only in an authorized environment.
`DB2COPY.jcl` also needs a correctly defined table space and image-copy data
set. No Zowe command is invoked by this web app.
