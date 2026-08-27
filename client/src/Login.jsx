import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      const token = data.token || data.accessToken;
      const user = data.user || data.account;
      if (token) localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      const role = user?.role;
      navigate(role === "admin" ? "/admin" : role === "merchant" ? "/merchant" : "/customer");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">Smart Credit</div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your account</p>
        {error && <div className="alert error">{error}</div>}
        <label>Email</label>
        <input type="email" value={form.email} required onChange={e => setForm({...form, email:e.target.value})} />
        <label>Password</label>
        <input type="password" value={form.password} required onChange={e => setForm({...form, password:e.target.value})} />
        <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Login"}</button>
        <p className="auth-link">Don't have an account? <a href="/register">Register</a></p>
      </form>
    </div>
  );
}
