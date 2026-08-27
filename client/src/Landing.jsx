import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CreditCard, Store, ShieldCheck, LogOut, Bell, Wallet } from "lucide-react";
import api from "./api";

export default function Landing() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
        // Fetch unread notifications if logged in
        api.get("/notifications")
          .then((res) => {
            const count = res.data.unread ?? (Array.isArray(res.data) ? res.data.length : 0);
            setUnreadCount(count);
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error("Error reading auth state:", e);
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/login");
  };

  const getDashboardPath = () => {
    if (!user) return "/login";
    if (user.role === "admin") return "/admin";
    if (user.role === "merchant") return "/merchant";
    return "/customer";
  };

  const handleGetStarted = () => {
    if (user) {
      navigate(getDashboardPath());
    } else {
      navigate("/register");
    }
  };

  return (
    <div className="landing-page">
      {/* Top Navbar */}
      <header className="landing-navbar">
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <div className="logo-box">
              <CreditCard size={18} color="#ffffff" />
            </div>
            <span>SmartCredit</span>
          </Link>

          <div className="landing-nav-right">
            {user ? (
              <div className="landing-user-controls">
                <span className="landing-user-info">
                  {user.name || "User"} <span className="user-role-dot">·</span> <span className="user-role-text">{user.role}</span>
                </span>
                <Link to={getDashboardPath()} className="nav-link-item">
                  Dashboard
                </Link>
                <div className="notification-bell-wrapper" onClick={() => navigate(getDashboardPath())} title="Notifications">
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
                </div>
                <button className="landing-logout-btn" onClick={handleLogout} title="Logout">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="landing-auth-links">
                <Link to="/login" className="nav-login-btn">
                  Login
                </Link>
                <Link to="/register" className="nav-register-btn">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="landing-main">
        <div className="landing-hero-container">
          {/* Left Column: Headline & CTA */}
          <div className="hero-text-content">
            <div className="hero-pill-badge">
              SIMULATED CREDIT PLATFORM
            </div>

            <h1 className="hero-headline">
              Smart credit, made simple.
            </h1>

            <p className="hero-subtext">
              QR credit purchases, KYC verification, repayments and automated daily settlement for customers, merchants and administrators.
            </p>

            <div className="hero-cta-group">
              <button className="hero-primary-btn" onClick={handleGetStarted}>
                {user ? "Go to Dashboard" : "Get Started"}
              </button>
            </div>
          </div>

          {/* Right Column: Hero Credit Card Widget */}
          <div className="hero-card-preview-wrapper">
            <div className="hero-credit-card">
              <div className="card-decor-accent"></div>
              
              <div className="card-top-icon">
                <Wallet size={24} color="#1e293b" />
              </div>

              <div className="card-amount-section">
                <h2 className="card-main-amount">₹25,000</h2>
                <span className="card-amount-label">Example credit limit</span>
              </div>

              <div className="card-stats-divider"></div>

              <div className="card-stats-rows">
                <div className="card-stat-row">
                  <span className="stat-name">Available</span>
                  <span className="stat-val">₹18,500</span>
                </div>
                <div className="card-stat-row">
                  <span className="stat-name">Outstanding</span>
                  <span className="stat-val">₹6,500</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3-Column Roles / Feature Cards */}
        <section className="landing-roles-section">
          <div className="landing-roles-grid">
            {/* Customer Role Card */}
            <div
              className="role-feature-card"
              onClick={() => navigate(user?.role === "customer" ? "/customer" : "/login")}
            >
              <div className="role-card-icon-box">
                <CreditCard size={22} color="#2563eb" />
              </div>
              <h3 className="role-card-title">Customer</h3>
              <p className="role-card-desc">
                QR credit purchases, easy repayments, live credit limits & auto settlement.
              </p>
            </div>

            {/* Merchant Role Card */}
            <div
              className="role-feature-card"
              onClick={() => navigate(user?.role === "merchant" ? "/merchant" : "/login")}
            >
              <div className="role-card-icon-box">
                <Store size={22} color="#2563eb" />
              </div>
              <h3 className="role-card-title">Merchant</h3>
              <p className="role-card-desc">
                Generate merchant QR, accept credit sales, track settlements & manage sales.
              </p>
            </div>

            {/* Admin Role Card */}
            <div
              className="role-feature-card"
              onClick={() => navigate(user?.role === "admin" ? "/admin" : "/login")}
            >
              <div className="role-card-icon-box">
                <ShieldCheck size={22} color="#2563eb" />
              </div>
              <h3 className="role-card-title">Admin</h3>
              <p className="role-card-desc">
                Approve KYC documents, set limits, review platform sales & system operations.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
