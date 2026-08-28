import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "./api";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"customer" });
  const [kycFile, setKycFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      let data;
      if (kycFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k,v]) => fd.append(k,v));
        fd.append("kycDocument", kycFile);
        const res = await api.post("/auth/register", fd, { headers: {"Content-Type":"multipart/form-data"} });
        data = res.data;
      } else {
        const res = await api.post("/auth/register", form);
        data = res.data;
      }
      setMessage(data.message || "Registration successful. You can login now.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">Smart Credit</div>
        <h1>Create account</h1>
        <p className="muted">Customer or merchant registration</p>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <label>Name</label>
        <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <label>Email</label>
        <input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <label>Password</label>
        <input type="password" minLength="6" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        <label>Account type</label>
        <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
          <option value="customer">Customer</option>
          <option value="merchant">Merchant</option>
        </select>
        <label>KYC document (optional)</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setKycFile(e.target.files?.[0] || null)}/>
        <button className="primary" disabled={busy}>{busy ? "Creating..." : "Register"}</button>
        <p className="auth-link">Already registered? <Link to="/login">Login</Link></p>
      </form>
    </div>
  );
}
