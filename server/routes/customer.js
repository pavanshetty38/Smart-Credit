import { Router } from 'express';
import { auth, roles } from '../middleware/auth.js';
import { kycUpload } from '../middleware/upload.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Repayment from '../models/Repayment.js';
import Settlement from '../models/Settlement.js';
import { ref, notifyUser } from '../utils.js';
import { runAutoSettlementForCustomer } from '../jobs/autoSettlement.js';

const router = Router();

router.use(auth, roles('customer'));

// --------------------------------------------------
// GET CUSTOMER BALANCE
// --------------------------------------------------
export async function getBalance(id) {
  const transactions = await Transaction.find({
    customer: id,
    status: { $in: ['approved', 'paid'] }
  }).select('amount paidAmount status');

  let outstanding = 0;

  for (const tx of transactions) {
    // A fully paid transaction has no outstanding amount
    if (tx.status === 'paid') {
      continue;
    }

    const amount = Number(tx.amount) || 0;
    const paidAmount = Number(tx.paidAmount) || 0;

    outstanding += Math.max(0, amount - paidAmount);
  }

  const u = await User.findById(id);

  const creditLimit = Math.max(
    0,
    Number(u?.creditLimit) || 0
  );

  return {
    creditLimit,
    outstanding,
    availableCredit: Math.max(
      0,
      creditLimit - outstanding
    )
  };
}
// --------------------------------------------------
// CUSTOMER DASHBOARD
// --------------------------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    const balance = await getBalance(req.user._id);

    const [
      user,
      transactions,
      repayments,
      due,
      settlements
    ] = await Promise.all([
      User.findById(req.user._id).select('-password'),

      Transaction.find({
        customer: req.user._id
      })
        .populate('merchant', 'name email')
        .sort('-createdAt')
        .limit(30),

      Repayment.find({
        customer: req.user._id
      })
        .sort('-createdAt')
        .limit(20),

      Transaction.find({
        customer: req.user._id,
        status: 'approved',
        dueDate: {
          $lte: new Date(
            Date.now() + 7 * 86400000
          )
        }
      })
        .populate('merchant', 'name')
        .sort('dueDate'),

      Settlement.find({
        customer: req.user._id
      })
        .sort('-createdAt')
        .limit(20)
    ]);

    res.json({
      user,
      balance,
      transactions,
      repayments,
      due,
      settlements
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);

    res.status(500).json({
      message: error.message || 'Unable to load customer dashboard'
    });
  }
});

// --------------------------------------------------
// UPDATE CUSTOMER PROFILE
// --------------------------------------------------
router.put('/profile', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        phone: req.body.phone || '',
        address: req.body.address || '',
        kycStatus: 'pending'
      },
      {
        new: true
      }
    ).select('-password');

    res.json({
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);

    res.status(500).json({
      message: error.message || 'Unable to update profile'
    });
  }
});

// --------------------------------------------------
// UPLOAD CUSTOMER KYC DOCUMENTS
// --------------------------------------------------
router.post(
  '/kyc-documents',
  kycUpload.array('documents', 5),
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({
          message: 'Please select at least one KYC document'
        });
      }

      const types = Array.isArray(req.body.types)
        ? req.body.types
        : req.body.types
          ? [req.body.types]
          : [];

      const docs = req.files.map((file, index) => ({
        type: types[index] || 'other',
        originalName: file.originalname,
        filename: file.filename,
        url: `/uploads/kyc/${file.filename}`
      }));

      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            kycDocuments: {
              $each: docs
            }
          },
          $set: {
            kycStatus: 'pending'
          }
        },
        {
          new: true
        }
      ).select('-password');

      const admins = await User.find({
        role: 'admin'
      }).select('_id');

      await Promise.all(
        admins.map(admin =>
          notifyUser(
            admin,
            'New customer KYC submitted',
            `${user.name} uploaded KYC documents and is awaiting approval.`,
            'kyc',
            {
              userId: user._id
            }
          )
        )
      );

      res.status(201).json({
        user,
        documents: docs,
        message: 'KYC documents uploaded. Awaiting admin approval.'
      });
    } catch (error) {
      console.error('KYC upload error:', error);

      res.status(500).json({
        message: error.message || 'KYC upload failed'
      });
    }
  }
);

// --------------------------------------------------
// AUTO SETTLEMENT CONFIGURATION
// --------------------------------------------------
router.patch('/auto-settlement', async (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const method = req.body.method || 'SIMULATED_AUTO_DEBIT';

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        autoSettlementEnabled: enabled,
        autoSettlementMethod: method
      },
      {
        new: true
      }
    ).select('-password');

    res.json({
      user,
      message: enabled
        ? 'Auto Settlement enabled. Your dues will be automatically settled every morning at 08:00 AM.'
        : 'Auto Settlement disabled.'
    });
  } catch (error) {
    console.error('Auto settlement error:', error);
    res.status(500).json({
      message: error.message || 'Unable to update auto settlement settings'
    });
  }
});

// --------------------------------------------------
// TRIGGER INSTANT AUTO SETTLEMENT (MANUAL / TEST RUN)
// --------------------------------------------------
router.post('/auto-settlement/run', async (req, res) => {
  try {
    const result = await runAutoSettlementForCustomer(req.user._id, true);
    const balance = await getBalance(req.user._id);
    const user = await User.findById(req.user._id).select('-password');
    const settlements = await Settlement.find({ customer: req.user._id }).sort('-createdAt').limit(20);
    const transactions = await Transaction.find({ customer: req.user._id }).populate('merchant', 'name email').sort('-createdAt').limit(30);

    res.json({
      success: true,
      message: result.settled
        ? `Auto Settlement executed successfully for ₹${result.settledAmount.toLocaleString('en-IN')}.`
        : (result.message || 'No outstanding dues to auto settle.'),
      result,
      balance,
      user,
      settlements,
      transactions
    });
  } catch (error) {
    console.error('Auto settlement run error:', error);
    res.status(500).json({
      message: error.message || 'Failed to execute auto settlement'
    });
  }
});

// --------------------------------------------------
// CUSTOMER CREDIT PURCHASE
// --------------------------------------------------
router.post('/purchase', async (req, res) => {
  try {
    const merchantId = req.body.merchantId;

    const merchant = await User.findOne({
      _id: merchantId,
      role: 'merchant',
      kycStatus: 'approved'
    });

    const customer = await User.findById(
      req.user._id
    );

    const amount = Number(req.body.amount);

    if (!merchant) {
      return res.status(400).json({
        message: 'Merchant not found or not approved'
      });
    }

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found'
      });
    }

    if (customer.kycStatus !== 'approved') {
      return res.status(403).json({
        message: 'Customer KYC must be approved'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount'
      });
    }

    const balance = await getBalance(
      customer._id
    );

    if (amount > balance.availableCredit) {
      return res.status(400).json({
        message:
          `Insufficient available credit. Available ₹${balance.availableCredit.toFixed(2)}`
      });
    }

    const sale = await Transaction.create({
      reference: ref('TXN'),
      customer: customer._id,
      merchant: merchant._id,
      amount,
      description:
        req.body.description || 'QR credit purchase',
      dueDate: req.body.dueDate
        ? new Date(req.body.dueDate)
        : new Date(
            Date.now() + 30 * 86400000
          )
    });

    const updatedBalance = await getBalance(
      customer._id
    );

    await notifyUser(
      customer,
      'Credit purchase successful',
      `Your credit purchase of ₹${amount.toLocaleString('en-IN')} at ${merchant.name} was successful.`,
      'purchase',
      {
        transactionId: sale._id,
        merchantId: merchant._id,
        amount
      }
    );

    await notifyUser(
      merchant,
      'New credit purchase',
      `${customer.name} made a credit purchase of ₹${amount.toLocaleString('en-IN')}.`,
      'purchase',
      {
        transactionId: sale._id,
        customerId: customer._id,
        amount
      }
    );

    res.status(201).json({
      transaction: sale,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email
      },
      balance: updatedBalance
    });
  } catch (error) {
    console.error('Purchase error:', error);

    res.status(500).json({
      message: error.message || 'Purchase failed'
    });
  }
});

// --------------------------------------------------
// CUSTOMER REPAYMENT
// --------------------------------------------------
router.post('/repay', async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    const balance = await getBalance(
      req.user._id
    );

    if (
      !amount ||
      amount <= 0 ||
      amount > balance.outstanding
    ) {
      return res.status(400).json({
        message: 'Invalid repayment amount'
      });
    }

    const repayment = await Repayment.create({
      reference: ref('REP'),
      customer: req.user._id,
      amount,
      method:
        req.body.method || 'SIMULATED_UPI'
    });

    await settleTransactionsForCustomer(
      req.user._id,
      amount
    );

    const updatedBalance = await getBalance(
      req.user._id
    );

    await notifyUser(
      req.user._id,
      'Repayment successful',
      `Your repayment of ₹${amount.toLocaleString('en-IN')} was recorded successfully.`,
      'repayment',
      {
        repaymentId: repayment._id,
        amount
      }
    );

    res.status(201).json({
      repayment,
      balance: updatedBalance,
      message:
        updatedBalance.outstanding === 0
          ? 'Payment completed successfully'
          : 'Repayment successful'
    });
  } catch (error) {
    console.error('Repayment error:', error);

    res.status(500).json({
      message: error.message || 'Repayment failed'
    });
  }
});

// --------------------------------------------------
// SETTLE CUSTOMER TRANSACTIONS
// --------------------------------------------------
export async function settleTransactionsForCustomer(customerId, amount) {
  let remainingPayment = Number(amount) || 0;

  if (remainingPayment <= 0) {
    return;
  }

  const transactions = await Transaction.find({
    customer: customerId,
    status: 'approved'
  }).sort('createdAt');

  for (const tx of transactions) {
    if (remainingPayment <= 0) {
      break;
    }

    const transactionAmount = Number(tx.amount) || 0;
    const alreadyPaid = Number(tx.paidAmount) || 0;

    const remainingOnTransaction = Math.max(
      0,
      transactionAmount - alreadyPaid
    );

    if (remainingOnTransaction <= 0) {
      tx.paidAmount = transactionAmount;
      tx.status = 'paid';
      tx.settlementStatus = 'settled';
      tx.settledAt = new Date();
      await tx.save();
      continue;
    }

    const paymentForThisTransaction = Math.min(
      remainingPayment,
      remainingOnTransaction
    );

    tx.paidAmount = alreadyPaid + paymentForThisTransaction;

    remainingPayment -= paymentForThisTransaction;

    // Fully paid
    if (tx.paidAmount >= transactionAmount) {
      tx.paidAmount = transactionAmount;
      tx.status = 'paid';
      tx.settlementStatus = 'settled';
      tx.settledAt = new Date();
    }

    await tx.save();
  }
}
// --------------------------------------------------
// GET APPROVED MERCHANTS
// --------------------------------------------------
router.get('/merchants', async (_req, res) => {
  try {
    const merchants = await User.find({
      role: 'merchant',
      kycStatus: 'approved'
    }).select('_id name email');

    res.json(merchants);
  } catch (error) {
    console.error('Get merchants error:', error);

    res.status(500).json({
      message: error.message || 'Unable to load merchants'
    });
  }
});

export default router;