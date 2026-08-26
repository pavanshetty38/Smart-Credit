import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  reference: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, default: 'SIMULATED_UPI' },
  type: { type: String, enum: ['manual', 'auto'], default: 'auto' },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Settlement', schema);
