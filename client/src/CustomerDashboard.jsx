import { useEffect, useState } from "react";
import api from "./api";

export default function CustomerDashboard() {
  const [balance, setBalance] = useState({
    creditLimit: 0,
    availableCredit: 0,
    outstanding: 0
  });

  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [repay, setRepay] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const r = await api.get("/customer/dashboard");

      if (r.data.balance) {
        setBalance(r.data.balance);
      }

      setTransactions(r.data.transactions || []);
    } catch (error) {
      console.error("Dashboard error:", error);
    }

    try {
      const r = await api.get("/notifications");

      setNotifications(
        r.data.notifications || r.data || []
      );
    } catch (error) {
      console.error("Notification error:", error);
    }

    try {
      const r = await api.get("/customer/merchants");

      console.log("Approved merchants:", r.data);

      setMerchants(Array.isArray(r.data) ? r.data : []);
    } catch (error) {
      console.error("Merchant loading error:", error);
      setMerchants([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---------------------------------------------
  // CREDIT PURCHASE
  // ---------------------------------------------
  const purchase = async (e) => {
    e.preventDefault();

    if (!merchantId) {
      setMessage("Please select a merchant.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const r = await api.post("/customer/purchase", {
        merchantId: merchantId,
        amount: Number(amount),
        description: "Credit purchase"
      });

      if (r.data.balance) {
        setBalance(r.data.balance);
      }

      setMessage(
        r.data.message || "Purchase successful"
      );

      setAmount("");
      setMerchantId("");

      await load();
    } catch (error) {
      console.error("Purchase error:", error);

      setMessage(
        error.response?.data?.message ||
        "Purchase failed"
      );
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------
  // REPAYMENT
  // ---------------------------------------------
  const repayment = async (e) => {
    e.preventDefault();

    if (!repay || Number(repay) <= 0) {
      setMessage("Please enter a valid repayment amount.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const r = await api.post("/customer/repay", {
        amount: Number(repay),
        method: "SIMULATED_UPI"
      });

      if (r.data.balance) {
        setBalance(r.data.balance);
      }

      setMessage(
        r.data.message || "Repayment successful"
      );

      setRepay("");

      await load();
    } catch (error) {
      console.error("Repayment error:", error);

      setMessage(
        error.response?.data?.message ||
        "Repayment failed"
      );
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------
  // LOGOUT
  // ---------------------------------------------
  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="dashboard">

      {/* HEADER */}
      <header className="topbar">
        <div>
          <div className="brand">Smart Credit</div>
          <h1>Customer Dashboard</h1>
        </div>

        <button
          className="danger"
          onClick={logout}
        >
          Logout
        </button>
      </header>

      {/* MESSAGE */}
      {message && (
        <div className="alert info">
          {message}
        </div>
      )}

      {/* BALANCE CARDS */}
      <div className="cards">

        <Card
          title="Credit Limit"
          value={`₹${Number(
            balance.creditLimit || 0
          ).toLocaleString("en-IN")}`}
          sub="Total approved limit"
        />

        <Card
          title="Available Credit"
          value={`₹${Math.max(
            0,
            Number(balance.availableCredit || 0)
          ).toLocaleString("en-IN")}`}
          sub="Available to spend"
        />

        <Card
          title="Outstanding"
          value={`₹${Math.max(
            0,
            Number(balance.outstanding || 0)
          ).toLocaleString("en-IN")}`}
          sub={
            Number(balance.outstanding) > 0
              ? "Amount to be repaid"
              : "No amount due"
          }
        />

        <Card
          title="Next Payment"
          value={`₹${Math.max(
            0,
            Number(balance.outstanding || 0)
          ).toLocaleString("en-IN")}`}
          sub={
            Number(balance.outstanding) > 0
              ? "Payment due"
              : "No payment due"
          }
        />

      </div>

      {/* PURCHASE + REPAYMENT */}
      <div className="grid2">

        {/* PURCHASE */}
        <section className="panel">
          <h2>Make Credit Purchase</h2>

          <form onSubmit={purchase}>

            <label>Merchant</label>

            {merchants.length > 0 ? (
              <select
                required
                value={merchantId}
                onChange={(e) =>
                  setMerchantId(e.target.value)
                }
              >
                <option value="">
                  Select a merchant
                </option>

                {merchants.map((merchant) => (
                  <option
                    key={merchant._id}
                    value={merchant._id}
                  >
                    {merchant.name} - {merchant.email}
                  </option>
                ))}
              </select>
            ) : (
              <p className="muted">
                No approved merchants available.
              </p>
            )}

            <label>Amount</label>

            <input
              required
              type="number"
              min="1"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              placeholder="Enter amount"
            />

            <button
              className="primary"
              disabled={
                busy ||
                !merchantId ||
                !amount
              }
            >
              {busy ? "Processing..." : "Pay on Credit"}
            </button>

          </form>
        </section>

        {/* REPAYMENT */}
        <section className="panel">
          <h2>Repay Credit</h2>

          <form onSubmit={repayment}>

            <label>Repayment amount</label>

            <input
              required
              type="number"
              min="1"
              max={Math.max(
                0,
                Number(balance.outstanding || 0)
              )}
              value={repay}
              onChange={(e) =>
                setRepay(e.target.value)
              }
              placeholder="Enter repayment amount"
            />

            <button
              className="secondary"
              disabled={
                busy ||
                Number(balance.outstanding) <= 0
              }
            >
              {busy ? "Processing..." : "Repay"}
            </button>

          </form>
        </section>

      </div>

      {/* NOTIFICATIONS */}
      <section className="panel">
        <h2>Notifications</h2>

        {notifications.length ? (
          notifications
            .slice(0, 8)
            .map((n, i) => (
              <div
                className="list-row"
                key={n._id || i}
              >
                <div>
                  <b>
                    {n.title || "Smart Credit"}
                  </b>

                  <p>
                    {n.message ||
                      n.text ||
                      ""}
                  </p>
                </div>

                <small>
                  {n.createdAt
                    ? new Date(
                        n.createdAt
                      ).toLocaleString()
                    : ""}
                </small>
              </div>
            ))
        ) : (
          <p className="muted">
            No notifications.
          </p>
        )}
      </section>

      {/* TRANSACTIONS */}
      <section className="panel">
        <h2>Transaction History</h2>

        {transactions.length ? (
          transactions.map((t, i) => (
            <div
              className="list-row"
              key={t._id || i}
            >
              <div>
                <b>
                  {t.reference ||
                    "Transaction"}
                </b>

                <p>
                  {t.description ||
                    t.type ||
                    "Credit transaction"}
                </p>

                {t.merchant && (
                  <small>
                    Merchant:{" "}
                    {t.merchant.name}
                  </small>
                )}
              </div>

              <strong>
                ₹
                {Number(
                  t.amount || 0
                ).toLocaleString("en-IN")}
              </strong>
            </div>
          ))
        ) : (
          <p className="muted">
            No transactions yet.
          </p>
        )}
      </section>

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