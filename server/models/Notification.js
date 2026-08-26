import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: [
      'purchase',
      'repayment',
      'settlement',
      'kyc',
      'account',
      'system'
    ],
    default: 'system'
  },
  read: { type: Boolean, default: false, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

schema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', schema);
