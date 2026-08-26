import { Router } from 'express';
import { auth, roles } from '../middleware/auth.js';
import { kycUpload } from '../middleware/upload.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Repayment from '../models/Repayment.js';
import { ref, notifyUser } from '../utils.js';

const router = Router();
router.use(auth, roles('merchant'));

router.get('/dashboard', async (req, res) => {
  const sales = await Transaction.find({ merchant: req.user._id }).populate('customer', 'name email').sort('-createdAt').limit(50);
  const total = sales.reduce((s, t) => s + t.amount, 0);
  const settled = sales.filter(t => t.settlementStatus === 'settled').reduce((s, t) => s + t.amount, 0);
  const pendingSettlement = sales.filter(t => t.settlementStatus !== 'settled' && t.status !== 'disputed').reduce((s, t) => s + t.amount, 0);
  const customers = await User.find({ role: 'customer', kycStatus: 'approved' }).select('name email creditLimit');
  const user = await User.findById(req.user._id).select('-password');
  res.json({ user, sales, total, settled, pendingSettlement, customers });
});

router.post('/kyc-documents', kycUpload.array('documents', 5), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ message: 'Please select at least one KYC document' });
  const types = Array.isArray(req.body.types) ? req.body.types : (req.body.types ? [req.body.types] : []);
  const docs = req.files.map((file, index) => ({ type: types[index] || 'other', originalName: file.originalname, filename: file.filename, url: `/uploads/kyc/${file.filename}` }));
  const user = await User.findByIdAndUpdate(req.user._id, { $push: { kycDocuments: { $each: docs } }, $set: { kycStatus: 'pending' } }, { new: true }).select('-password');

  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(
    admins.map(admin =>
      notifyUser(
        admin,
        'New merchant KYC submitted',
        `${user.name} uploaded merchant KYC documents and is awaiting approval.`,
        'kyc',
        { userId: user._id }
      )
    )
  );

  res.status(201).json({ user, documents: docs, message: 'KYC documents uploaded. Awaiting admin approval.' });
});

router.post('/sale', async (req, res) => {
  if (req.user.kycStatus !== 'approved') return res.status(403).json({ message: 'Merchant KYC must be approved' });
  const customer = await User.findOne({ _id: req.body.customerId, role: 'customer', kycStatus: 'approved' });
  const amount = Number(req.body.amount), due = new Date(req.body.dueDate);
  if (!customer || !amount || amount <= 0 || Number.isNaN(due.getTime())) return res.status(400).json({ message: 'Invalid sale data' });
  const tx = await Transaction.aggregate([{ $match: { customer: customer._id, status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const rp = await Repayment.aggregate([{ $match: { customer: customer._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const outstanding = Math.max(0, (tx[0]?.total || 0) - (rp[0]?.total || 0));
  const available = Math.max(0, (customer.creditLimit || 0) - outstanding);
  if (amount > available) return res.status(400).json({ message: `Insufficient available credit. Available ₹${available.toFixed(2)}` });
  const sale = await Transaction.create({ reference: ref('TXN'), customer: customer._id, merchant: req.user._id, amount, description: req.body.description || 'Simulated credit purchase', dueDate: due });

  await notifyUser(
    customer,
    'Credit sale recorded',
    `${req.user.name} recorded a credit sale of ₹${amount.toLocaleString('en-IN')}.`,
    'purchase',
    { transactionId: sale._id, merchantId: req.user._id, amount }
  );

  res.status(201).json(sale);
});

export default router;
