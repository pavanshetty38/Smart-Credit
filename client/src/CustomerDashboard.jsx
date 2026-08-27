import React, { useEffect, useState, useRef } from "react";
import {
  CreditCard,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Store,
  Wallet,
  ShieldCheck,
  TrendingUp,
  Percent,
  X,
  Camera,
  Check
} from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import api from "./api";

export default function CustomerDashboard() {
  const [balance, setBalance] = useState({
    creditLimit: 0,
    availableCredit: 0,
    outstanding: 0,
  });

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [merchants, setMerchants] = useState([]);

  // Purchase State
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Repayment State
  const [repayAmount, setRepayAmount] = useState("");
  const [repayMethod, setRepayMethod] = useState("SIMULATED_UPI");

  // UI State
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [qrScanError, setQrScanError] = useState("");
  const [manualQrInput, setManualQrInput] = useState("");

  const notifRef = useRef(null);

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const load = async () => {
    try {
      const r = await api.get("/customer/dashboard");
      if (r.data.balance) {
        setBalance(r.data.balance);
      }
      if (r.data.user) {
        setUser(r.data.user);
      }
      setTransactions(r.data.transactions || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    }

    try {
      const r = await api.get("/notifications");
      const notifs = r.data.notifications || (Array.isArray(r.data) ? r.data : []);
      setNotifications(notifs);
      setUnreadNotifs(r.data.unread !== undefined ? r.data.unread : notifs.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Notification error:", err);
    }

    try {
      const r = await api.get("/customer/merchants");
      setMerchants(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      console.error("Merchant loading error:", err);
      setMerchants([]);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------
  // QR PARSING & SCANNING
  // ---------------------------------------------
  const handleQrData = (dataStr) => {
    if (!dataStr) return;
    setQrScanError("");

    let targetId = dataStr.trim();
    // Support "smartcredit:merchant:ID" or raw Mongo ObjectId or JSON
    if (targetId.startsWith("smartcredit:merchant:")) {
      targetId = targetId.replace("smartcredit:merchant:", "").trim();
    } else if (targetId.startsWith("{")) {
      try {
        const parsed = JSON.parse(targetId);
        targetId = parsed.merchantId || parsed.id || parsed._id || targetId;
      } catch (e) {}
    }

    // Match against approved merchants
    const found = merchants.find((m) => m._id === targetId || m.email === targetId);
    if (found) {
      setMerchantId(found._id);
      setShowQrScanner(false);
      setMessage(`Merchant "${found.name}" selected from QR code!`);
    } else if (targetId.length === 24) {
      // Valid Mongo ObjectId length
      setMerchantId(targetId);
      setShowQrScanner(false);
      setMessage(`Merchant QR scanned successfully.`);
    } else {
      setQrScanError(`Could not find a valid merchant from QR data: "${dataStr}"`);
    }
  };

  // ---------------------------------------------
  // CREDIT PURCHASE
  // ---------------------------------------------
  const purchase = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!merchantId) {
      setError("Please select or scan a merchant.");
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    if (numAmount > balance.availableCredit) {
      setError(`Amount exceeds your available credit (₹${balance.availableCredit.toLocaleString("en-IN")}).`);
      return;
    }

    setBusy(true);

    try {
      const r = await api.post("/customer/purchase", {
        merchantId,
        amount: numAmount,
        description: description || "Credit purchase",
      });

      if (r.data.balance) {
        setBalance(r.data.balance);
      }

      setMessage(r.data.message || `Payment of ₹${numAmount.toLocaleString("en-IN")} successful!`);
      setAmount("");
      setDescription("");
      setMerchantId("");

      await load();
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err.response?.data?.message || "Credit purchase failed.");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------
  // REPAYMENT
  // ---------------------------------------------
  const repayment = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const numRepay = Number(repayAmount);
    if (!numRepay || numRepay <= 0) {
      setError("Please enter a valid repayment amount.");
      return;
    }

    if (numRepay > balance.outstanding) {
      setError(`Repayment cannot exceed outstanding balance of ₹${balance.outstanding.toLocaleString("en-IN")}.`);
      return;
    }

    setBusy(true);

    try {
      const r = await api.post("/customer/repay", {
        amount: numRepay,
        method: repayMethod,
      });

      if (r.data.balance) {
        setBalance(r.data.balance);
      }

      setMessage(r.data.message || `Repayment of ₹${numRepay.toLocaleString("en-IN")} recorded successfully!`);
      setRepayAmount("");

      await load();
    } catch (err) {
      console.error("Repayment error:", err);
      setError(err.response?.data?.message || "Repayment failed.");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------
  // NOTIFICATIONS ACTIONS
  // ---------------------------------------------
  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadNotifs((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotifs(0);
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  // Utilization calculation
  const limit = Number(balance.creditLimit) || 0;
  const outstanding = Number(balance.outstanding) || 0;
  const available = Number(balance.availableCredit) || 0;
  const utilizationPct = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;

  const selectedMerchantObj = merchants.find((m) => m._id === merchantId);

  return (
    <div className="dashboard customer-dashboard-view">
      {/* ========================================================================= */}
      {/* TOPBAR */}
      {/* ========================================================================= */}
      <header className="topbar">
        <div>
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-box" style={{ width: "24px", height: "24px", borderRadius: "6px" }}>
              <CreditCard size={14} color="#fff" />
            </div>
            SmartCredit
          </div>
          <h1>Customer Dashboard</h1>
          <p className="muted">
            Welcome, {user?.name || "Customer"} • KYC:{" "}
            <span className={`badge badge-${user?.kycStatus || "pending"}`}>
              {(user?.kycStatus || "pending").toUpperCase()}
            </span>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Notification Bell Menu */}
          <div className="notif-wrapper" ref={notifRef} style={{ position: "relative" }}>
            <button
              className="notif-bell-btn"
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotifs > 0 && <span className="bell-badge-pulse">{unreadNotifs}</span>}
            </button>

            {/* Notification Dropdown Popover */}
            {showNotifMenu && (
              <div className="notif-dropdown-popover">
                <div className="notif-popover-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong>Notifications</strong>
                    {unreadNotifs > 0 && (
                      <span className="badge badge-customer">{unreadNotifs} new</span>
                    )}
                  </div>
                  {unreadNotifs > 0 && (
                    <button className="notif-mark-all-btn" onClick={markAllAsRead}>
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="notif-popover-list">
                  {notifications.length > 0 ? (
                    notifications.map((n, i) => (
                      <div
                        key={n._id || i}
                        className={`notif-item ${!n.read ? "unread" : ""}`}
                        onClick={() => !n.read && markAsRead(n._id)}
                      >
                        <div className="notif-item-icon">
                          {n.category === "purchase" ? (
                            <ArrowUpRight size={16} color="#2563eb" />
                          ) : n.category === "repayment" ? (
                            <CheckCircle2 size={16} color="#16a34a" />
                          ) : (
                            <Bell size={16} color="#64748b" />
                          )}
                        </div>
                        <div className="notif-item-body">
                          <p className="notif-item-title">{n.title || "Smart Credit Notification"}</p>
                          <p className="notif-item-text">{n.message || n.text || ""}</p>
                          <span className="notif-item-time">
                            {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : "Just now"}
                          </span>
                        </div>
                        {!n.read && <span className="unread-dot"></span>}
                      </div>
                    ))
                  ) : (
                    <div className="notif-empty-state">
                      <Bell size={28} color="#94a3b8" />
                      <p>No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="secondary small" onClick={load} disabled={busy}>
            <RefreshCw size={14} style={{ marginRight: "4px" }} /> Refresh
          </button>
          <button className="danger small" onClick={logout}>
            <LogOut size={14} style={{ marginRight: "4px" }} /> Logout
          </button>
        </div>
      </header>

      {/* Global Alerts */}
      {error && (
        <div className="alert error" style={{ width: "86%", margin: "20px auto 0" }}>
          <AlertCircle size={18} style={{ marginRight: "8px", verticalAlign: "middle" }} />
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" style={{ width: "86%", margin: "20px auto 0" }}>
          <CheckCircle2 size={18} style={{ marginRight: "8px", verticalAlign: "middle" }} />
          {message}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATS CARDS */}
      {/* ========================================================================= */}
      <div className="cards">
        <div className="card stat-card-highlight">
          <span>Credit Limit</span>
          <strong>₹{limit.toLocaleString("en-IN")}</strong>
          <small>Approved platform credit</small>
        </div>

        <div className="card">
          <span>Available Credit</span>
          <strong style={{ color: "#16a34a" }}>₹{available.toLocaleString("en-IN")}</strong>
          <small>Ready to spend instantly</small>
        </div>

        <div className="card">
          <span>Outstanding Balance</span>
          <strong style={{ color: outstanding > 0 ? "#dc2626" : "#475569" }}>
            ₹{outstanding.toLocaleString("en-IN")}
          </strong>
          <small>{outstanding > 0 ? "Due for repayment" : "Zero outstanding dues"}</small>
        </div>

        <div className="card">
          <span>Credit Utilization</span>
          <strong>{utilizationPct}%</strong>
          <small>{utilizationPct > 70 ? "High credit utilization" : "Healthy credit balance"}</small>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN ACTIONS GRID: CREDIT PURCHASE & REPAYMENT */}
      {/* ========================================================================= */}
      <div className="customer-actions-grid">
        {/* ===================================================== */}
        {/* 1. CREDIT PURCHASE CARD */}
        {/* ===================================================== */}
        <section className="panel action-panel purchase-panel">
          <div className="panel-header-clean">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="action-icon-box purchase-icon">
                <CreditCard size={20} color="#2563eb" />
              </div>
              <div>
                <h2>Make Credit Purchase</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Pay merchants instantly on credit with QR or select merchant
                </p>
              </div>
            </div>

            <button
              type="button"
              className="primary small btn-scan-qr-cta"
              onClick={() => setShowQrScanner(true)}
              title="Scan Merchant QR code"
            >
              <QrCode size={16} style={{ marginRight: "6px" }} /> Scan Merchant QR
            </button>
          </div>

          {/* Selected Merchant Status Banner */}
          {selectedMerchantObj ? (
            <div className="selected-merchant-banner">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Store size={18} color="#2563eb" />
                <div>
                  <strong>{selectedMerchantObj.name}</strong>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    {selectedMerchantObj.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="close-merchant-btn"
                onClick={() => setMerchantId("")}
                title="Change merchant"
              >
                ✕ Change
              </button>
            </div>
          ) : null}

          <form onSubmit={purchase} className="credit-purchase-form">
            {!selectedMerchantObj && (
              <div className="form-group">
                <label>Select Merchant</label>
                {merchants.length > 0 ? (
                  <select
                    required
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="styled-select"
                  >
                    <option value="">-- Choose an approved merchant --</option>
                    {merchants.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="muted">No approved merchants available currently.</p>
                )}
              </div>
            )}

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Amount (₹)</label>
                <span className="avail-hint">
                  Available: <strong>₹{available.toLocaleString("en-IN")}</strong>
                </span>
              </div>
              <div className="amount-input-wrapper">
                <span className="currency-symbol">₹</span>
                <input
                  required
                  type="number"
                  min="1"
                  max={available}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="amount-input"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="quick-amount-chips">
                <button
                  type="button"
                  className="amount-chip"
                  onClick={() => setAmount("500")}
                  disabled={available < 500}
                >
                  +₹500
                </button>
                <button
                  type="button"
                  className="amount-chip"
                  onClick={() => setAmount("1000")}
                  disabled={available < 1000}
                >
                  +₹1,000
                </button>
                <button
                  type="button"
                  className="amount-chip"
                  onClick={() => setAmount("2500")}
                  disabled={available < 2500}
                >
                  +₹2,500
                </button>
                <button
                  type="button"
                  className="amount-chip max-chip"
                  onClick={() => setAmount(String(available))}
                  disabled={available <= 0}
                >
                  Max Available
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Purchase Note / Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Grocery purchase, Electronics, Cafe"
                className="styled-input"
              />
            </div>

            <button
              type="submit"
              className="primary purchase-submit-btn"
              disabled={busy || !merchantId || !amount || Number(amount) <= 0 || Number(amount) > available}
            >
              {busy ? "Processing Purchase..." : `Pay ₹${Number(amount || 0).toLocaleString("en-IN")} on Credit`}
            </button>
          </form>
        </section>

        {/* ===================================================== */}
        {/* 2. IMPROVED REPAY CREDIT PANEL */}
        {/* ===================================================== */}
        <section className="panel action-panel repay-panel">
          <div className="panel-header-clean">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="action-icon-box repay-icon">
                <TrendingUp size={20} color="#16a34a" />
              </div>
              <div>
                <h2>Repay Credit Balance</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Clear dues to restore your available credit instantly
                </p>
              </div>
            </div>
          </div>

          {/* Outstanding Utilization Visual Progress Bar */}
          <div className="repay-visual-box">
            <div className="utilization-header">
              <span>Credit Utilization Progress</span>
              <strong>{utilizationPct}% Utilized</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${utilizationPct}%`,
                  background:
                    utilizationPct > 80
                      ? "#dc2626"
                      : utilizationPct > 50
                      ? "#f59e0b"
                      : "#2563eb",
                }}
              ></div>
            </div>

            <div className="progress-labels">
              <span>Outstanding: ₹{outstanding.toLocaleString("en-IN")}</span>
              <span>Total Limit: ₹{limit.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <form onSubmit={repayment} className="repay-form">
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Repayment Amount (₹)</label>
                <span className="avail-hint">
                  Due: <strong>₹{outstanding.toLocaleString("en-IN")}</strong>
                </span>
              </div>
              <div className="amount-input-wrapper">
                <span className="currency-symbol">₹</span>
                <input
                  required
                  type="number"
                  min="1"
                  max={outstanding}
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={outstanding <= 0}
                  className="amount-input"
                />
              </div>

              {/* Repay Percentage Presets */}
              {outstanding > 0 && (
                <div className="quick-amount-chips">
                  <button
                    type="button"
                    className="amount-chip"
                    onClick={() => setRepayAmount(String(Math.round(outstanding * 0.25)))}
                  >
                    25% (₹{Math.round(outstanding * 0.25).toLocaleString("en-IN")})
                  </button>
                  <button
                    type="button"
                    className="amount-chip"
                    onClick={() => setRepayAmount(String(Math.round(outstanding * 0.5)))}
                  >
                    50% (₹{Math.round(outstanding * 0.5).toLocaleString("en-IN")})
                  </button>
                  <button
                    type="button"
                    className="amount-chip full-repay-chip"
                    onClick={() => setRepayAmount(String(outstanding))}
                  >
                    100% Full Repay
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="form-group">
              <label>Select Simulated Payment Method</label>
              <div className="payment-method-selector">
                <label
                  className={`payment-method-card ${repayMethod === "SIMULATED_UPI" ? "active" : ""}`}
                  onClick={() => setRepayMethod("SIMULATED_UPI")}
                >
                  <input
                    type="radio"
                    name="method"
                    value="SIMULATED_UPI"
                    checked={repayMethod === "SIMULATED_UPI"}
                    onChange={() => {}}
                  />
                  <span>📱 UPI (GPay / PhonePe / Paytm)</span>
                </label>

                <label
                  className={`payment-method-card ${repayMethod === "SIMULATED_NETBANKING" ? "active" : ""}`}
                  onClick={() => setRepayMethod("SIMULATED_NETBANKING")}
                >
                  <input
                    type="radio"
                    name="method"
                    value="SIMULATED_NETBANKING"
                    checked={repayMethod === "SIMULATED_NETBANKING"}
                    onChange={() => {}}
                  />
                  <span>🏦 Net Banking</span>
                </label>

                <label
                  className={`payment-method-card ${repayMethod === "SIMULATED_CARD" ? "active" : ""}`}
                  onClick={() => setRepayMethod("SIMULATED_CARD")}
                >
                  <input
                    type="radio"
                    name="method"
                    value="SIMULATED_CARD"
                    checked={repayMethod === "SIMULATED_CARD"}
                    onChange={() => {}}
                  />
                  <span>💳 Debit Card</span>
                </label>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            {Number(repayAmount) > 0 && (
              <div className="repay-impact-preview">
                <div>
                  <small>New Available Credit:</small>
                  <strong>₹{(available + Number(repayAmount)).toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  <small>Remaining Outstanding:</small>
                  <strong>₹{Math.max(0, outstanding - Number(repayAmount)).toLocaleString("en-IN")}</strong>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="primary btn-repay-submit"
              disabled={busy || outstanding <= 0 || !repayAmount || Number(repayAmount) <= 0 || Number(repayAmount) > outstanding}
            >
              {busy ? "Processing Repayment..." : outstanding <= 0 ? "No Outstanding Dues" : `Repay ₹${Number(repayAmount || 0).toLocaleString("en-IN")}`}
            </button>
          </form>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* RECENT TRANSACTIONS */}
      {/* ========================================================================= */}
      <section className="panel" style={{ width: "86%", margin: "30px auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2>Transaction History</h2>
          <span className="muted" style={{ fontSize: "13px" }}>
            Total {transactions.length} record(s)
          </span>
        </div>

        {transactions.length ? (
          transactions.map((t, i) => (
            <div className="list-row" key={t._id || i}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className={`tx-type-icon ${t.status === "paid" ? "tx-paid" : "tx-credit"}`}>
                  {t.status === "paid" ? <Check size={16} /> : <CreditCard size={16} />}
                </div>
                <div>
                  <b>{t.description || t.reference || "Credit Purchase"}</b>
                  <p>
                    {t.merchant ? `Merchant: ${t.merchant.name}` : "Direct Transaction"} • Ref: {t.reference}
                  </p>
                  <small>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}</small>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: "16px" }}>₹{Number(t.amount || 0).toLocaleString("en-IN")}</strong>
                <p style={{ marginTop: "4px" }}>
                  <span className={`badge badge-${t.status}`}>{t.status?.toUpperCase()}</span>
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No transactions recorded yet.</p>
        )}
      </section>

      {/* ========================================================================= */}
      {/* QR SCANNER MODAL */}
      {/* ========================================================================= */}
      {showQrScanner && (
        <div className="modal-overlay" onClick={() => setShowQrScanner(false)}>
          <div className="modal-content qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="logo-box" style={{ width: "28px", height: "28px", borderRadius: "6px" }}>
                  <QrCode size={16} color="#fff" />
                </div>
                <div>
                  <h3>Scan Merchant QR</h3>
                  <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                    Point camera at merchant QR code or select test merchant below
                  </p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowQrScanner(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body qr-modal-body">
              {/* Camera Scanner View */}
              <div className="scanner-container-box">
                <Scanner
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      const raw = result[0].rawValue;
                      handleQrData(raw);
                    }
                  }}
                  onError={(err) => {
                    console.log("Scanner notice/fallback:", err?.message);
                  }}
                />
                <div className="scanner-laser-bar"></div>
              </div>

              {qrScanError && (
                <div className="alert error" style={{ margin: "14px 0", fontSize: "13px" }}>
                  {qrScanError}
                </div>
              )}

              {/* Fallback Option: 1-Click Approved Merchant Presets */}
              <div className="qr-manual-helpers">
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#334155", margin: "14px 0 8px" }}>
                  Or select directly from approved merchants:
                </p>
                <div className="merchant-qr-pills">
                  {merchants.length > 0 ? (
                    merchants.map((m) => (
                      <button
                        key={m._id}
                        type="button"
                        className="merchant-qr-pill-btn"
                        onClick={() => {
                          setMerchantId(m._id);
                          setShowQrScanner(false);
                          setMessage(`Selected ${m.name}`);
                        }}
                      >
                        <Store size={14} style={{ marginRight: "4px" }} />
                        {m.name}
                      </button>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: "13px" }}>
                      No approved merchants found.
                    </span>
                  )}
                </div>

                {/* Paste raw QR string */}
                <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Paste QR text (e.g. smartcredit:merchant:ID)"
                    value={manualQrInput}
                    onChange={(e) => setManualQrInput(e.target.value)}
                    className="styled-input"
                    style={{ fontSize: "13px", padding: "8px 12px" }}
                  />
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => handleQrData(manualQrInput)}
                    disabled={!manualQrInput}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setShowQrScanner(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}