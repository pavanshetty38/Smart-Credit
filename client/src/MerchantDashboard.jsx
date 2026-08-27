import React from "react";
import { useEffect, useState } from "react";
import api from "./api";

export default function MerchantDashboard() {
  const [data,setData]=useState({stats:{},transactions:[],customers:[],user:{}});
  const [notifications,setNotifications]=useState([]);
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    try { const r=await api.get("/merchant/dashboard"); setData(r.data); } catch {}
    try { const r=await api.get("/notifications"); setNotifications(r.data.notifications||r.data||[]); } catch {}
  };
  useEffect(()=>{load()},[]);

  const logout=()=>{localStorage.clear();location.href="/login"};
  const s=data.stats||{};
  const qr=`smartcredit:merchant:${data.user?._id || JSON.parse(localStorage.getItem("user")||"{}")._id || ""}`;

  const downloadQR=()=>{
    const text=encodeURIComponent(qr);
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${text}`,"_blank");
  };

  return <div className="dashboard">
    <header className="topbar"><div><div className="brand">Smart Credit</div><h1>Merchant Dashboard</h1><p className="muted">Welcome, {data.user?.name || JSON.parse(localStorage.getItem("user")||"{}").name || "Merchant"}</p></div><button className="danger" onClick={logout}>Logout</button></header>
    <div className="cards">
      <Card title="Total Sales" value={`₹${Number(s.totalSales||0).toLocaleString()}`} sub="Total amount received"/>
      <Card title="Today's Sales" value={`₹${Number(s.todaySales||0).toLocaleString()}`} sub="Today's transactions"/>
      <Card title="Total Transactions" value={Number(s.totalTransactions||data.transactions?.length||0)} sub="Successful transactions"/>
      <Card title="Pending Payments" value={`₹${Number(s.pendingPayments||0).toLocaleString()}`} sub="Still outstanding"/>
    </div>
    <div className="actionbar"><button className="primary" onClick={downloadQR}>My QR Code</button><button className="secondary" onClick={load} disabled={busy}>Refresh</button></div>
    <section className="panel"><h2>Merchant Information</h2><p><b>Name:</b> {data.user?.name||"-"}</p><p><b>Email:</b> {data.user?.email||"-"}</p><p><b>KYC:</b> {data.user?.kycStatus||"-"}</p></section>
    <section className="panel"><h2>Notifications</h2>{notifications.length?notifications.slice(0,8).map((n,i)=><div className="list-row" key={n._id||i}><div><b>{n.title||"Smart Credit"}</b><p>{n.message||""}</p></div></div>):<p className="muted">No notifications.</p>}</section>
    <section className="panel"><h2>Transaction History</h2>{data.transactions?.length?data.transactions.map((t,i)=><div className="list-row" key={t._id||i}><div><b>{t.reference||"Transaction"}</b><p>{t.customer?.name||"Customer"} · {t.status||"approved"}</p></div><strong>₹{Number(t.amount||0).toLocaleString()}</strong></div>):<p className="muted">No transactions yet.</p>}</section>
  </div>;
}
function Card({title,value,sub}){return <div className="card"><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>}
