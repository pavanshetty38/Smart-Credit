import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QRCodeSVG } from 'qrcode.react';
import { API, login, register } from './api';
import { LogOut, ShieldCheck, Store, WalletCards, QrCode, Upload, RefreshCw, Bell, CheckCheck, X } from 'lucide-react';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fileUrl = url => url?.startsWith('http') ? url : `${API_ORIGIN}${url || ''}`;

function Layout({ children }) {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const r = await API.get('/notifications?limit=30');
      setNotifications(r.data.notifications || []);
      setUnread(r.data.unread || 0);
    } catch (e) {
      console.error('Notification load failed:', e);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [user?.id, user?.role]);

  const logout = () => {
    localStorage.clear();
    nav('/login');
  };

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifications(items =>
        items.map(item =>
          item._id === id ? { ...item, read: true } : item
        )
      );
      setUnread(value => Math.max(0, value - 1));
    } catch (e) {
      console.error('Notification update failed:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      setNotifications(items =>
        items.map(item => ({ ...item, read: true }))
      );
      setUnread(0);
    } catch (e) {
      console.error('Notification update failed:', e);
    }
  };

  return <>
    <header>
      <Link className="brand" to="/">SmartCredit</Link>

      <div className="nav">
        {user ? <>
          <span className="navUser">{user.name} · {user.role}</span>

          <Link to="/dashboard">Dashboard</Link>

          <div className="notificationWrap">
            <button
              className="notificationButton"
              aria-label="Notifications"
              onClick={() => {
                setOpen(value => !value);
                loadNotifications();
              }}
            >
              <Bell size={17} />
              {unread > 0 && <span className="notificationBadge">
                {unread > 99 ? '99+' : unread}
              </span>}
            </button>

            {open && (
              <div className="notificationPanel">
                <div className="notificationHeader">
                  <div>
                    <strong>Notifications</strong>
                    <small>{unread ? `${unread} unread` : 'All caught up'}</small>
                  </div>
                  {unread > 0 && (
                    <button
                      className="iconTextButton"
                      onClick={markAllRead}
                    >
                      <CheckCheck size={15} />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="notificationList">
                  {notifications.length === 0 ? (
                    <div className="emptyNotifications">
                      <Bell size={24} />
                      <p>No notifications yet.</p>
                    </div>
                  ) : notifications.map(item => (
                    <button
                      key={item._id}
                      className={`notificationItem ${item.read ? '' : 'unread'}`}
                      onClick={() => markRead(item._id)}
                    >
                      <span className={`notificationDot ${item.type || 'system'}`} />
                      <span className="notificationContent">
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                        <small>{new Date(item.createdAt).toLocaleString()}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={logout}>
            <LogOut size={15}/>
            Logout
          </button>
        </> : <>
          <Link to="/login">Login</Link>
          <Link className="btn" to="/register">Register</Link>
        </>}
      </div>
    </header>

    <main>{children}</main>

    <footer>
      SmartCredit · Simulated academic credit system · No real money movement
    </footer>
  </>;
}

function Home() {
  return <><section className="hero"><div><span className="tag">SIMULATED CREDIT PLATFORM</span><h1>Smart credit, <em>made simple.</em></h1><p>QR credit purchases, KYC verification, repayments and automated daily settlement for customers, merchants and administrators.</p><Link className="btn big" to="/register">Get Started</Link></div><div className="heroCard"><WalletCards size={40}/><h2>₹25,000</h2><p>Example credit limit</p><div className="line"><span>Available</span><b>₹18,500</b></div><div className="line"><span>Outstanding</span><b>₹6,500</b></div></div></section><section className="grid3"><Feature icon={<WalletCards/>} title="Customer" text="Credit limits, QR purchases, KYC documents, repayments and Auto Settlement."/><Feature icon={<Store/>} title="Merchant" text="Generate merchant QR, accept credit sales, view settlements and upload KYC."/><Feature icon={<ShieldCheck/>} title="Admin" text="Approve KYC documents, set limits, review transactions and monitor settlements."/></section></>;
}
function Feature({ icon, title, text }) { return <div className="card feature">{icon}<h3>{title}</h3><p>{text}</p></div>; }

function Auth({ mode }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async e => { e.preventDefault(); setLoading(true); setErr(''); try { const r = mode === 'login' ? await login({ email: form.email, password: form.password }) : await register(form); localStorage.setItem('token', r.data.token); localStorage.setItem('user', JSON.stringify(r.data.user)); nav('/dashboard'); } catch (e) { setErr(e.response?.data?.message || 'Something went wrong'); } finally { setLoading(false); } };
  return <div className="auth card"><h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>{err && <div className="alert">{err}</div>}<form onSubmit={submit}>{mode === 'register' && <><label>Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="customer">Customer</option><option value="merchant">Merchant</option></select></label></>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label><label>Password<input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></label><button className="btn full" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}</button></form>{mode === 'login' ? <p>New user? <Link to="/register">Register</Link></p> : <p>Already registered? <Link to="/login">Login</Link></p>}</div>;
}

function Dashboard() { const user = JSON.parse(localStorage.getItem('user') || 'null'); if (!user) return <Auth mode="login"/>; return user.role === 'admin' ? <Admin/> : user.role === 'merchant' ? <Merchant/> : <Customer/>; }

function KycUpload({ user, endpoint, onDone }) {
  const [files, setFiles] = useState([]); const [types, setTypes] = useState([]); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); if (!files.length) return setMsg('Select at least one document.'); setBusy(true); setMsg(''); try { const fd = new FormData(); files.forEach((f, i) => { fd.append('documents', f); fd.append('types', types[i] || 'other'); }); const r = await API.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setMsg(r.data.message); setFiles([]); setTypes([]); onDone?.(r.data.user); } catch (e) { setMsg(e.response?.data?.message || 'Upload failed'); } finally { setBusy(false); } };
  return <div className="card"><h3><Upload size={19}/> KYC Documents</h3><p className="muted">Upload PDF, JPG or PNG files. Maximum 5 files, 5 MB each.</p>{user?.kycDocuments?.length > 0 && <div className="docs">{user.kycDocuments.map(d => <a key={d._id || d.filename} href={fileUrl(d.url)} target="_blank" rel="noreferrer">{d.type} · {d.originalName}</a>)}</div>}<form onSubmit={submit}><input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={e => { const fs = [...e.target.files].slice(0,5); setFiles(fs); setTypes(fs.map(() => 'aadhaar')); }}/>{files.map((f,i) => <div className="docRow" key={`${f.name}-${i}`}><span>{f.name}</span><select value={types[i] || 'other'} onChange={e => setTypes(t => t.map((x,j) => j===i ? e.target.value : x))}><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="driving_license">Driving License</option><option value="passport">Passport</option><option value="other">Other</option></select></div>)}<button className="btn" disabled={busy}>{busy ? 'Uploading...' : 'Upload KYC Documents'}</button></form>{msg && <div className="success">{msg}</div>}</div>;
}

function Customer() {
  const [d,setD] = useState(null); const [msg,setMsg]=useState(''); const [scanner,setScanner]=useState(false); const [merchantId,setMerchantId]=useState(''); const [payOpen,setPayOpen]=useState(false); const [amount,setAmount]=useState(''); const [merchants,setMerchants]=useState([]); const [manual,setManual]=useState({merchantId:'',amount:''}); const [repay,setRepay]=useState({amount:'',method:'SIMULATED_UPI'});
  const load=async()=>{ try { const r=await API.get('/customer/dashboard'); setD(r.data); const m=await API.get('/customer/merchants'); setMerchants(m.data); } catch(e){ setMsg(e.response?.data?.message||'Unable to load dashboard'); } };
  useEffect(()=>{load()},[]);
  const purchase=async()=>{ try { const r=await API.post('/customer/purchase',{merchantId,amount:Number(amount)}); setMsg(`Purchase successful: ${money(r.data.transaction.amount)}`); setPayOpen(false); setAmount(''); await load(); } catch(e){ setMsg(e.response?.data?.message||'Purchase failed'); } };
  const manualPurchase=async e=>{e.preventDefault();try{const r=await API.post('/customer/purchase',{merchantId:manual.merchantId,amount:Number(manual.amount)});setMsg(`Purchase successful: ${money(r.data.transaction.amount)}`);setManual({merchantId:'',amount:''});await load();}catch(e){setMsg(e.response?.data?.message||'Purchase failed')}};
  const doRepay=async e=>{e.preventDefault();try{const r=await API.post('/customer/repay',repay);setMsg(r.data.message);setRepay({...repay,amount:''});await load();}catch(e){setMsg(e.response?.data?.message||'Repayment failed')}};
  const toggleAuto=async enabled=>{try{const r=await API.patch('/customer/auto-settlement',{enabled,method:'SIMULATED_UPI'});setMsg(r.data.message);await load()}catch(e){setMsg(e.response?.data?.message||'Unable to update Auto Settlement')}};
  if(!d)return <Loading/>; const b=d.balance; const user=d.user;
  return <div className="wrap"><Title title="Customer Dashboard" sub="Credit, QR purchases, KYC and automatic settlement."/><div className="stats"><Stat label="Credit Limit" value={money(b.creditLimit)}/><Stat label="Available Credit" value={money(b.availableCredit)}/><Stat label="Outstanding" value={money(b.outstanding)}/><Stat label="Next Payment" value={money(b.outstanding)}/></div>{msg&&<div className="success">{msg}</div>}{user.kycStatus!=='approved'&&<div className="warning">KYC status: <b>{user.kycStatus}</b>. Admin approval is required for credit purchases.</div>}<div className="actions"><button className="btn" onClick={()=>setScanner(true)}><QrCode size={17}/> Scan Merchant QR</button><button className="btn" onClick={()=>document.getElementById('repay')?.scrollIntoView({behavior:'smooth'})}>Repay Credit</button><button className={user.autoSettlementEnabled?'btn green':'btn'} onClick={()=>toggleAuto(!user.autoSettlementEnabled)}>{user.autoSettlementEnabled?'Auto Settlement ON':'Enable Auto Settlement'}</button><button className="btn" onClick={load}><RefreshCw size={16}/> Refresh</button></div>
    <div className="grid2"><div className="card"><h3>Make Credit Purchase</h3><form onSubmit={manualPurchase}><label>Approved Merchant<select required value={manual.merchantId} onChange={e=>setManual({...manual,merchantId:e.target.value})}><option value="">Select merchant</option>{merchants.map(m=><option key={m._id} value={m._id}>{m.name} · {m.email}</option>)}</select></label><label>Amount<input type="number" min="1" step="0.01" required value={manual.amount} onChange={e=>setManual({...manual,amount:e.target.value})}/></label><button className="btn full">Pay on Credit</button></form></div><div className="card" id="repay"><h3>Repay Credit</h3><form onSubmit={doRepay}><label>Amount<input type="number" min="0.01" step="0.01" max={b.outstanding} required={b.outstanding>0} disabled={b.outstanding<=0} value={repay.amount} onChange={e=>setRepay({...repay,amount:e.target.value})}/></label><label>Method<select value={repay.method} onChange={e=>setRepay({...repay,method:e.target.value})}><option>SIMULATED_UPI</option><option>SIMULATED_CARD</option><option>SIMULATED_BANK</option></select></label><button className="btn full" disabled={b.outstanding<=0}>{b.outstanding<=0?'Nothing to repay':'Record Repayment'}</button></form></div></div>
    <KycUpload user={user} endpoint="/customer/kyc-documents" onDone={()=>load()}/><div className="card"><h3>Auto Settlement</h3><p>When enabled, the server performs a simulated full settlement of your outstanding credit every day at <b>{String(import.meta.env.VITE_AUTO_SETTLEMENT_HOUR || 8).padStart(2,'0')}:00</b> server time. It creates a repayment, settles eligible transactions and restores available credit.</p><button className={user.autoSettlementEnabled?'btn danger':'btn'} onClick={()=>toggleAuto(!user.autoSettlementEnabled)}>{user.autoSettlementEnabled?'Disable Auto Settlement':'Enable Auto Settlement'}</button></div>
    <Table title="Recent Purchases" rows={d.transactions} cols={['reference','merchant','amount','dueDate','status','settlementStatus']}/><Table title="Recent Repayments" rows={d.repayments} cols={['reference','amount','method','createdAt']}/>{scanner&&<div className="modalBack"><div className="modal"><button className="x" onClick={()=>setScanner(false)}>×</button><h2>Scan Merchant QR</h2><Scanner onScan={results=>{const v=results?.[0]?.rawValue||''; if(v.startsWith('smartcredit:merchant:')){setMerchantId(v.replace('smartcredit:merchant:',''));setScanner(false);setPayOpen(true)}else alert('Invalid Smart Credit QR')}}/><button className="btn full" onClick={()=>setScanner(false)}>Cancel</button></div></div>}{payOpen&&<div className="modalBack"><div className="modal"><button className="x" onClick={()=>setPayOpen(false)}>×</button><h2>Pay on Credit</h2><p>Merchant ID: <b>{merchantId}</b></p><label>Amount<input type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="btn full" onClick={purchase}>Confirm Purchase</button></div></div>}</div>;
}

function Merchant(){const [d,setD]=useState(null),[msg,setMsg]=useState(''),[form,setForm]=useState({customerId:'',amount:'',description:'Credit purchase',dueDate:''});const load=async()=>{try{const r=await API.get('/merchant/dashboard');setD(r.data);if(!form.customerId&&r.data.customers[0])setForm(f=>({...f,customerId:r.data.customers[0]._id}))}catch(e){setMsg(e.response?.data?.message||'Unable to load dashboard')}};useEffect(()=>{load()},[]);if(!d)return <Loading/>;const sale=async e=>{e.preventDefault();try{await API.post('/merchant/sale',form);setMsg('Credit sale created.');setForm({...form,amount:''});load()}catch(e){setMsg(e.response?.data?.message||'Sale failed')}};const qr=`smartcredit:merchant:${d.user._id}`;return <div className="wrap"><Title title="Merchant Dashboard" sub="Accept credit, generate your QR and track settlements."/><div className="stats"><Stat label="KYC" value={d.user.kycStatus}/><Stat label="Total Sales" value={money(d.total)}/><Stat label="Settled" value={money(d.settled)}/><Stat label="Pending Settlement" value={money(d.pendingSettlement)}/></div>{msg&&<div className="success">{msg}</div>}{d.user.kycStatus!=='approved'&&<div className="warning">Merchant KYC must be approved before accepting credit purchases.</div>}<div className="grid2"><div className="card qrCard"><h3>My Merchant QR</h3><QRCodeSVG value={qr} size={210}/><code>{qr}</code><p className="muted">Customers scan this QR to pay on credit.</p></div><div className="card"><h3>Create Credit Sale</h3><form onSubmit={sale}><label>Customer<select required value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}><option value="">Select customer</option>{d.customers.map(c=><option key={c._id} value={c._id}>{c.name} · Limit {money(c.creditLimit)}</option>)}</select></label><label>Amount<input type="number" min="1" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Due date<input type="date" required min={new Date().toISOString().slice(0,10)} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label><button className="btn full">Create Sale</button></form></div></div><KycUpload user={d.user} endpoint="/merchant/kyc-documents" onDone={()=>load()}/><Table title="Transaction History" rows={d.sales} cols={['reference','customer','amount','status','settlementStatus','createdAt']}/></div>}

function Admin(){const [d,setD]=useState(null),[msg,setMsg]=useState(''),[docs,setDocs]=useState(null);const load=async()=>{try{const r=await API.get('/admin/dashboard');setD(r.data)}catch(e){setMsg(e.response?.data?.message||'Unable to load admin dashboard')}};useEffect(()=>{load()},[]);if(!d)return <Loading/>;const kyc=async(id,status)=>{try{await API.patch(`/admin/user/${id}/kyc`,{status});setMsg(`KYC ${status}`);load()}catch(e){setMsg(e.response?.data?.message||'KYC update failed')}};const limit=async id=>{const v=prompt('Enter new customer credit limit');if(v!==null){try{await API.patch(`/admin/user/${id}/limit`,{creditLimit:Number(v)});load()}catch(e){setMsg(e.response?.data?.message||'Limit update failed')}}};const viewDocs=async id=>{try{const r=await API.get(`/admin/user/${id}/kyc-documents`);setDocs(r.data)}catch(e){setMsg(e.response?.data?.message||'Unable to load documents')}};const dispute=async id=>{await API.patch(`/admin/transaction/${id}/dispute`,{note:'Admin review'});load()};return <div className="wrap"><Title title="Admin Dashboard" sub="Approve KYC, manage credit and monitor settlements."/><div className="stats"><Stat label="Customers" value={d.stats.customers}/><Stat label="Merchants" value={d.stats.merchants}/><Stat label="Pending KYC" value={d.stats.pendingKyc}/><Stat label="Total Sales" value={money(d.stats.totalSales)}/></div>{msg&&<div className="success">{msg}</div>}<div className="card tableCard"><h3>User & KYC Management</h3><table><thead><tr><th>User</th><th>Role</th><th>KYC</th><th>Documents</th><th>Credit</th><th>Actions</th></tr></thead><tbody>{d.users.map(u=><tr key={u._id}><td>{u.name}<small>{u.email}</small></td><td>{u.role}</td><td>{u.kycStatus}</td><td>{u.kycDocuments?.length ? <button onClick={()=>viewDocs(u._id)}>View {u.kycDocuments.length}</button> : 'None'}</td><td>{u.role==='customer'?money(u.creditLimit):'—'}</td><td>{u.role!=='admin'&&<><button onClick={()=>kyc(u._id,'approved')}>Approve</button> <button onClick={()=>kyc(u._id,'rejected')}>Reject</button>{u.role==='customer'&&<button onClick={()=>limit(u._id)}>Set limit</button>}</>}</td></tr>)}</tbody></table></div><div className="card tableCard"><h3>Transactions & Settlement</h3><table><thead><tr><th>Reference</th><th>Customer</th><th>Merchant</th><th>Amount</th><th>Status</th><th>Settlement</th><th>Action</th></tr></thead><tbody>{d.transactions.map(t=><tr key={t._id}><td>{t.reference}</td><td>{t.customer?.name}</td><td>{t.merchant?.name}</td><td>{money(t.amount)}</td><td>{t.status}</td><td>{t.settlementStatus}</td><td>{t.status!=='disputed'&&t.status!=='paid'&&<button onClick={()=>dispute(t._id)}>Dispute</button>}</td></tr>)}</tbody></table></div>{docs&&<div className="modalBack"><div className="modal"><button className="x" onClick={()=>setDocs(null)}>×</button><h2>KYC Documents</h2><p><b>{docs.name}</b> · {docs.role} · {docs.kycStatus}</p>{docs.kycDocuments?.length?docs.kycDocuments.map(x=><a className="docLink" key={x._id} href={fileUrl(x.url)} target="_blank" rel="noreferrer">Open {x.type}: {x.originalName}</a>):<p>No documents uploaded.</p>}</div></div>}</div>}

function Stat({label,value}){return <div className="stat"><span>{label}</span><b>{value}</b></div>}
function Title({title,sub}){return <div className="title"><div><span className="tag">SMART CREDIT</span><h1>{title}</h1><p>{sub}</p></div></div>}
function Loading(){return <div className="wrap"><p>Loading...</p></div>}
function Table({title,rows,cols}){return <div className="card tableCard"><h3>{title}</h3>{rows?.length?<table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r._id}>{cols.map(c=><td key={c}>{c==='amount'?money(r[c]):c==='merchant'?r[c]?.name||'—':c==='customer'?r[c]?.name||'—':['dueDate','createdAt'].includes(c)&&r[c]?new Date(r[c]).toLocaleString():r[c] ?? '—'}</td>)}</tr>)}</tbody></table>:<p className="muted">No records yet.</p>}</div>}

export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/register" element={<Auth mode="register"/>}/><Route path="/dashboard" element={<Dashboard/>}/></Routes></Layout>}
