import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Boxes, BriefcaseBusiness,
  Check, ChevronDown, CircleHelp, Code2, Database, FileCode2, Landmark, LayoutDashboard,
  LogOut, Menu, Play, Search, ShieldCheck, Users, X
} from 'lucide-react';

const ActivityChart = lazy(() => import('./ActivityChart.jsx'));

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(value || 0));

async function request(path, token, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
  return result;
}

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'accounts', label: 'Accounts', icon: Landmark, group: 'WORKSPACE' },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, group: 'WORKSPACE' },
  { id: 'batch', label: 'Batch operations', icon: BriefcaseBusiness, group: 'MAINFRAME' },
  { id: 'catalog', label: 'DB2 catalog', icon: Database, group: 'MAINFRAME' },
  { id: 'library', label: 'Source library', icon: Code2, group: 'MAINFRAME' },
  { id: 'audit', label: 'Audit trail', icon: ShieldCheck, group: 'ADMIN' }
];

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('corevista-token') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('corevista-user') || 'null'); } catch { return null; }
  });
  const [page, setPage] = useState('overview');
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginId, setLoginId] = useState('EMP0142');
  const [password, setPassword] = useState('Ledger@142');
  const [mobileNav, setMobileNav] = useState(false);
  const [revision, setRevision] = useState(0);

  const act = useCallback(async (work, success = '') => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await work();
      if (success) setNotice(success);
      setRevision((value) => value + 1);
      return result;
    } catch (cause) {
      setError(cause.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    request('/health', '').then(setHealth).catch(() => setHealth(null));
  }, []);

  const signIn = async (event) => {
    event.preventDefault();
    const result = await act(() => request('/login', '', {
      method: 'POST', body: JSON.stringify({ userId: loginId, password })
    }));
    if (result) {
      localStorage.setItem('corevista-token', result.token);
      localStorage.setItem('corevista-user', JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      setError('');
    }
  };

  const signOut = () => {
    localStorage.removeItem('corevista-token');
    localStorage.removeItem('corevista-user');
    setToken('');
    setUser(null);
    setPage('overview');
    setError('');
  };

  if (!token || !user) {
    return <LoginPage loginId={loginId} setLoginId={setLoginId} password={password} setPassword={setPassword}
      signIn={signIn} error={error} busy={busy} health={health} />;
  }

  const allowedNavigation = navigation.filter((item) => {
    if (item.id === 'audit' || item.id === 'batch') return user.role === 'operator';
    if (item.id === 'catalog') return user.role === 'operator' || user.role === 'teller';
    return true;
  });
  const active = allowedNavigation.find((item) => item.id === page) || allowedNavigation[0];
  const changePage = (id) => { setPage(id); setMobileNav(false); setError(''); setNotice(''); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Landmark size={20} /></div><div><b>corevista</b><span>MAINFRAME BANKING LAB</span></div></div>
        <div className="branch-chip"><span className="live-dot" /> REGION DB2P <span className="branch-id">0142</span></div>
        {['WORKSPACE', 'MAINFRAME', 'ADMIN'].map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-heading">{group}</div>
            {allowedNavigation.filter((item) => item.group === group).map(({ id, label, icon: Icon }) => (
              <button className={`nav-item ${page === id ? 'selected' : ''}`} key={id} onClick={() => changePage(id)}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'library' && <span className="nav-badge">COBOL</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="environment"><span className="env-square">DEV</span><div><b>Lab environment</b><span>Channel bridge active</span></div><span className="status-dot" /></div>
          <button className="profile" onClick={signOut}>
            <div className="avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
            <div className="profile-name"><b>{user.name}</b><span>{user.role} · {user.userId}</span></div>
            <LogOut size={16} className="logout-icon" />
          </button>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>CoreVista</span><span className="crumb-slash">/</span><b>{active.label}</b></div>
          <div className="topbar-right"><span className="date-label">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><div className="top-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><span className="user-short">{user.name.split(' ')[0]}<ChevronDown size={14} /></span></div>
        </header>
        <section className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">{active.group} <span>·</span> BRANCH 0142</div><h1>{pageTitle(page)}</h1><p>{pageSubtitle(page, user.role)}</p></div>
            <div className="heading-status"><span className="live-dot" /> ONLINE <span className="status-divider" /> {health?.runtime || 'lab-bridge'}</div>
          </div>
          {(error || notice) && <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss"><X size={16} /></button></div>}
          <PageContent page={page} token={token} user={user} act={act} busy={busy} revision={revision} onGo={changePage} />
          <footer className="footer"><span>COREVISTA <span className="footer-dot">•</span> MAINFRAME LEARNING LAB</span><span>COBOL · CICS · DB2 · JES <span className="footer-dot">•</span> CHANNEL BRIDGE IS A SIMULATION</span></footer>
        </section>
      </main>
    </div>
  );
}

function LoginPage({ loginId, setLoginId, password, setPassword, signIn, error, busy, health }) {
  const demos = [
    { role: 'TELLER', id: 'EMP0142', pass: 'Ledger@142' },
    { role: 'OPERATOR', id: 'OPS1001', pass: 'Batch@142' },
    { role: 'CUSTOMER', id: 'CUST1001', pass: 'Arun@142' }
  ];
  return <div className="login-screen">
    <div className="login-decoration"><div className="grid-lines" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="login-hero">
      <div className="brand brand-light"><div className="brand-mark"><Landmark size={20} /></div><div><b>corevista</b><span>MAINFRAME BANKING LAB</span></div></div>
      <div className="hero-copy"><div className="eyebrow">A MODERN WINDOW INTO THE MAINFRAME</div><h1>Core banking.<br /><span>Core confidence.</span></h1><p>Explore how real-time CICS transactions and overnight batch processing power a modern bank.</p></div>
      <div className="hero-terminal"><div className="terminal-top"><span /><span /><span /><label>DB2P · REGION 0142</label></div><pre>{`CBKINQ01  A-MAIN\nEXEC SQL SELECT BALANCE\n  INTO :HV-BALANCE\n  FROM AETHR.ACCOUNT\n WHERE ACCT_NO = :HV-ACCT\nSQLCODE +0  RESP 00\nEXEC CICS RETURN`}</pre></div>
      <div className="hero-footer"><span><span className="live-dot" /> LAB ENVIRONMENT</span><span>COBOL · CICS · DB2 · JES</span></div>
    </div></div>
    <div className="login-panel"><div className="login-form-wrap"><div className="mobile-brand brand"><div className="brand-mark"><Landmark size={20} /></div><div><b>corevista</b><span>MAINFRAME BANKING LAB</span></div></div><div className="login-welcome"><div className="eyebrow">SECURE SIGN-ON</div><h2>Welcome back</h2><p>Sign in to your branch operations desk.</p></div>
      <form className="login-form" onSubmit={signIn}><label htmlFor="userId">USER ID</label><input id="userId" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required /><label htmlFor="password">PASSWORD</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to CoreVista'}<span>→</span></button></form>
      <div className="demo-logins"><div className="demo-title"><span>DEMO SIGN-ONS</span><span>SELECT TO PREFILL</span></div>{demos.map((demo) => <button key={demo.id} onClick={() => { setLoginId(demo.id); setPassword(demo.pass); }}><span className="demo-role">{demo.role}</span><span>{demo.id}</span><ChevronDown size={14} className="demo-arrow" /></button>)}</div>
      <div className="login-security"><ShieldCheck size={16} /><span>Training environment · fictional customer data · no real banking access</span></div>
      <div className="login-health"><span className={health ? 'status-dot' : 'status-dot status-off'} /> {health ? 'API connected' : 'API starting'} <span>·</span> AETHER BANK, 0142</div>
    </div></div>
  </div>;
}

function PageContent({ page, token, user, act, busy, revision, onGo }) {
  switch (page) {
    case 'overview': return <Overview token={token} user={user} revision={revision} onGo={onGo} />;
    case 'accounts': return <Accounts token={token} act={act} user={user} />;
    case 'transfers': return <Transfers token={token} act={act} busy={busy} />;
    case 'batch': return <Batch token={token} act={act} busy={busy} revision={revision} />;
    case 'catalog': return <Catalog token={token} act={act} busy={busy} />;
    case 'library': return <Library token={token} />;
    case 'audit': return <Audit token={token} revision={revision} />;
    default: return null;
  }
}

function useLoad(path, token, revision = 0) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    request(path, token).then((value) => { if (active) { setData(value); setLoadError(''); } })
      .catch((cause) => { if (active) setLoadError(cause.message); });
    return () => { active = false; };
  }, [path, token, revision]);
  return { data, loadError };
}

function Overview({ token, user, revision, onGo }) {
  const { data, loadError } = useLoad('/dashboard', token, revision);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  const change = data.series.reduce((sum, day) => sum + day.credit - day.debit, 0);
  return <>
    <div className="metric-grid">
      <Metric label={user.role === 'customer' ? 'MY TOTAL BALANCE' : 'TOTAL DEPOSITS'} value={money(data.deposits)} icon={Landmark} tone="blue" detail={`${data.accountCount} active accounts`} />
      <Metric label="TRANSACTIONS TODAY" value={data.txnToday} icon={ArrowLeftRight} tone="green" detail="Across this sign-on" />
      <Metric label={user.role === 'customer' ? 'MY ACCOUNTS' : 'CUSTOMER BASE'} value={user.role === 'customer' ? data.accountCount : data.customerCount} icon={Users} tone="violet" detail={user.role === 'customer' ? 'Linked to your profile' : 'Branch 0142'} />
      <Metric label="7-DAY NET MOVEMENT" value={money(change)} icon={Activity} tone="amber" detail="Credits less debits" />
    </div>
    <div className="content-grid overview-grid">
      <div className="card chart-card"><div className="card-heading"><div><h3>Transaction activity</h3><p>Money in vs. money out · last 7 days</p></div><span className="soft-chip"><span className="legend-dot credit-dot" /> Credit <span className="legend-dot debit-dot" /> Debit</span></div>
        <div className="chart-wrap">{data.series.some((d) => d.credit || d.debit) ? <Suspense fallback={<div className="loading-state">Loading activity chart…</div>}><ActivityChart data={data.series} /></Suspense> : <EmptyState text="No movements in the last seven days." />}</div>
      </div>
      <div className="card jobs-card"><div className="card-heading"><div><h3>Latest batch runs</h3><p>JES activity · region DB2P</p></div><button className="text-link" onClick={() => onGo('batch')}>View all →</button></div>
        {data.jobs.length ? <div className="job-list">{data.jobs.map((job) => <div className="job-row" key={job.RUN_ID}><div className="job-icon"><BriefcaseBusiness size={15} /></div><div className="job-info"><b>{job.JOB_NAME}</b><span>{job.JOB_ID} · {job.PROGRAM_ID}</span></div><span className="rc-pill"><span /> RC {String(job.RETURN_CODE).padStart(2, '0')}</span></div>)}</div> : <EmptyState text="No batch runs to display." />}
        {user.role === 'operator' && <button className="outline-button full-button" onClick={() => onGo('batch')}><Play size={14} /> Open operator console</button>}
      </div>
    </div>
    <div className="card table-card"><div className="card-heading"><div><h3>Recent activity</h3><p>Latest posted transactions for this sign-on</p></div><button className="text-link" onClick={() => onGo('accounts')}>Accounts →</button></div><Transactions rows={data.recent} /></div>
  </>;
}

function Metric({ label, value, icon: Icon, tone, detail }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function Accounts({ token, act, user }) {
  const { data, loadError } = useLoad('/accounts', token);
  const [selected, setSelected] = useState(null);
  const [showOpen, setShowOpen] = useState(false);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  return <>
    <div className="section-toolbar"><div className="toolbar-note"><span className="live-dot" /> {data.accounts.length} account{data.accounts.length === 1 ? '' : 's'} in your view</div>{user.role === 'teller' && <button className="primary-button compact-button" onClick={() => setShowOpen(true)}>+ Open account</button>}</div>
    <div className="card table-card"><div className="card-heading"><div><h3>Branch account register</h3><p>Account master · AETHR.ACCOUNT</p></div><span className="soft-chip"><Database size={13} /> DB2 TABLE MODEL</span></div>
      <div className="table-scroll"><table><thead><tr><th>ACCOUNT</th><th>ACCOUNT HOLDER</th><th>TYPE</th><th>BALANCE</th><th>STATUS</th><th>RATE</th><th /></tr></thead><tbody>{data.accounts.map((acct) => <tr key={acct.ACCT_NO}><td className="mono strong">{acct.ACCT_NO}</td><td>{acct.FULL_NAME}<small className="cell-sub">{acct.CUST_ID}</small></td><td><TypePill type={acct.ACCT_TYPE} /></td><td className="amount-cell">{money(acct.BALANCE)}</td><td><StatusPill value={acct.STATUS} /></td><td>{Number(acct.RATE).toFixed(2)}%</td><td><button className="row-action" onClick={() => setSelected(acct.ACCT_NO)}>Details →</button></td></tr>)}</tbody></table></div>
    </div>
    {selected && <AccountDetail token={token} acctNo={selected} close={() => setSelected(null)} />}
    {showOpen && <OpenAccount token={token} act={act} close={() => setShowOpen(false)} />}
  </>;
}

function AccountDetail({ token, acctNo, close }) {
  const { data, loadError } = useLoad(`/accounts/${acctNo}`, token);
  return <Modal title={`Account ${acctNo}`} close={close}>{loadError ? <ErrorPanel message={loadError} /> : !data ? <Loading /> : <><div className="detail-account"><span className="detail-balance">{money(data.account.BALANCE)}</span><TypePill type={data.account.ACCT_TYPE} /><StatusPill value={data.account.STATUS} /></div><p className="detail-meta">{data.customer.FULL_NAME} · {data.customer.CUST_ID} · KYC {data.customer.KYC_STATUS} · {data.account.RATE}% p.a.</p><div className="program-trace"><div className="trace-title">CICS PROGRAM TRACE <span>{data.program} · RESP {data.code}</span></div>{data.trace.map((line, i) => <code key={i}>{line}</code>)}</div><h4 className="modal-subheading">Recent postings</h4><Transactions rows={data.txns.slice(0, 6)} /></>}</Modal>;
}

function OpenAccount({ token, act, close }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ custId: '', acctType: 'SAV', amount: '' });
  useEffect(() => { request('/customers', token).then((result) => { setCustomers(result.customers); if (result.customers.length) setForm((v) => ({ ...v, custId: result.customers[0].CUST_ID })); }).catch(() => {}); }, [token]);
  const submit = async (event) => {
    event.preventDefault();
    const result = await act(() => request('/accounts', token, { method: 'POST', body: JSON.stringify(form) }), 'Account opened and opening deposit posted.');
    if (result) close();
  };
  return <Modal title="Open a new account" close={close}><p className="modal-copy">Creates an account master row and its opening credit in the same unit of work.</p><form className="modal-form" onSubmit={submit}><label>Customer</label><select value={form.custId} onChange={(e) => setForm({ ...form, custId: e.target.value })}>{customers.map((c) => <option value={c.CUST_ID} key={c.CUST_ID}>{c.FULL_NAME} · {c.CUST_ID}</option>)}</select><label>Account type</label><select value={form.acctType} onChange={(e) => setForm({ ...form, acctType: e.target.value })}><option value="SAV">Savings · min ₹1,000</option><option value="CUR">Current · min ₹5,000</option><option value="FD">Fixed deposit · min ₹10,000</option></select><label>Opening deposit (INR)</label><input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 10000.00" required /><button className="primary-button" type="submit">Open account <span>→</span></button></form></Modal>;
}

function Transfers({ token, act, busy }) {
  const { data, loadError } = useLoad('/accounts', token);
  const [form, setForm] = useState({ from: '', to: '', amount: '', narrative: '' });
  useEffect(() => { if (data?.accounts.length) setForm((v) => ({ ...v, from: v.from || data.accounts[0].ACCT_NO, to: v.to || data.accounts.find((a) => a.ACCT_NO !== data.accounts[0].ACCT_NO)?.ACCT_NO || '' })); }, [data]);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  const eligible = data.accounts.filter((a) => a.STATUS === 'A' && a.ACCT_TYPE !== 'FD');
  const submit = async (event) => {
    event.preventDefault();
    await act(() => request('/transfers', token, { method: 'POST', body: JSON.stringify(form) }), 'Transfer committed. Both ledger legs were posted.');
  };
  return <div className="transfer-layout"><div className="card transfer-card"><div className="card-heading"><div><h3>New transfer</h3><p>Online CICS transaction · XFR1</p></div><span className="transaction-badge"><span className="live-dot" /> REAL-TIME</span></div>
    <div className="transfer-explainer"><div className="transfer-step"><span>01</span><b>Validate</b><small>Role, KYC, status & funds</small></div><span className="step-arrow">→</span><div className="transfer-step"><span>02</span><b>Post</b><small>Debit + credit ledger rows</small></div><span className="step-arrow">→</span><div className="transfer-step"><span>03</span><b>Commit</b><small>One atomic unit of work</small></div></div>
    <form className="transfer-form" onSubmit={submit}><label>FROM ACCOUNT</label><select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>{eligible.map((a) => <option key={a.ACCT_NO} value={a.ACCT_NO}>{a.ACCT_NO} · {a.FULL_NAME} · {money(a.BALANCE)}</option>)}</select><div className="transfer-divider"><span /><div><ArrowDownLeft size={17} /></div><span /></div><label>TO ACCOUNT</label><select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{data.accounts.filter((a) => a.STATUS === 'A').map((a) => <option key={a.ACCT_NO} value={a.ACCT_NO}>{a.ACCT_NO} · {a.FULL_NAME} · {a.ACCT_TYPE}</option>)}</select><label>AMOUNT (INR)</label><div className="amount-input"><span>₹</span><input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required /></div><label>NARRATIVE <span className="optional">OPTIONAL</span></label><input value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} maxLength="40" placeholder="e.g. Monthly rent" /><button className="primary-button transfer-submit" disabled={busy || !eligible.length}>{busy ? 'Processing…' : 'Review and post transfer'}<ArrowUpRight size={16} /></button></form>
  </div><aside className="card rules-card"><div className="rules-icon"><ShieldCheck size={18} /></div><h3>Transaction controls</h3><p>These are enforced by the COBOL transaction model before posting.</p><ul><li><Check size={14} /> Account must be active</li><li><Check size={14} /> Verified KYC on debit account</li><li><Check size={14} /> Savings/current minimum balance</li><li><Check size={14} /> Fixed deposit cannot be debited</li><li><Check size={14} /> Customer may debit own account only</li></ul><div className="rule-note"><b>Atomicity by design</b><span>Any validation failure rolls back both legs. A successful transfer writes two TXN rows and commits once.</span></div></aside></div>;
}

function Batch({ token, act, busy, revision }) {
  const { data, loadError } = useLoad('/jobs', token, revision);
  const [selected, setSelected] = useState(null);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  const jobs = [
    { name: 'EODINT', program: 'CBKINT01', title: 'Interest accrual', desc: 'Cursor-based daily accrual · updates eligible active accounts', icon: Activity },
    { name: 'STMTGEN', program: 'CBKSTM01', title: 'Statement generation', desc: 'Read-only customer statement extract · last 8 movements', icon: FileCode2 },
    { name: 'DB2COPY', program: 'DSNUTILB', title: 'Image copy', desc: 'DB2 tablespace copy report · utility simulation', icon: Database }
  ];
  const run = async (job) => {
    const result = await act(() => request(`/jobs/${job.name}`, token, { method: 'POST', body: JSON.stringify({}) }), `${job.name} completed with return code 00.`);
    if (result) setSelected(result);
  };
  return <><div className="operator-banner"><div className="operator-icon"><Boxes size={20} /></div><div><b>JES operator console</b><span>Submit a job stream and inspect its spool output. Batch submission is restricted to operator sign-ons.</span></div><span className="console-region">DB2P · READY</span></div>
    <div className="batch-cards">{jobs.map(({ name, program, title, desc, icon: Icon }) => <div className="card batch-card" key={name}><div className="batch-card-top"><div className="batch-icon"><Icon size={18} /></div><span className="batch-program">{program}</span></div><h3>{title}</h3><p>{desc}</p><div className="batch-card-bottom"><code>{name}.jcl</code><button className="run-button" disabled={busy} onClick={() => run({ name })}><Play size={13} fill="currentColor" /> Submit job</button></div></div>)}</div>
    <div className="card table-card"><div className="card-heading"><div><h3>Job history</h3><p>Batch run log · AETHR.BATCH_RUN</p></div><span className="soft-chip">SDSF / JOBSTAT</span></div><div className="table-scroll"><table><thead><tr><th>JOB NAME</th><th>JOB ID</th><th>PROGRAM</th><th>STATUS</th><th>RETURN CODE</th><th>ENDED</th></tr></thead><tbody>{data.runs.map((run) => <tr key={run.RUN_ID}><td className="mono strong">{run.JOB_NAME}</td><td className="mono">{run.JOB_ID}</td><td className="mono">{run.PROGRAM_ID}</td><td><StatusPill value={run.STATUS === 'COMPLETED' ? 'A' : 'F'} label={run.STATUS} /></td><td><span className="rc-pill"><span /> RC {String(run.RETURN_CODE).padStart(2, '0')}</span></td><td>{run.ENDED_AT}</td></tr>)}</tbody></table></div><div className="spool-strip"><pre>{data.rexx.join('\n')}</pre></div></div>
    {selected && <Modal title={`${selected.job.JOB_NAME} · ${selected.job.JOB_ID}`} close={() => setSelected(null)}><div className="job-result"><Check size={16} /><div><b>{selected.message}</b><span>{selected.program} · RETURN CODE {String(selected.job.RETURN_CODE).padStart(2, '0')}</span></div></div><div className="program-trace"><div className="trace-title">JES SPOOL OUTPUT <span>{selected.spool.length} LINES</span></div>{selected.spool.slice(0, 50).map((line, i) => <code key={i}>{line}</code>)}</div><div className="program-trace rexx-trace"><div className="trace-title">REXX OPERATOR RESPONSE</div>{selected.rexx.map((line, i) => <code key={i}>{line}</code>)}</div></Modal>}
  </>;
}

function Catalog({ token, act, busy }) {
  const { data, loadError } = useLoad('/catalog', token);
  const [sql, setSql] = useState("SELECT * FROM ACCOUNT WHERE ACCT_TYPE = 'FD'");
  const [result, setResult] = useState(null);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  const query = async (event) => {
    event.preventDefault();
    const value = await act(() => request('/catalog/query', token, { method: 'POST', body: JSON.stringify({ sql }) }));
    if (value) setResult(value);
  };
  return <><div className="catalog-summary">{Object.entries(data.counts).map(([table, count]) => <div className="catalog-count" key={table}><Database size={15} /><span>{table}</span><b>{count}</b><small>ROWS</small></div>)}</div>
    <div className="content-grid catalog-grid"><div className="card schema-card"><div className="card-heading"><div><h3>Schema explorer</h3><p>{data.schema} · subsystem {data.subsystem}</p></div><span className="db2-mark">DB2</span></div><div className="schema-tables">{Object.entries(data.columns).map(([table, columns]) => <details key={table} open={table === 'ACCOUNT'}><summary><Database size={14} /><b>{table}</b><span>{data.counts[table]} ROWS</span><ChevronDown size={14} /></summary><div className="column-list">{columns.map(([name, type, desc]) => <div key={name}><code>{name}</code><span>{type}</span><small>{desc}</small></div>)}</div></details>)}</div></div>
      <div className="card query-card"><div className="card-heading"><div><h3>SQL workbench</h3><p>Read-only training query runner</p></div><span className="sql-lock"><ShieldCheck size={13} /> SELECT ONLY</span></div><form onSubmit={query}><textarea className="sql-editor" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck="false" /><div className="query-hint"><CircleHelp size={13} /> Single-table SELECT with optional = filters and LIMIT</div><button className="primary-button query-button" disabled={busy}><Play size={14} /> Run query</button></form>{result && <div className="query-results"><div className="result-caption"><span>{result.count} row{result.count === 1 ? '' : 's'}</span><code>{result.table}</code></div>{result.rows.length ? <div className="table-scroll result-table"><table><thead><tr>{result.columns.slice(0, 5).map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>{result.rows.slice(0, 8).map((row, i) => <tr key={i}>{result.columns.slice(0, 5).map((col) => <td key={col}>{String(row[col] ?? '—').slice(0, 28)}</td>)}</tr>)}</tbody></table></div> : <EmptyState text="Query returned no rows." />}</div>}</div>
    </div><div className="info-note"><CircleHelp size={15} /><span><b>Teaching note:</b> the workbench accepts a deliberately small SELECT subset. It is not connected to a live DB2 subsystem and rejects all write statements.</span></div>
  </>;
}

function Library({ token }) {
  const { data, loadError } = useLoad('/sources', token);
  const [selected, setSelected] = useState('');
  const [source, setSource] = useState(null);
  const [sourceError, setSourceError] = useState('');
  const [filter, setFilter] = useState('');
  useEffect(() => {
    if (!selected) return;
    request(`/sources/content?path=${encodeURIComponent(selected)}`, token).then(setSource).catch((cause) => setSourceError(cause.message));
  }, [selected, token]);
  const groups = useMemo(() => {
    if (!data) return {};
    return data.files.filter((file) => file.toLowerCase().includes(filter.toLowerCase())).reduce((result, file) => {
      const group = file.split('/')[0] || 'library';
      result[group] = [...(result[group] || []), file];
      return result;
    }, {});
  }, [data, filter]);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  return <div className="library-layout"><div className="card file-tree"><div className="file-tree-head"><b>MAINFRAME PDS LIBRARY</b><span>{data.files.length} MEMBERS</span></div><div className="file-search"><Search size={14} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter members" /></div><div className="file-list">{Object.entries(groups).map(([group, files]) => <div key={group}><div className="file-group">{group.toUpperCase()}</div>{files.map((file) => <button className={`file-item ${selected === file ? 'file-selected' : ''}`} key={file} onClick={() => { setSelected(file); setSource(null); setSourceError(''); }}><FileIcon path={file} /><span>{file.split('/').slice(1).join('/')}</span></button>)}</div>)}</div><div className="file-tree-foot"><span className="status-dot" /> READ-ONLY SOURCE VIEW</div></div>
    <div className="card source-view"><div className="source-head"><div className="source-breadcrumb"><Code2 size={15} /> {source?.path || selected || 'Select a member to inspect'}</div>{source && <span className="source-type">{source.path.split('.').pop().toUpperCase()}</span>}</div>{sourceError ? <ErrorPanel message={sourceError} /> : source ? <pre className="source-code">{source.text.split('\n').map((line, i) => <span className="source-line" key={i}><i>{String(i + 1).padStart(3, '0')}</i><code>{line || ' '}</code></span>)}</pre> : <div className="source-empty"><FileCode2 size={32} /><b>Browse the mainframe program library</b><span>Select a COBOL, JCL, DB2 or REXX member to inspect the teaching implementation.</span></div>}</div></div>;
}

function FileIcon({ path }) {
  const extension = path.split('.').pop();
  const Icon = extension === 'cbl' ? Code2 : extension === 'jcl' ? BriefcaseBusiness : extension === 'sql' ? Database : FileCode2;
  return <Icon size={14} />;
}

function Audit({ token, revision }) {
  const { data, loadError } = useLoad('/audit', token, revision);
  if (loadError) return <ErrorPanel message={loadError} />;
  if (!data) return <Loading />;
  return <div className="card table-card"><div className="card-heading"><div><h3>Security & operations events</h3><p>Sign-ons, inquiries, postings and operator actions · last 200</p></div><span className="soft-chip"><ShieldCheck size={13} /> OPERATOR VIEW</span></div><div className="table-scroll"><table><thead><tr><th>TIME</th><th>USER</th><th>ROLE</th><th>ACTION</th><th>PROGRAM</th><th>RC</th><th>DETAIL</th></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><td className="mono">{event.ts}</td><td className="mono strong">{event.userId || 'ANONYMOUS'}</td><td>{event.role || '—'}</td><td><span className="action-pill">{event.action}</span></td><td className="mono">{event.program}</td><td><span className={`audit-rc ${event.rc === '00' ? 'audit-ok' : 'audit-fail'}`}>{event.rc}</span></td><td className="audit-detail">{event.detail}</td></tr>)}</tbody></table>{!data.events.length && <EmptyState text="No audit events have been recorded." />}</div></div>;
}

function Transactions({ rows }) {
  if (!rows.length) return <EmptyState text="No recent transaction rows." />;
  return <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>ACCOUNT</th><th>PROGRAM</th><th>DATE / TIME</th><th>AMOUNT</th><th>BALANCE AFTER</th></tr></thead><tbody>{rows.map((txn) => <tr key={txn.TXN_ID}><td><span className={`txn-direction ${txn.DR_CR === 'C' ? 'is-credit' : 'is-debit'}`}>{txn.DR_CR === 'C' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</span><span className="mono strong">{txn.NARRATIVE}</span><small className="cell-sub mono">{txn.TXN_ID}</small></td><td className="mono">{txn.ACCT_NO}</td><td className="mono">{txn.PROGRAM_ID}</td><td>{txn.TXN_TS}</td><td className={`amount-cell ${txn.DR_CR === 'C' ? 'credit-text' : ''}`}>{txn.DR_CR === 'D' ? '−' : '+'}{money(txn.AMOUNT)}</td><td className="amount-cell">{money(txn.BAL_AFTER)}</td></tr>)}</tbody></table></div>;
}

function Modal({ title, close, children }) {
  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close]);
  return <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="modal"><div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={close} aria-label="Close"><X size={18} /></button></div><div className="modal-body">{children}</div></div></div>;
}

function TypePill({ type }) {
  const label = { SAV: 'Savings', CUR: 'Current', FD: 'Fixed deposit' }[type] || type;
  return <span className={`type-pill type-${type}`}>{label}</span>;
}

function StatusPill({ value, label }) {
  const active = value === 'A' || value === 'COMPLETED';
  return <span className={`status-pill ${active ? 'status-active' : 'status-inactive'}`}><span />{label || (active ? 'Active' : value === 'F' ? 'Frozen' : 'Closed')}</span>;
}

function Loading() { return <div className="loading-state"><span className="spinner" /> Loading operations data…</div>; }
function EmptyState({ text }) { return <div className="empty-state">{text}</div>; }
function ErrorPanel({ message }) { return <div className="inline-error"><CircleHelp size={17} /><span>{message}</span></div>; }

function pageTitle(page) {
  return { overview: 'Operations overview', accounts: 'Account register', transfers: 'Fund transfer', batch: 'Batch operations', catalog: 'DB2 data catalog', library: 'Mainframe library', audit: 'Audit trail' }[page];
}
function pageSubtitle(page, role) {
  return {
    overview: 'A live view of your branch activity and core banking workload.',
    accounts: 'Browse account master records and inspect the CICS inquiry path.',
    transfers: 'Post a controlled, two-sided ledger transfer through the XFR1 transaction.',
    batch: 'Submit end-of-day workloads and inspect job output as a JES operator.',
    catalog: 'Explore the AETHR schema and run safe, read-only training queries.',
    library: 'Read the COBOL, JCL, DB2 and REXX source behind this learning lab.',
    audit: `Operator view of sign-ons and business actions across the ${role} workspace.`
  }[page];
}
