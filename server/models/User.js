import mongoose from 'mongoose';

const kycDocumentSchema = new mongoose.Schema({
  type: { type: String, default: 'other' },
  originalName: { type: String, required: true },
  filename: { type: String, default: '' },
  mimetype: { type: String, default: 'image/jpeg' },
  url: { type: String, default: '' },
  dataUrl: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'merchant', 'admin'], default: 'customer' },
  phone: String,
  address: String,
  kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  kycDocuments: { type: [kycDocumentSchema], default: [] },
  creditLimit: { type: Number, default: 0 },
  autoSettlementEnabled: { type: Boolean, default: false },
  autoSettlementMethod: { type: String, default: 'SIMULATED_UPI' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
