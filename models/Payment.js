// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  provider:      { type: String, enum: ['vnpay', 'momo', 'zalopay', 'bank_transfer', 'vietqr', 'cod'], required: true },
  amount:        { type: Number, required: true },
  currency:      { type: String, default: 'VND' },
  status:        { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
  transactionId: { type: String, default: '' },   // mã giao dịch từ cổng TT
  providerRef:   { type: String, default: '' },   // mã tham chiếu của cổng
  paidAt:        { type: Date, default: null },
  failReason:    { type: String, default: '' },
  rawResponse:   { type: mongoose.Schema.Types.Mixed }, // lưu toàn bộ callback
  refundAmount:  { type: Number, default: 0 },
  refundedAt:    { type: Date, default: null },
  note:          { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ transactionId: 1 }, { sparse: true });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
