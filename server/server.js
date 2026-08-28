import "dotenv/config";

import dns from "node:dns";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectDB } from "./config/db.js";
import User from "./models/User.js";

import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customer.js";
import merchantRoutes from "./routes/merchant.js";
import adminRoutes from "./routes/admin.js";
import notificationsRoutes from "./routes/notifications.js";

import { startAutoSettlementScheduler } from "./jobs/autoSettlement.js";


// DNS configuration
dns.setServers(["8.8.8.8", "1.1.1.1"]);


// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Create Express application
const app = express();


// ===============================
// MIDDLEWARE
// ===============================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());


// ===============================
// SERVE UPLOADED KYC DOCUMENTS
// ===============================

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);


// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "smart-credit-api",
  });
});


// ===============================
// API ROUTES
// ===============================

app.use("/api/auth", authRoutes);

app.use("/api/customer", customerRoutes);

app.use("/api/merchant", merchantRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/notifications", notificationsRoutes);


// ===============================
// SERVE STATIC CLIENT IN PRODUCTION
// ===============================

const clientDistPath = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// 404 handler for API routes
app.use("/api", (_req, res) => {
  res.status(404).json({
    message: "API route not found",
  });
});

// Wildcard SPA Fallback for client routes
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
    const indexPath = path.join(clientDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Final 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});


// ===============================
// ERROR HANDLER
// ===============================

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});


// ===============================
// SERVER STARTUP
// ===============================

const port = process.env.PORT || 5000;


connectDB()
  .then(async () => {
    console.log("Database connected");


    // ===============================
    // CREATE DEMO ADMIN
    // ===============================

    const email = "admin@smartcredit.local";

    const existingAdmin = await User.findOne({ email });

    if (!existingAdmin) {
      await User.create({
        name: "System Administrator",
        email: email,
        password: await bcrypt.hash("Admin@12345", 12),
        role: "admin",
        kycStatus: "approved",
      });

      console.log("Demo admin created");
    }


    // ===============================
    // START AUTO SETTLEMENT
    // ===============================

    startAutoSettlementScheduler();


    // ===============================
    // START SERVER
    // ===============================

    app.listen(port, () => {
      console.log(`API running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Server startup error:", error);
    process.exit(1);
  });