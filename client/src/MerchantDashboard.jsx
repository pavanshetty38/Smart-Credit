import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  QrCode,
  TrendingUp,
  CreditCard,
  Bell,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Download,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Users
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import api from "./api";

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    user: null,
    sales: [],
    total: 0,
    settled: 0,
    pendingSettlement: 0,
    customers: [],
  });

  const [notifications, setNotifications] = useState([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Manual Sale Recording Form
  const [customerId, setCustomerId] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedQr, setCopiedQr] = useState(false);

  // Merchant KYC Modal State
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycFile, setKycFile] = useState(null);
  const [kycDocType, setKycDocType] = useState("business_proof");
  const [kycBusy, setKycBusy] = useState(false);

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
    setBusy(true);
    try {
      const r = await api.get("/merchant/dashboard");
      setData(r.data);
    } catch (err) {
      console.error("Merchant dashboard error:", err);
    } finally {
      setBusy(false);
    }

    try {
      const r = await api.get("/notifications");
      const notifs = r.data.notifications || (Array.isArray(r.data) ? r.data : []);
      setNotifications(notifs);
      setUnreadNotifs(r.data.unread !== undefined ? r.data.unread : notifs.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Record a credit sale
  const handleRecordSale = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!customerId) {
      setError("Please select an approved customer.");
      return;
    }

    const numAmount = Number(saleAmount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid positive sale amount.");
      return;
    }

    if (!dueDate) {
      setError("Please set a payment due date.");
      return;
    }

    setBusy(true);

    try {
      const res = await api.post("/merchant/sale", {
        customerId,
        amount: numAmount,
        dueDate,
        description: description || "Credit purchase",
      });

      setMessage(`Credit sale of ₹${numAmount.toLocaleString("en-IN")} recorded successfully! Ref: ${res.data.reference}`);
      setCustomerId("");
      setSaleAmount("");
      setDescription("");
      setDueDate("");

      await load();
    } catch (err) {
      console.error("Sale recording error:", err);
      setError(err.response?.data?.message || "Failed to record credit sale.");
    } finally {
      setBusy(false);
    }
  };

  // Notification actions
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

  const getFileUrl = (doc) => {
    if (!doc) return "";
    let rawUrl = "";
    if (typeof doc === "string") {
      rawUrl = doc;
    } else {
      rawUrl = doc.url || (doc.filename ? `/uploads/kyc/${doc.filename}` : "");
    }
    if (!rawUrl) return "";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
      return rawUrl;
    }
    let apiBase = (import.meta.env.VITE_API_URL || api.defaults?.baseURL || "").trim();
    if (!apiBase || apiBase.startsWith("/")) {
      apiBase = window.location.origin;
    }
    const backendBase = apiBase.replace(/\/api\/?$/, "");
    return `${backendBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  };

  const uploadKycDoc = async (e) => {
    e.preventDefault();
    if (!kycFile) {
      setError("Please select a merchant KYC document file to upload.");
      return;
    }
    setKycBusy(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("documents", kycFile);
      fd.append("types", kycDocType);
      const res = await api.post("/merchant/kyc-documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.user) {
        setData((prev) => ({ ...prev, user: res.data.user }));
      }
      setMessage(res.data.message || "Merchant KYC documents uploaded. Awaiting admin approval.");
      setKycFile(null);
      await load();
    } catch (err) {
      console.error("Merchant KYC upload error:", err);
      setError(err.response?.data?.message || "Failed to upload merchant KYC document.");
    } finally {
      setKycBusy(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  const merchantUser = data.user || JSON.parse(localStorage.getItem("user") || "{}");
  const merchantId = merchantUser._id || merchantUser.id || "";
  const qrString = `smartcredit:merchant:${merchantId}`;

  const copyQrString = () => {
    navigator.clipboard.writeText(qrString);
    setCopiedQr(true);
    setTimeout(() => setCopiedQr(false), 2000);
  };

  const downloadQrCode = () => {
    const svg = document.getElementById("merchant-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `SmartCredit_QR_${merchantUser.name || "Merchant"}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // Compute stats
  const sales = data.sales || [];
  const totalSalesAmount = data.total !== undefined ? data.total : sales.reduce((sum, s) => sum + (s.amount || 0), 0);
  
  // Calculate today's sales
  const todayStr = new Date().toDateString();
  const todaySalesAmount = sales
    .filter((s) => s.createdAt && new Date(s.createdAt).toDateString() === todayStr)
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const totalTransactionsCount = sales.length;
  const pendingPaymentsAmount = data.pendingSettlement !== undefined ? data.pendingSettlement : sales
    .filter((s) => s.settlementStatus !== "settled" && s.status !== "disputed")
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const selectedCustomerObj = (data.customers || []).find((c) => c._id === customerId);

  return (
    <div className="dashboard merchant-dashboard-view">
      {/* ========================================================================= */}
      {/* TOPBAR */}
      {/* ========================================================================= */}
      <header className="topbar">
        <div>
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-box" style={{ width: "24px", height: "24px", borderRadius: "6px" }}>
              <Store size={14} color="#fff" />
            </div>
            SmartCredit
          </div>
          <h1>Merchant Dashboard</h1>
          <p className="muted">
            Welcome, {merchantUser.name || "Merchant"} • KYC:{" "}
            <span className={`badge badge-${merchantUser.kycStatus || "pending"}`}>
              {(merchantUser.kycStatus || "pending").toUpperCase()}
            </span>
            <button
              type="button"
              className="secondary small"
              style={{ marginLeft: "10px", padding: "3px 8px", fontSize: "11px" }}
              onClick={() => setShowKycModal(true)}
            >
              📄 KYC Documents ({merchantUser?.kycDocuments?.length || 0})
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
                      <span className="badge badge-merchant">{unreadNotifs} new</span>
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
                            <ArrowUpRight size={16} color="#a21caf" />
                          ) : n.category === "kyc" ? (
                            <ShieldCheck size={16} color="#2563eb" />
                          ) : (
                            <Bell size={16} color="#64748b" />
                          )}
                        </div>
                        <div className="notif-item-body">
                          <p className="notif-item-title">{n.title || "Merchant Notification"}</p>
                          <p className="notif-item-text">{n.message || n.text || ""}</p>
                          <span className="notif-item-time">
                            {n.createdAt
                              ? new Date(n.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Just now"}
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
      {/* STATS CARDS: TOTAL SALES, TODAY'S SALES, TRANSACTIONS, PENDING */}
      {/* ========================================================================= */}
      <div className="cards">
        <div className="card stat-card-highlight">
          <span>Total Sales</span>
          <strong style={{ color: "#2563eb" }}>₹{totalSalesAmount.toLocaleString("en-IN")}</strong>
          <small>Total platform credit volume</small>
        </div>

        <div className="card">
          <span>Today's Sales</span>
          <strong style={{ color: "#16a34a" }}>₹{todaySalesAmount.toLocaleString("en-IN")}</strong>
          <small>Revenue processed today</small>
        </div>

        <div className="card">
          <span>Total Transactions</span>
          <strong>{totalTransactionsCount}</strong>
          <small>Completed credit sales</small>
        </div>

        <div className="card">
          <span>Pending Settlement</span>
          <strong style={{ color: pendingPaymentsAmount > 0 ? "#b45309" : "#475569" }}>
            ₹{pendingPaymentsAmount.toLocaleString("en-IN")}
          </strong>
          <small>Awaiting daily auto-settlement</small>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIRECT EMBEDDED QR CODE STAND UNDER TOTAL SALES & INFORMATION */}
      {/* ========================================================================= */}
      <div className="customer-actions-grid" style={{ marginTop: "10px" }}>
        {/* Merchant QR Code Stand */}
        <section className="panel action-panel merchant-qr-stand-panel">
          <div className="panel-header-clean">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="action-icon-box" style={{ background: "#fdf4ff", border: "1px solid #f5d0fe" }}>
                <QrCode size={20} color="#a21caf" />
              </div>
              <div>
                <h2>Merchant Payment QR Code</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Display this QR at your counter for instant customer scanning
                </p>
              </div>
            </div>
          </div>

          <div className="merchant-qr-display-container">
            <div className="qr-badge-header">
              <div className="pulse-green-dot"></div>
              <span>Ready for Customer Payments</span>
            </div>

            <div className="qr-card-frame">
              <QRCodeSVG
                id="merchant-qr-svg"
                value={qrString}
                size={190}
                level="H"
                includeMargin={true}
                className="merchant-qr-svg-el"
              />
              <div className="qr-store-caption">
                <strong>{merchantUser.name || "Merchant Store"}</strong>
                <p>{merchantUser.email}</p>
              </div>
            </div>

            <div className="qr-code-actions-bar">
              <button className="primary small" onClick={downloadQrCode} title="Download high quality PNG QR image">
                <Download size={15} style={{ marginRight: "6px" }} /> Download QR Code
              </button>
              <button className="secondary small" onClick={copyQrString} title="Copy QR string payload">
                {copiedQr ? (
                  <>
                    <Check size={15} style={{ marginRight: "6px", color: "#16a34a" }} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={15} style={{ marginRight: "6px" }} /> Copy QR Code Data
                  </>
                )}
              </button>
            </div>

            <p className="muted" style={{ fontSize: "12px", marginTop: "14px", textAlign: "center" }}>
              Payload: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>{qrString}</code>
            </p>
          </div>
        </section>

        {/* Record Credit Sale / POS Terminal */}
        <section className="panel action-panel pos-panel">
          <div className="panel-header-clean">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="action-icon-box purchase-icon">
                <CreditCard size={20} color="#2563eb" />
              </div>
              <div>
                <h2>Record Credit Sale</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Manually record a sale for an approved customer
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleRecordSale} className="credit-purchase-form">
            <div className="form-group">
              <label>Select Customer</label>
              {(data.customers || []).length > 0 ? (
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="styled-select"
                >
                  <option value="">-- Choose an approved customer --</option>
                  {(data.customers || []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.email}) - Limit: ₹{Number(c.creditLimit || 0).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="muted">No approved customers with active credit limits found.</p>
              )}
            </div>

            {selectedCustomerObj && (
              <div className="selected-merchant-banner" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
                <div>
                  <strong>{selectedCustomerObj.name}</strong>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Credit Limit: ₹{Number(selectedCustomerObj.creditLimit || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <span className="badge badge-customer">APPROVED</span>
              </div>
            )}

            <div className="form-group">
              <label>Sale Amount (₹)</label>
              <div className="amount-input-wrapper">
                <span className="currency-symbol">₹</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  placeholder="0.00"
                  className="amount-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Payment Due Date</label>
              <input
                required
                type="date"
                value={dueDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDueDate(e.target.value)}
                className="styled-input"
              />
            </div>

            <div className="form-group">
              <label>Description / Invoice Note</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. In-store retail purchase, Hardware, Supplies"
                className="styled-input"
              />
            </div>

            <button
              type="submit"
              className="primary purchase-submit-btn"
              disabled={busy || !customerId || !saleAmount || Number(saleAmount) <= 0 || !dueDate}
            >
              {busy ? "Recording Sale..." : `Record ₹${Number(saleAmount || 0).toLocaleString("en-IN")} Sale`}
            </button>
          </form>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* TRANSACTION & SETTLEMENT HISTORY */}
      {/* ========================================================================= */}
      <section className="panel" style={{ width: "86%", margin: "30px auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h2>Transaction & Settlement History</h2>
            <p className="muted" style={{ margin: 0 }}>
              All sales processed via QR and manual entries
            </p>
          </div>
          <span className="muted" style={{ fontSize: "13px" }}>
            Total {sales.length} record(s)
          </span>
        </div>

        {sales.length ? (
          sales.map((t, i) => (
            <div className="list-row" key={t._id || i}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className="tx-type-icon tx-credit" style={{ background: "#fdf4ff", color: "#a21caf" }}>
                  <TrendingUp size={16} />
                </div>
                <div>
                  <b>{t.reference || "Transaction"}</b>
                  <p>
                    Customer: <strong>{t.customer?.name || "Customer"}</strong> ({t.customer?.email || "N/A"}) •{" "}
                    {t.description || "Credit Sale"}
                  </p>
                  <small>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}</small>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                  +₹{Number(t.amount || 0).toLocaleString("en-IN")}
                </strong>
                <div style={{ marginTop: "4px", display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <span className={`badge badge-${t.settlementStatus === "settled" ? "approved" : "pending"}`}>
                    {t.settlementStatus === "settled" ? "SETTLED" : "PENDING SETTLEMENT"}
                  </span>
                  <span className={`badge badge-${t.status}`}>{t.status?.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No sales recorded yet. Provide your QR code to customers to begin accepting payments.</p>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MERCHANT KYC DOCUMENTS MODAL */}
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
                  <h3 style={{ margin: 0 }}>Merchant KYC Documents</h3>
                  <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                    View uploaded documents or submit business verification files
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
                  Uploaded Merchant Documents ({merchantUser?.kycDocuments?.length || 0})
                </h4>

                {merchantUser?.kycDocuments && merchantUser.kycDocuments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {merchantUser.kycDocuments.map((doc, idx) => {
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
                            <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "12px", color: "#a21caf" }}>
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
                      No merchant KYC documents uploaded yet. Upload below to get verified.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload New Document Form */}
              <form onSubmit={uploadKycDoc} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "10px" }}>
                  Upload Business Verification Document
                </h4>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Document Type</label>
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value)}
                    className="styled-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px" }}
                  >
                    <option value="business_proof">Business Proof / GST Registration</option>
                    <option value="pan">Merchant PAN Card</option>
                    <option value="aadhaar">Owner Aadhaar Card</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other Commercial License</option>
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
