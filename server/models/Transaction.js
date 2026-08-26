import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  reference: {
    type: String,
    unique: true
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  // Amount already paid against this transaction
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  description: {
    type: String,
    required: true
  },

  dueDate: {
    type: Date,
    required: true
  },

  status: {
    type: String,
    enum: ['approved', 'paid', 'disputed'],
    default: 'approved'
  },

  settlementStatus: {
    type: String,
    enum: ['pending', 'settled'],
    default: 'pending'
  },

  settledAt: Date,

  disputeNote: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transaction', schema);