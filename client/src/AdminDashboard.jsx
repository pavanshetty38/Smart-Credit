import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import api from "./api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ users: [], transactions: [], stats: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterRole, setFilterRole] = useState("all"); // 'all', 'customer', 'merchant'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [limitModalUser, setLimitModalUser] = useState(null);
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/admin/dashboard");
      setData(r.data);
      // If modal is open, refresh selected user
      if (selectedUser) {
        const updated = (r.data.users || []).find((u) => u._id === selectedUser._id);
        if (updated) setSelectedUser(updated);
      }
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateKyc = async (id, status) => {
    try {
      setError("");
      setSuccess("");
      await api.patch(`/admin/user/${id}/kyc`, { status });
      setSuccess(`KYC status updated to "${status}" successfully!`);
      await load();
      if (selectedUser && selectedUser._id === id) {
        setSelectedUser((prev) => ({ ...prev, kycStatus: status }));
      }
    } catch (e) {
      console.error("KYC update error:", e);
      setError(e.response?.data?.message || "Unable to update KYC");
    }
  };

  const updateCreditLimit = async (e) => {
    e.preventDefault();
    if (!limitModalUser) return;
    try {
      setError("");
      setSuccess("");
      await api.patch(`/admin/user/${limitModalUser._id}/limit`, {
        creditLimit: Number(newCreditLimit),
      });
      setSuccess(`Credit limit updated to ₹${Number(newCreditLimit).toLocaleString()} for ${limitModalUser.name}`);
      setLimitModalUser(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Unable to update credit limit");
    }
  };

  const openDocViewer = async (user) => {
    setSelectedUser(user);
    setActiveDocIndex(0);
    try {
      const res = await api.get(`/admin/user/${user._id}/kyc-documents`);
      if (res.data && Array.isArray(res.data.kycDocuments)) {
        setSelectedUser((prev) => (prev?._id === user._id ? { ...prev, ...res.data } : prev));
      }
    } catch (e) {
      console.log("Using cached user KYC documents:", e?.message);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

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

  const s = data.stats || {};
  const users = data.users || [];

  // Filter pending KYC users (both merchants and customers)
  const pendingKycUsers = users.filter((u) => {
    const isPending = u.kycStatus === "pending";
    if (filterRole === "customer") return isPending && u.role === "customer";
    if (filterRole === "merchant") return isPending && u.role === "merchant";
    return isPending;
  });

  // Filter registered users by search and role
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.phone && u.phone.includes(searchQuery));
    return matchesSearch;
  });

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-box" style={{ width: "24px", height: "24px", borderRadius: "6px" }}>
              <ShieldCheck size={14} color="#fff" />
            </div>
            SmartCredit
          </div>
          <h1>Admin Dashboard</h1>
          <p className="muted">System administration & KYC Verification</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="secondary small" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: "4px" }} /> {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="danger small" onClick={logout}>
            <LogOut size={14} style={{ marginRight: "4px" }} /> Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="alert error" style={{ width: "86%", margin: "20px auto 0" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="alert success" style={{ width: "86%", margin: "20px auto 0" }}>
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="cards">
        <Card title="Customers" value={s.customers || 0} sub="Registered customers" />
        <Card title="Merchants" value={s.merchants || 0} sub="Registered merchants" />
        <Card
          title="Pending KYC"
          value={s.pendingKyc || users.filter((u) => u.kycStatus === "pending").length}
          sub="Merchants & Customers awaiting review"
        />
        <Card
          title="Total Sales"
          value={`₹${Number(s.totalSales || 0).toLocaleString()}`}
          sub="Platform transaction volume"
        />
      </div>

      {/* KYC Verification Queue for Both Merchants and Customers */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
          <div>
            <h2>KYC Verification Queue</h2>
            <p className="muted" style={{ margin: 0 }}>
              Review, inspect uploaded documents, and approve or reject KYC submissions for customers and merchants.
            </p>
          </div>
          <div className="tab-filters">
            <button
              className={`filter-btn ${filterRole === "all" ? "active" : ""}`}
              onClick={() => setFilterRole("all")}
            >
              All Pending ({users.filter((u) => u.kycStatus === "pending").length})
            </button>
            <button
              className={`filter-btn ${filterRole === "customer" ? "active" : ""}`}
              onClick={() => setFilterRole("customer")}
            >
              Customers ({users.filter((u) => u.kycStatus === "pending" && u.role === "customer").length})
            </button>
            <button
              className={`filter-btn ${filterRole === "merchant" ? "active" : ""}`}
              onClick={() => setFilterRole("merchant")}
            >
              Merchants ({users.filter((u) => u.kycStatus === "pending" && u.role === "merchant").length})
            </button>
          </div>
        </div>

        {pendingKycUsers.length ? (
          pendingKycUsers.map((u) => {
            const docCount = u.kycDocuments?.length || 0;
            return (
              <div className="list-row kyc-row" key={u._id}>
                <div className="kyc-user-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <b>{u.name}</b>
                    <span className={`badge badge-${u.role}`}>{u.role.toUpperCase()}</span>
                    <span className={`badge badge-${u.kycStatus}`}>{u.kycStatus.toUpperCase()}</span>
                  </div>
                  <p>{u.email} {u.phone ? `• ${u.phone}` : ""}</p>
                  <small>
                    📁 {docCount > 0 ? `${docCount} document(s) uploaded` : "No document file uploaded yet"}
                    {u.address ? ` • ${u.address}` : ""}
                  </small>
                </div>

                <div className="row-actions">
                  <button
                    className="secondary small btn-view-doc"
                    onClick={() => openDocViewer(u)}
                    title="View uploaded KYC documents"
                  >
                    📄 View Documents ({docCount})
                  </button>
                  <button
                    className="primary small btn-approve"
                    onClick={() => updateKyc(u._id, "approved")}
                    title="Approve KYC verification"
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="danger small btn-reject"
                    onClick={() => updateKyc(u._id, "rejected")}
                    title="Reject KYC verification"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ padding: "16px 0" }}>
            No pending KYC verifications in this category. All up to date!
          </p>
        )}
      </section>

      {/* Registered Users Section */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
          <div>
            <h2>All Registered Users</h2>
            <p className="muted" style={{ margin: 0 }}>
              Manage accounts, KYC statuses, documents, and credit limits.
            </p>
          </div>
          <div>
            <input
              type="text"
              className="search-input"
              placeholder="Search user by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredUsers.length ? (
          filteredUsers.map((u) => {
            const docCount = u.kycDocuments?.length || 0;
            return (
              <div className="list-row" key={u._id}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <b>{u.name}</b>
                    <span className={`badge badge-${u.role}`}>{u.role.toUpperCase()}</span>
                    <span className={`badge badge-${u.kycStatus || "pending"}`}>
                      {(u.kycStatus || "pending").toUpperCase()}
                    </span>
                  </div>
                  <p>{u.email} {u.phone ? `• ${u.phone}` : ""}</p>
                  {u.role === "customer" && (
                    <small>Credit Limit: ₹{Number(u.creditLimit || 0).toLocaleString()}</small>
                  )}
                </div>

                <div className="row-actions">
                  <button
                    className="secondary small"
                    onClick={() => openDocViewer(u)}
                    title="View uploaded KYC documents"
                  >
                    📄 View Docs ({docCount})
                  </button>

                  {u.role === "customer" && (
                    <button
                      className="secondary small"
                      onClick={() => {
                        setLimitModalUser(u);
                        setNewCreditLimit(u.creditLimit || 0);
                      }}
                      title="Set Customer Credit Limit"
                    >
                      💳 Set Limit
                    </button>
                  )}

                  {u.kycStatus !== "approved" && (
                    <button
                      className="primary small btn-approve"
                      onClick={() => updateKyc(u._id, "approved")}
                      title="Approve KYC"
                    >
                      ✓ Approve
                    </button>
                  )}

                  {u.kycStatus !== "rejected" && (
                    <button
                      className="danger small btn-reject"
                      onClick={() => updateKyc(u._id, "rejected")}
                      title="Reject KYC"
                    >
                      ✕ Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted">No users found matching search.</p>
        )}
      </section>

      {/* Recent Transactions */}
      <section className="panel">
        <h2>Recent Platform Transactions</h2>
        {data.transactions?.length ? (
          data.transactions.map((t, i) => (
            <div className="list-row" key={t._id || i}>
              <div>
                <b>{t.reference || "Transaction"}</b>
                <p>
                  {t.customer?.name || "Customer"} → {t.merchant?.name || "Merchant"}
                  {t.description ? ` • ${t.description}` : ""}
                </p>
                <small>{new Date(t.createdAt).toLocaleString()}</small>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>₹{Number(t.amount || 0).toLocaleString()}</strong>
                <p>
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
      {/* KYC DOCUMENT VIEWER MODAL */}
      {/* ========================================================================= */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>KYC Document Viewer</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Reviewing {selectedUser.name} ({selectedUser.role.toUpperCase()})
                </p>
              </div>
              <button className="close-btn" onClick={() => setSelectedUser(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* User overview strip */}
              <div className="user-overview-box">
                <div>
                  <strong>Email:</strong> {selectedUser.email}
                </div>
                <div>
                  <strong>Phone:</strong> {selectedUser.phone || "Not provided"}
                </div>
                <div>
                  <strong>Address:</strong> {selectedUser.address || "Not provided"}
                </div>
                <div>
                  <strong>Current KYC Status:</strong>{" "}
                  <span className={`badge badge-${selectedUser.kycStatus || "pending"}`}>
                    {(selectedUser.kycStatus || "pending").toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Document List & Preview */}
              {selectedUser.kycDocuments && selectedUser.kycDocuments.length > 0 ? (
                <div>
                  {/* Document selection tabs */}
                  <div className="doc-tabs">
                    {selectedUser.kycDocuments.map((doc, idx) => (
                      <button
                        key={doc._id || idx}
                        className={`doc-tab-btn ${activeDocIndex === idx ? "active" : ""}`}
                        onClick={() => setActiveDocIndex(idx)}
                      >
                        📄 {doc.type ? doc.type.toUpperCase() : `Document ${idx + 1}`}
                      </button>
                    ))}
                  </div>

                  {/* Active Document Details */}
                  {(() => {
                    const doc = selectedUser.kycDocuments[activeDocIndex] || selectedUser.kycDocuments[0];
                    const fullUrl = getFileUrl(doc);
                    const filename = (doc.filename || doc.originalName || doc.url || "").toLowerCase();
                    const isPdf = /\.pdf$/i.test(filename) || doc.type === "pdf";
                    // If not pdf, treat as image/document preview
                    const isImage = !isPdf;

                    return (
                      <div className="doc-viewer-card">
                        <div className="doc-meta-bar">
                          <div>
                            <p style={{ margin: 0, fontWeight: 600 }}>
                              Type: {doc.type ? doc.type.toUpperCase() : "KYC Document"}
                            </p>
                            <small style={{ color: "var(--muted)" }}>
                              Original Name: {doc.originalName || doc.filename || "document"} •{" "}
                              Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : "Recently"}
                            </small>
                          </div>
                          <div>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="primary small"
                              style={{ display: "inline-block", textDecoration: "none" }}
                            >
                              ↗ Open in New Window
                            </a>
                          </div>
                        </div>

                        {/* Inline Preview Container */}
                        <div className="doc-preview-area">
                          {isPdf ? (
                            <div style={{ width: "100%", height: "100%", minHeight: "360px", display: "flex", flexDirection: "column" }}>
                              <iframe
                                src={fullUrl}
                                title="PDF Preview"
                                className="doc-preview-iframe"
                                style={{ width: "100%", height: "400px", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                              />
                              <div style={{ marginTop: "10px", textAlign: "center" }}>
                                <a
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="secondary small"
                                  style={{ textDecoration: "none" }}
                                >
                                  📄 Open Full PDF in New Tab
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              <img
                                src={fullUrl}
                                alt={doc.originalName || "KYC Document"}
                                className="doc-preview-img"
                                style={{ maxHeight: "400px", maxWidth: "100%", objectFit: "contain", borderRadius: "8px" }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fallbackEl = e.currentTarget.parentElement?.querySelector(".doc-fallback-dynamic");
                                  if (fallbackEl) fallbackEl.style.display = "block";
                                }}
                              />
                              <div className="doc-fallback-dynamic doc-fallback" style={{ display: "none", width: "100%", textAlign: "center", padding: "20px" }}>
                                <p style={{ color: "#2563eb", fontWeight: 600, marginBottom: "8px" }}>
                                  📄 KYC Document File Ready
                                </p>
                                <p className="muted" style={{ fontSize: "13px", marginBottom: "14px" }}>
                                  Document: <strong>{doc.originalName || doc.filename || "Uploaded file"}</strong>
                                </p>
                                <a
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="primary small"
                                  style={{ textDecoration: "none" }}
                                >
                                  ↗ Open / Download Document
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="no-docs-box">
                  <p style={{ fontSize: "16px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
                    No KYC documents uploaded by this user yet.
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    The user may upload KYC documents (Aadhaar, PAN, Passport, Driving License) from their profile dashboard.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer with Quick KYC Action Buttons */}
            <div className="modal-footer">
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="primary btn-approve"
                  onClick={() => updateKyc(selectedUser._id, "approved")}
                  disabled={selectedUser.kycStatus === "approved"}
                >
                  ✓ Approve KYC
                </button>
                <button
                  className="danger btn-reject"
                  onClick={() => updateKyc(selectedUser._id, "rejected")}
                  disabled={selectedUser.kycStatus === "rejected"}
                >
                  ✕ Reject KYC
                </button>
              </div>
              <button className="secondary" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREDIT LIMIT MODAL */}
      {/* ========================================================================= */}
      {limitModalUser && (
        <div className="modal-overlay" onClick={() => setLimitModalUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal-header">
              <h3>Set Customer Credit Limit</h3>
              <button className="close-btn" onClick={() => setLimitModalUser(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={updateCreditLimit}>
              <div className="modal-body">
                <p>
                  Update credit limit for <strong>{limitModalUser.name}</strong> ({limitModalUser.email})
                </p>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, margin: "14px 0 6px" }}>
                  Credit Limit (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "15px",
                  }}
                />
              </div>
              <div className="modal-footer">
                <button type="submit" className="primary">
                  Save Credit Limit
                </button>
                <button type="button" className="secondary" onClick={() => setLimitModalUser(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div className="card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
