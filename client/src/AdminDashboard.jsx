import { useEffect, useState } from "react";
import api from "./api";

export default function AdminDashboard(){
  const [data,setData]=useState({users:[],transactions:[],stats:{}});
  const [error,setError]=useState("");

  const load=async()=>{
    setError("");
    try{const r=await api.get("/admin/dashboard");setData(r.data)}catch(e){setError(e.response?.data?.message||"Unable to load admin dashboard")}
  };
  useEffect(()=>{load()},[]);

  const updateKyc = async (id, status) => {
  try {
    setError("");

    const response = await api.patch(
      `/admin/user/${id}/kyc`,
      { status }
    );

    console.log("KYC update:", response.data);

    await load();

  } catch (e) {
    console.error("KYC update error:", e);

    setError(
      e.response?.data?.message ||
      "Unable to update KYC"
    );
  }
};
  const logout=()=>{localStorage.clear();location.href="/login"};
  const s=data.stats||{};
  const pending=(data.users||[]).filter(u=>u.role==="merchant"&&u.kycStatus==="pending");

  return <div className="dashboard">
    <header className="topbar"><div><div className="brand">Smart Credit</div><h1>Admin Dashboard</h1><p className="muted">System administration</p></div><button className="danger" onClick={logout}>Logout</button></header>
    {error&&<div className="alert error">{error}</div>}
    <div className="cards">
      <Card title="Customers" value={s.customers||0} sub="Registered customers"/>
      <Card title="Merchants" value={s.merchants||0} sub="Registered merchants"/>
      <Card title="Pending KYC" value={s.pendingKyc||pending.length} sub="Awaiting approval"/>
      <Card title="Total Sales" value={`₹${Number(s.totalSales||0).toLocaleString()}`} sub="Platform sales"/>
    </div>
    <section className="panel"><h2>Pending Merchant Approvals</h2>{pending.length?pending.map(u=><div className="list-row" key={u._id}><div><b>{u.name}</b><p>{u.email}</p><small>KYC: {u.kycStatus}</small></div><div className="row-actions"><button className="primary small" onClick={()=>updateKyc(u._id,"approved")}>Approve</button><button className="danger small" onClick={()=>updateKyc(u._id,"rejected")}>Reject</button></div></div>):<p className="muted">No pending merchant approvals.</p>}</section>
    <section className="panel"><h2>Registered Users</h2>{data.users?.length?data.users.map(u=><div className="list-row" key={u._id}><div><b>{u.name}</b><p>{u.email}</p></div><div><b>{u.role}</b><p>KYC: {u.kycStatus||"pending"}</p></div></div>):<p className="muted">No users found.</p>}</section>
    <section className="panel"><h2>Recent Transactions</h2>{data.transactions?.length?data.transactions.map(t=><div className="list-row" key={t._id}><div><b>{t.reference||"Transaction"}</b><p>{t.customer?.name||"Customer"} → {t.merchant?.name||"Merchant"}</p></div><div><strong>₹{Number(t.amount||0).toLocaleString()}</strong><p>{t.status}</p></div></div>):<p className="muted">No transactions yet.</p>}</section>
  </div>
}
function Card({title,value,sub}){return <div className="card"><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>}
