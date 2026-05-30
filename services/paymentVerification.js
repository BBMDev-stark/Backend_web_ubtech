// services/paymentVerification.js
//
// Dịch vụ kiểm tra giao dịch ngân hàng tự động cho VietQR / bank_transfer.
//
// Hỗ trợ 2 provider:
//   - Casso  (https://casso.vn)  — BANK_PROVIDER=casso  (mặc định)
//   - SePay  (https://sepay.vn)  — BANK_PROVIDER=sepay
//
// Flow:
//   1. Kéo giao dịch gần nhất từ API ngân hàng
//   2. Kiểm tra nội dung có chứa orderCode không
//   3. Nếu khớp orderCode + số tiền → xác nhận thanh toán + trừ tồn kho

'use strict';

const axios   = require('axios');
const Order   = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const User    = require('../models/User');
const emailService = require('./emailService');

const BANK_PROVIDER    = (process.env.BANK_PROVIDER || 'casso').toLowerCase();
const CASSO_API_KEY    = process.env.CASSO_API_KEY    || '';
const SEPAY_API_KEY    = process.env.SEPAY_API_KEY    || '';
const SEPAY_ACCOUNT_ID = process.env.SEPAY_ACCOUNT_ID || '';
const TRANSFER_PREFIX  = process.env.TRANSFER_PREFIX  || 'TT';

// ── Adapter Casso ─────────────────────────────────────────────────────
async function fetchCassoTransactions() {
  if (!CASSO_API_KEY) throw new Error('[PaymentVerification] CASSO_API_KEY chưa cấu hình trong .env');

  const resp = await axios.get('https://api.casso.vn/v2/transactions', {
    params : { limit: 50, sort: 'DESC' },
    headers: { Authorization: `apikey ${CASSO_API_KEY}` },
    timeout: 10_000,
  });

  if (resp.data?.error !== 0) throw new Error(`[PaymentVerification] Casso API error: ${JSON.stringify(resp.data)}`);

  return (resp.data?.data?.records ?? []).map(tx => ({
    id         : String(tx.id),
    amount     : Number(tx.amount),
    description: String(tx.description || ''),
    when       : new Date(tx.when || tx.bookingDate || Date.now()),
    bankRef    : tx.bankSubAccId || '',
  }));
}

// ── Adapter SePay ─────────────────────────────────────────────────────
async function fetchSepayTransactions() {
  if (!SEPAY_API_KEY) throw new Error('[PaymentVerification] SEPAY_API_KEY chưa cấu hình trong .env');

  const params = { limit: 50 };
  if (SEPAY_ACCOUNT_ID) params.account_number = SEPAY_ACCOUNT_ID;

  const resp = await axios.get('https://my.sepay.vn/userapi/transactions/list', {
    params,
    headers: { Authorization: `Bearer ${SEPAY_API_KEY}` },
    timeout: 10_000,
  });

  if (resp.data?.status !== 200) throw new Error(`[PaymentVerification] SePay API error: ${JSON.stringify(resp.data)}`);

  return (resp.data?.transactions ?? []).map(tx => ({
    id         : String(tx.id),
    amount     : Number(tx.amount_in),
    description: String(tx.transaction_content || ''),
    when       : new Date(tx.transaction_date || Date.now()),
    bankRef    : tx.reference_number || '',
  }));
}

async function fetchBankTransactions() {
  switch (BANK_PROVIDER) {
    case 'casso': return fetchCassoTransactions();
    case 'sepay': return fetchSepayTransactions();
    default: throw new Error(`[PaymentVerification] BANK_PROVIDER không hợp lệ: "${BANK_PROVIDER}"`);
  }
}

// ── Parse orderCode từ nội dung chuyển khoản ─────────────────────────
// Nhiều ngân hàng (Timo, MB, Viettel Money...) tự xử lý nội dung CK:
//   - Timo: xóa dấu - giữa phần đầu → "ORD20260312211335079-9661D5"
//   - Một số NH: xóa toàn bộ dấu -  → "ORD202603122113350799661D5"
//   - Một số NH: thêm space          → "ORD-20260312 211335079 9661D5"
//
// Format orderCode: ORD-YYYYMMDD-HHmmssSSS-RRRRRR
//   YYYYMMDD  = 8 số (ngày)
//   HHmmssSSS = 9 số (giờ:phút:giây:ms)
//   RRRRRR    = 6 ký tự hex (random suffix)
//
// Chiến lược: extract ký tự có thể là orderCode, chuẩn hoá rồi khớp DB
function parseOrderCodeFromDescription(description) {
  if (!description) return null;
  // Xóa space thừa, uppercase, xóa ký tự đặc biệt không phải alphanum/gạch/space
  const text = description.trim().toUpperCase()
    .replace(/[^A-Z0-9\-\s]/g, ' ')
    .replace(/\s+/g, ' ');

  // 1. Khớp chính xác có đầy đủ dấu gạch
  //    ORD-20260312-211335079-9661D5
  const exact = text.match(/\b(ORD-\d{8}-\d{9}-[A-F0-9]{6})\b/);
  if (exact) return exact[1];

  // 2. Timo: xóa dấu - đầu, giữ suffix
  //    ORD20260312211335079-9661D5  (8+9=17 số liền, rồi - rồi 6 hex)
  const timoFmt = text.match(/\b(ORD(\d{8})(\d{9})-([A-F0-9]{6}))\b/);
  if (timoFmt) return `ORD-${timoFmt[2]}-${timoFmt[3]}-${timoFmt[4]}`;

  // 3. Không có dấu gạch nào: 8 số ngày + 9 số giờ + 6 hex liền nhau (23 ký tự sau ORD)
  //    ORD202603122113350799661D5
  const allJoined = text.match(/\b(ORD(\d{8})(\d{9})([A-F0-9]{6}))\b/);
  if (allJoined) return `ORD-${allJoined[2]}-${allJoined[3]}-${allJoined[4]}`;

  // 4. Có space thay vì dấu gạch
  //    ORD 20260312 211335079 9661D5  hoặc  ORD-20260312 211335079 9661D5
  const spaced = text.match(/\bORD[-\s]?(\d{8})[-\s](\d{9})[-\s]([A-F0-9]{6})\b/);
  if (spaced) return `ORD-${spaced[1]}-${spaced[2]}-${spaced[3]}`;

  // 5. Fallback: ORD + 17-23 ký tự alphanum (bất kỳ biến thể lạ nào)
  const loose = text.match(/\b(ORD[-]?[A-Z0-9-]{17,28})\b/);
  if (loose) {
    // Strip toàn bộ dấu gạch khỏi phần sau ORD rồi khôi phục
    const raw = loose[1].replace(/^ORD-?/, '').replace(/-/g,'');
    if (raw.length >= 23) {
      const d = raw.slice(0, 8);   // YYYYMMDD
      const t = raw.slice(8, 17);  // HHmmssSSS
      const s = raw.slice(17, 23); // RRRRRR
      return `ORD-${d}-${t}-${s}`;
    }
  }

  return null;
}

// ── Tìm orderCode thực sự từ DB dựa trên nội dung CK ─────────────────
// Vì ngân hàng có thể thay đổi format, ta tìm kiếm DB với nhiều biến thể
async function findOrderByDescription(description) {
  const candidate = parseOrderCodeFromDescription(description);
  if (!candidate) return null;

  // Thử khớp chính xác trước
  let order = await Order.findOne({ orderCode: candidate });
  if (order) return order;

  // Thử khớp không phân biệt dấu gạch:
  // Strip tất cả dấu gạch rồi so sánh
  const stripped = candidate.replace(/-/g, '');
  // Dùng aggregate để so sánh sau khi strip
  const results = await Order.aggregate([
    { $match: {
        paymentStatus: { $ne: 'paid' },
        status: { $nin: ['cancelled', 'refunded'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 ngày
    }},
    { $addFields: { codeStripped: { $replaceAll: { input: '$orderCode', find: '-', replacement: '' } } } },
    { $match: { codeStripped: stripped } },
    { $limit: 1 },
  ]);

  return results.length > 0 ? await Order.findById(results[0]._id) : null;
}

// ── Giảm tồn kho ──────────────────────────────────────────────────────
async function deductInventory(order) {
  await Promise.all(order.items.map(async item => {
    try {
      if (item.variantId) {
        await Product.findOneAndUpdate(
          { _id: item.product, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': -item.quantity, soldCount: item.quantity } }
        );
      } else {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity, soldCount: item.quantity },
        });
      }
    } catch (err) {
      console.warn(`[PaymentVerification] Không trừ được tồn kho product ${item.product}:`, err.message);
    }
  }));
}

// ── Xác nhận một giao dịch ────────────────────────────────────────────
async function verifyTransaction(tx) {
  // Dùng findOrderByDescription: xử lý được cả khi ngân hàng xóa dấu "-"
  const order = await findOrderByDescription(tx.description);
  const orderCode = order?.orderCode || parseOrderCodeFromDescription(tx.description);
  if (!order) {
    if (orderCode) console.log(`[PaymentVerification] Không tìm thấy đơn: "${orderCode}" (raw: "${tx.description}")`);
    return { matched: false, reason: 'order_not_found', orderCode };
  }
  if (order.paymentStatus === 'paid')                     return { matched: false, reason: 'already_paid', orderCode };
  if (!['vietqr','bank_transfer'].includes(order.paymentMethod)) return { matched: false, reason: 'wrong_payment_method', orderCode };
  if (['cancelled','refunded'].includes(order.status))    return { matched: false, reason: 'order_cancelled', orderCode };

  const existing = await Payment.findOne({ transactionId: tx.id, status: 'success' });
  if (existing) return { matched: false, reason: 'transaction_already_processed', orderCode };

  if (tx.amount < order.totalAmount) {
    console.warn(`[PaymentVerification] Số tiền không đủ — orderCode=${orderCode} cần=${order.totalAmount} nhận=${tx.amount}`);
    return { matched: false, reason: 'insufficient_amount', orderCode };
  }

  // ── KHỚP → Xác nhận ──────────────────────────────────────────────
  const now = new Date();
  order.paymentStatus = 'paid';
  order.status        = 'processing';
  order.statusHistory.push({
    status   : 'processing',
    note     : `Tự động xác nhận thanh toán VietQR. Mã GD: ${tx.id}. Số tiền: ${tx.amount.toLocaleString('vi-VN')}đ`,
    updatedBy: null,
    updatedAt: now,
  });
  await order.save();

  await Payment.findOneAndUpdate(
    { order: order._id, provider: { $in: ['vietqr','bank_transfer'] }, status: 'pending' },
    {
      $set: {
        status       : 'success',
        transactionId: tx.id,
        providerRef  : tx.bankRef,
        paidAt       : tx.when || now,
        rawResponse  : { source: BANK_PROVIDER, txId: tx.id, amount: tx.amount, description: tx.description, detectedAt: now.toISOString() },
      },
    },
    { upsert: true, new: true }
  );

  await deductInventory(order);

  console.log(`[PaymentVerification] ✅ Xác nhận thành công — orderCode=${orderCode} amount=${tx.amount} txId=${tx.id}`);

  // ── Gửi email thông báo thanh toán thành công ──────────────
  try {
    const populatedOrder = await Order.findById(order._id).lean();
    const user = order.user ? await User.findById(order.user).select('email').lean() : null;
    const userEmail = user?.email;
    emailService.sendPaymentConfirmedToCustomer(populatedOrder, userEmail).catch(e => console.error('[email]', e.message));
    emailService.sendPaymentConfirmedToAdmin(populatedOrder, userEmail, tx.id).catch(e => console.error('[email]', e.message));
  } catch (emailErr) {
    console.warn('[PaymentVerification] Lỗi gửi email:', emailErr.message);
  }
  return { matched: true, orderCode, amount: tx.amount, txId: tx.id };
}

// ── Chạy một chu kỳ kiểm tra ─────────────────────────────────────────
async function runVerificationCycle() {
  const stats = { checked: 0, matched: 0, errors: 0 };
  let transactions;
  try {
    transactions = await fetchBankTransactions();
  } catch (err) {
    console.error('[PaymentVerification] Lỗi lấy giao dịch:', err.message);
    stats.errors++;
    return stats;
  }
  stats.checked = transactions.length;
  for (const tx of transactions) {
    try {
      const result = await verifyTransaction(tx);
      if (result.matched) stats.matched++;
    } catch (err) {
      stats.errors++;
      console.error(`[PaymentVerification] Lỗi xử lý GD ${tx.id}:`, err.message);
    }
  }
  return stats;
}

// ── Kiểm tra trạng thái đơn (dùng cho polling frontend) ──────────────
async function checkOrderPaymentStatus(orderCode) {
  const order = await Order.findOne({ orderCode }).lean();
  if (!order) return { found: false };
  const payment = await Payment.findOne({ order: order._id, provider: { $in: ['vietqr','bank_transfer'] } })
    .sort({ updatedAt: -1 }).lean();
  return {
    found        : true,
    orderCode,
    paymentStatus: order.paymentStatus,
    orderStatus  : order.status,
    paidAt       : payment?.paidAt || null,
    transactionId: payment?.transactionId || null,
  };
}

module.exports = {
  runVerificationCycle,
  checkOrderPaymentStatus,
  _parseOrderCodeFromDescription: parseOrderCodeFromDescription,
  _verifyTransaction             : verifyTransaction,
  _deductInventory               : deductInventory,
};
