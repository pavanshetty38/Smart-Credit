import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Check,
  Clock,
  Zap,
  Sparkles,
  CheckCheck
} from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import api from "./api";

export default function CustomerDashboard() {
  const navigate = useNavigate();

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

  // Auto Settlement State
  const [autoSettlementEnabled, setAutoSettlementEnabled] = useState(false);
  const [autoSettlementMethod, setAutoSettlementMethod] = useState("SIMULATED_AUTO_DEBIT");
  const [settlements, setSettlements] = useState([]);
  const [settleBusy, setSettleBusy] = useState(false);

  // Purchase State
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Repayment State
  const [repayAmount, setRepayAmount] = useState("");
  const [repayMethod, setRepayMethod] = useState("SIMULATED_UPI");

  // KYC Modal State
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycFile, setKycFile] = useState(null);
  const [kycDocType, setKycDocType] = useState("aadhaar");
  const [kycBusy, setKycBusy] = useState(false);

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
        setAutoSettlementEnabled(Boolean(r.data.user.autoSettlementEnabled));
        if (r.data.user.autoSettlementMethod) {
          setAutoSettlementMethod(r.data.user.autoSettlementMethod);
        }
      }
      setTransactions(r.data.transactions || []);
      if (r.data.settlements) {
        setSettlements(r.data.settlements);
      }
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

  // ---------------------------------------------
  // AUTO SETTLEMENT ACTIONS
  // ---------------------------------------------
  const handleToggleAutoSettlement = async (enabled) => {
    setSettleBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.patch("/customer/auto-settlement", {
        enabled,
        method: autoSettlementMethod,
      });
      setAutoSettlementEnabled(enabled);
      if (res.data.user) setUser(res.data.user);
      setMessage(
        res.data.message ||
          (enabled
            ? "Auto Settlement enabled! Your dues will automatically settle every morning at 08:00 AM."
            : "Auto Settlement disabled.")
      );
    } catch (err) {
      console.error("Auto settlement toggle error:", err);
      setError(err.response?.data?.message || "Failed to update auto settlement.");
    } finally {
      setSettleBusy(false);
    }
  };

  const handleChangeAutoSettlementMethod = async (method) => {
    setAutoSettlementMethod(method);
    setSettleBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.patch("/customer/auto-settlement", {
        enabled: autoSettlementEnabled,
        method,
      });
      if (res.data.user) setUser(res.data.user);
      setMessage(`Auto Settlement method set to ${method.replace("SIMULATED_", "")}`);
    } catch (err) {
      console.error("Auto settlement method error:", err);
      setError(err.response?.data?.message || "Failed to update settlement method.");
    } finally {
      setSettleBusy(false);
    }
  };

  const handleRunInstantAutoSettlement = async () => {
    setSettleBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/customer/auto-settlement/run");
      if (res.data.balance) setBalance(res.data.balance);
      if (res.data.user) setUser(res.data.user);
      if (res.data.settlements) setSettlements(res.data.settlements);
      if (res.data.transactions) setTransactions(res.data.transactions);
      setMessage(res.data.message || "Auto settlement executed successfully!");
      await load();
    } catch (err) {
      console.error("Instant auto settlement error:", err);
      setError(err.response?.data?.message || "Instant auto settlement failed.");
    } finally {
      setSettleBusy(false);
    }
  };

  // ---------------------------------------------
  // KYC ACTIONS
  // ---------------------------------------------
  const getFileUrl = (doc) => {
    if (!doc) return "";
    if (typeof doc === "string") return doc;
    if (doc.dataUrl) return doc.dataUrl;
    if (doc.url && (doc.url.startsWith("data:") || doc.url.startsWith("http://") || doc.url.startsWith("https://") || doc.url.startsWith("blob:"))) {
      return doc.url;
    }
    let rawUrl = doc.url || (doc.filename ? `/uploads/kyc/${doc.filename}` : "");
    if (!rawUrl) return "";
    let apiBase = (import.meta.env.VITE_API_URL || api.defaults?.baseURL || "").trim();
    if (!apiBase || apiBase.startsWith("/") || (apiBase.includes("localhost") && window.location.hostname !== "localhost")) {
      apiBase = window.location.origin;
    }
    const backendBase = apiBase.replace(/\/api\/?$/, "");
    return `${backendBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  };

  const uploadKycDoc = async (e) => {
    e.preventDefault();
    if (!kycFile) {
      setError("Please select a KYC document file to upload.");
      return;
    }
    setKycBusy(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("documents", kycFile);
      fd.append("types", kycDocType);
      const res = await api.post("/customer/kyc-documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.user) setUser(res.data.user);
      setMessage(res.data.message || "KYC document uploaded successfully! Admin verification pending.");
      setKycFile(null);
      await load();
    } catch (err) {
      console.error("KYC upload error:", err);
      setError(err.response?.data?.message || "Failed to upload KYC document.");
    } finally {
      setKycBusy(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/");
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
            <button
              type="button"
              className="secondary small"
              style={{ marginLeft: "10px", padding: "3px 8px", fontSize: "11px" }}
              onClick={() => setShowKycModal(true)}
            >
              📄 KYC Documents ({user?.kycDocuments?.length || 0})
            </button>
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
      {/* 3. AUTO SETTLEMENT MANAGEMENT PANEL */}
      {/* ========================================================================= */}
      <section className="panel auto-settlement-panel">
        <div className="auto-settle-header">
          <div className="auto-settle-title-area">
            <div className="auto-settle-icon">
              <Zap size={22} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0 }}>Customer Auto Settlement</h2>
                <span className={`badge ${autoSettlementEnabled ? "badge-approved" : "badge-pending"}`}>
                  {autoSettlementEnabled ? "AUTO ACTIVE" : "PAUSED"}
                </span>
              </div>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "13px" }}>
                Automatically clear all outstanding credit dues every morning at 08:00 AM next day
              </p>
            </div>
          </div>

          <div className="auto-settle-toggle-container">
            <span style={{ fontSize: "14px", fontWeight: 600, color: autoSettlementEnabled ? "#16a34a" : "#64748b" }}>
              {autoSettlementEnabled ? "Auto Settle ON" : "Auto Settle OFF"}
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoSettlementEnabled}
                onChange={(e) => handleToggleAutoSettlement(e.target.checked)}
                disabled={settleBusy}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div className="auto-settle-content">
          {/* Left: Schedule Information & Benefits */}
          <div className="schedule-info-card">
            <div className="schedule-badge-pill">
              <span className="schedule-pulse-dot"></span>
              <Clock size={14} />
              <span>Next Run: Daily Morning at 08:00 AM</span>
            </div>

            <p style={{ fontSize: "13.5px", color: "#1e293b", lineHeight: 1.5, margin: 0 }}>
              {autoSettlementEnabled ? (
                <>
                  When enabled, your outstanding balance (<strong>₹{outstanding.toLocaleString("en-IN")}</strong>) will be automatically debited and settled at <strong>08:00 AM</strong> tomorrow morning via your chosen method.
                </>
              ) : (
                <>
                  Enable Auto Settlement to automatically clear your credit dues every morning at <strong>08:00 AM</strong>, avoid late payment risks, and keep your full credit limit available.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: "16px", fontSize: "12.5px", color: "#475569" }}>
              <span>✓ Zero Late Fees</span>
              <span>✓ Instant Limit Restoration</span>
              <span>✓ Auto Notification</span>
            </div>
          </div>

          {/* Right: Payment Method & Instant Trigger */}
          <div className="auto-settle-actions-box">
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                Settlement Payment Method
              </label>
              <div className="method-picker-grid">
                <div
                  className={`method-option-pill ${autoSettlementMethod === "SIMULATED_AUTO_DEBIT" ? "active" : ""}`}
                  onClick={() => handleChangeAutoSettlementMethod("SIMULATED_AUTO_DEBIT")}
                >
                  <Zap size={14} />
                  <span>Auto-Debit</span>
                </div>
                <div
                  className={`method-option-pill ${autoSettlementMethod === "SIMULATED_UPI" ? "active" : ""}`}
                  onClick={() => handleChangeAutoSettlementMethod("SIMULATED_UPI")}
                >
                  <Wallet size={14} />
                  <span>UPI AutoPay</span>
                </div>
                <div
                  className={`method-option-pill ${autoSettlementMethod === "SIMULATED_NETBANKING" ? "active" : ""}`}
                  onClick={() => handleChangeAutoSettlementMethod("SIMULATED_NETBANKING")}
                >
                  <Store size={14} />
                  <span>Net Banking</span>
                </div>
                <div
                  className={`method-option-pill ${autoSettlementMethod === "SIMULATED_CARD" ? "active" : ""}`}
                  onClick={() => handleChangeAutoSettlementMethod("SIMULATED_CARD")}
                >
                  <CreditCard size={14} />
                  <span>Card Mandate</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-instant-settle"
              onClick={handleRunInstantAutoSettlement}
              disabled={settleBusy || outstanding <= 0}
              title="Test the 8:00 AM auto-settlement immediately"
            >
              <Sparkles size={16} />
              {settleBusy
                ? "Processing Settlement..."
                : outstanding <= 0
                ? "No Outstanding Dues"
                : `Trigger Settlement Now (₹${outstanding.toLocaleString("en-IN")})`}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SETTLEMENTS HISTORY */}
      {/* ========================================================================= */}
      {settlements.length > 0 && (
        <section className="panel settlement-history-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCheck size={20} color="#16a34a" />
              <h2 style={{ margin: 0 }}>Settlement Records</h2>
            </div>
            <span className="muted" style={{ fontSize: "13px" }}>
              {settlements.length} settlement(s) completed
            </span>
          </div>

          {settlements.map((s, idx) => (
            <div className="list-row" key={s._id || idx}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className="tx-type-icon tx-paid">
                  <Check size={16} />
                </div>
                <div>
                  <b>{s.type === "auto" ? "Scheduled Auto Settlement (8:00 AM)" : "Manual Settlement"}</b>
                  <p>
                    Method: {s.method?.replace("SIMULATED_", "") || "Auto-Debit"} • Ref: {s.reference || "N/A"}
                  </p>
                  <small>{s.createdAt ? new Date(s.createdAt).toLocaleString() : ""}</small>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: "16px", color: "#16a34a" }}>
                  ₹{Number(s.amount || 0).toLocaleString("en-IN")}
                </strong>
                <p style={{ marginTop: "4px" }}>
                  <span className="badge badge-approved">
                    {(s.status || "COMPLETED").toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

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

      {/* ========================================================================= */}
      {/* KYC DOCUMENTS MODAL */}
      {/* ========================================================================= */}
      {showKycModal && (
        <div className="modal-overlay" onClick={() => setShowKycModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="logo-box" style={{ width: "28px", height: "28px", borderRadius: "6px" }}>
                  <ShieldCheck size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>KYC Documents</h3>
                  <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                    View uploaded documents or submit new verification records
                  </p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowKycModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Existing Uploaded Documents */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "10px" }}>
                  Uploaded Documents ({user?.kycDocuments?.length || 0})
                </h4>

                {user?.kycDocuments && user.kycDocuments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {user.kycDocuments.map((doc, idx) => {
                      const url = getFileUrl(doc);
                      return (
                        <div
                          key={doc._id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "12px", color: "#2563eb" }}>
                              {doc.type || "Document"}
                            </span>
                            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#334155" }}>
                              {doc.originalName || doc.filename || "Uploaded File"}
                            </p>
                            <small className="muted">
                              {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : "Uploaded"}
                            </small>
                          </div>

                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="primary small"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            ↗ Open Document
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", textAlign: "center" }}>
                    <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
                      No KYC documents uploaded yet. Upload below to get verified.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload New Document Form */}
              <form onSubmit={uploadKycDoc} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "10px" }}>
                  Upload New KYC Document
                </h4>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Document Type</label>
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value)}
                    className="styled-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px" }}
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="pan">PAN Card</option>
                    <option value="driving_license">Driving License</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other Document</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Select File (PDF, PNG, JPG)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>

                <button
                  type="submit"
                  className="primary"
                  disabled={kycBusy || !kycFile}
                  style={{ width: "100%", padding: "10px" }}
                >
                  {kycBusy ? "Uploading KYC..." : "Upload Document"}
                </button>
              </form>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setShowKycModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}