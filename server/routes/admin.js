import { Router } from 'express';
import { auth, roles } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Repayment from '../models/Repayment.js';
import Settlement from '../models/Settlement.js';
import { notifyUser } from '../utils.js';

const router = Router();
router.use(auth, roles('admin'));

router.get('/dashboard', async (_req, res) => {
  const [users, transactions, repayments, settlements] = await Promise.all([
    User.find().select('-password').sort('-createdAt'),
    Transaction.find().populate('customer merchant', 'name email').sort('-createdAt').limit(100),
    Repayment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Settlement.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const customers = users.filter(u => u.role === 'customer').length;
  const merchants = users.filter(u => u.role === 'merchant').length;
  const totalCredit = users.filter(u => u.role === 'customer').reduce((s, u) => s + (u.creditLimit || 0), 0);
  const totalSales = transactions.reduce((s, t) => s + t.amount, 0);
  res.json({ users, transactions, stats: { customers, merchants, pendingKyc: users.filter(u => u.kycStatus === 'pending').length, totalCredit, totalSales, totalRepayments: repayments[0]?.total || 0, totalSettlements: settlements[0]?.total || 0 } });
});

router.patch('/user/:id/kyc', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid KYC status'
      });
    }

    const u = await User.findById(req.params.id);

    if (!u) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Update KYC status
    u.kycStatus = status;

    await u.save();

    // Try to send notification.
    // Notification failure must NOT cancel KYC approval.
    try {
      await notifyUser(
        u,
        `KYC ${status}`,
        status === 'approved'
          ? 'Your KYC documents have been approved. You can now use Smart Credit services.'
          : status === 'rejected'
            ? 'Your KYC documents were rejected. Please review your documents and upload them again.'
            : 'Your KYC status has been moved back to pending.',
        'kyc',
        { status }
      );
    } catch (notificationError) {
      console.error(
        'KYC notification failed:',
        notificationError.message
      );
    }

    const updatedUser = await User.findById(u._id)
      .select('-password');

    res.json({
      success: true,
      message: `KYC ${status} successfully`,
      user: updatedUser
    });

  } catch (error) {
    console.error('KYC update error:', error);

    res.status(500).json({
      message: error.message || 'Unable to update KYC'
    });
  }
});
router.patch('/user/:id/limit', async (req, res) => {
  const limit = Number(req.body.creditLimit); const u = await User.findById(req.params.id);
  if (!u || u.role !== 'customer' || !Number.isFinite(limit) || limit < 0) return res.status(400).json({ message: 'Invalid customer or limit' });
  u.creditLimit = limit; await u.save(); res.json(u);
});

router.patch('/transaction/:id/dispute', async (req, res) => {
  const t = await Transaction.findByIdAndUpdate(req.params.id, { status: 'disputed', disputeNote: req.body.note || 'Admin marked disputed' }, { new: true });
  if (!t) return res.status(404).json({ message: 'Transaction not found' });
  res.json(t);
});

router.get('/user/:id/kyc-documents', async (req, res) => {
  const u = await User.findById(req.params.id).select('name email role kycStatus kycDocuments');
  if (!u) return res.status(404).json({ message: 'User not found' });
  res.json(u);
});

export default router;
