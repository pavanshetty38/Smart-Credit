import 'dotenv/config';
import dns from 'node:dns';
dns.setServers(["8.8.8.8","1.1.1.1"]);
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customer.js';
import merchantRoutes from './routes/merchant.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import { startAutoSettlementScheduler } from './jobs/autoSettlement.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'smart-credit-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use((err, _req, res, _next) => res.status(500).json({ message: err.message || 'Server error' }));

const port = process.env.PORT || 5000;
connectDB().then(async () => {
  const email = 'admin@smartcredit.local';
  if (!await User.findOne({ email })) {
    await User.create({ name: 'System Administrator', email, password: await bcrypt.hash('Admin@12345', 12), role: 'admin', kycStatus: 'approved' });
    console.log('Demo admin seeded');
  }
  startAutoSettlementScheduler();
  app.listen(port, () => console.log(`API running on ${port}`));
}).catch(e => { console.error(e); process.exit(1); });
