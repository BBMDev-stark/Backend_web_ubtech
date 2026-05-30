// controllers/payment.controller.js
const Order   = require('../models/Order');
const Payment = require('../models/Payment');
const vnpay   = require('../utils/payment/vnpay');
const momo    = require('../utils/payment/momo');
const zalopay = require('../utils/payment/zalopay');

// ── Helper: lấy IP thật của client ───────────────────
const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0] ||
  req.connection?.remoteAddress ||
  '127.0.0.1';

// ════════════════════════════════════════════════════
// TẠO LINK THANH TOÁN
// POST /api/payments/create
// Body: { orderId, provider: 'vnpay'|'momo'|'zalopay'|'bank_transfer' }
// ════════════════════════════════════════════════════
const createPayment = async (req, res) => {
  try {
    const { orderId, provider } = req.body;

    if (!orderId || !provider) {
      return res.status(400).json({ success: false, message: 'Thiếu orderId hoặc provider' });
    }

    const validProviders = ['vnpay', 'momo', 'zalopay', 'bank_transfer', 'vietqr'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, message: `Provider không hợp lệ. Chọn: ${validProviders.join(', ')}` });
    }

    // Lấy đơn hàng
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã được thanh toán rồi' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Không thể thanh toán đơn hàng đã hủy/hoàn tiền' });
    }

    // Xóa payment cũ nếu đang pending (tạo lại link mới)
    await Payment.deleteOne({ order: order._id, status: 'pending' });

    // Tạo bản ghi payment
    const payment = await Payment.create({
      order:    order._id,
      user:     req.user._id,
      provider,
      amount:   order.totalAmount,
      status:   'pending',
    });

    // ── Xử lý theo từng cổng ─────────────────────────

    // 1. VietQR (scan QR chuyển khoản tự động)
    if (provider === 'vietqr') {
      const bankBin     = process.env.BANK_BIN      || '970436';
      const bankAccount = process.env.BANK_ACCOUNT  || '1234567890';
      const bankOwner   = process.env.BANK_OWNER    || 'NGUYEN VAN A';
      const addInfo     = encodeURIComponent(`TT ${order.orderCode}`);
      const qrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.jpg?amount=${order.totalAmount}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankOwner)}`;

      return res.json({
        success: true,
        provider: 'vietqr',
        data: {
          bankName:      process.env.BANK_NAME    || 'Vietcombank',
          accountNumber: bankAccount,
          accountName:   bankOwner,
          amount:        order.totalAmount,
          content:       `TT ${order.orderCode}`,
          qrUrl,
          orderCode:     order.orderCode,
        },
        message: `Quét mã QR để chuyển khoản ${order.totalAmount.toLocaleString('vi-VN')}đ`,
      });
    }

    // 2. Chuyển khoản ngân hàng (manual)
    if (provider === 'bank_transfer') {
      const bankInfo = {
        bankName:      process.env.BANK_NAME       || 'Vietcombank',
        accountNumber: process.env.BANK_ACCOUNT    || '1234567890',
        accountName:   process.env.BANK_OWNER      || 'NGUYEN VAN A',
        branch:        process.env.BANK_BRANCH     || 'Chi nhánh TP.HCM',
        amount:        order.totalAmount,
        content:       `TT ${order.orderCode}`,      // nội dung chuyển khoản
        qrUrl:         `https://img.vietqr.io/image/${process.env.BANK_BIN || '970436'}-${process.env.BANK_ACCOUNT || '1234567890'}-compact2.jpg?amount=${order.totalAmount}&addInfo=TT%20${order.orderCode}&accountName=${encodeURIComponent(process.env.BANK_OWNER || 'NGUYEN VAN A')}`,
      };

      return res.json({
        success: true,
        provider: 'bank_transfer',
        data: bankInfo,
        message: `Chuyển khoản ${order.totalAmount.toLocaleString('vi-VN')}đ với nội dung: TT ${order.orderCode}`,
      });
    }

    // 2. VNPay
    if (provider === 'vnpay') {
      const payUrl = vnpay.createPaymentUrl({
        orderId:   order._id,
        orderCode: order.orderCode,
        amount:    order.totalAmount,
        orderInfo: `Thanh toan don hang ${order.orderCode}`,
        ipAddr:    getClientIp(req),
      });

      return res.json({ success: true, provider: 'vnpay', payUrl });
    }

    // 3. MoMo
    if (provider === 'momo') {
      const result = await momo.createPayment({
        orderId:   order._id,
        orderCode: order.orderCode,
        amount:    order.totalAmount,
        orderInfo: `Thanh toan don hang ${order.orderCode}`,
      });

      if (result.resultCode !== 0) {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed', failReason: result.message, rawResponse: result });
        return res.status(400).json({ success: false, message: result.message || 'Tạo thanh toán MoMo thất bại' });
      }

      return res.json({ success: true, provider: 'momo', payUrl: result.payUrl, deeplink: result.deeplink });
    }

    // 4. ZaloPay
    if (provider === 'zalopay') {
      const result = await zalopay.createPayment({
        orderCode:   order.orderCode,
        amount:      order.totalAmount,
        description: `Thanh toan don hang ${order.orderCode}`,
        userId:      req.user._id.toString(),
      });

      if (result.return_code !== 1) {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed', failReason: result.return_message, rawResponse: result });
        return res.status(400).json({ success: false, message: result.return_message || 'Tạo thanh toán ZaloPay thất bại' });
      }

      return res.json({ success: true, provider: 'zalopay', payUrl: result.order_url, appTransId: result.appTransId });
    }

  } catch (err) {
    console.error('createPayment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo thanh toán' });
  }
};

// ════════════════════════════════════════════════════
// CALLBACK VNPAY (redirect sau khi TT xong)
// GET /api/payments/vnpay/callback
// ════════════════════════════════════════════════════
const vnpayCallback = async (req, res) => {
  try {
    const result = vnpay.verifyCallback(req.query);
    const { isValid, isSuccess, orderCode, amount, transactionId, bankCode, responseCode } = result;

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (!isValid) {
      return res.redirect(`${frontendUrl}/payment/result?status=invalid&message=Chu_ky_khong_hop_le`);
    }

    const order = await Order.findOne({ orderCode });
    if (!order) {
      return res.redirect(`${frontendUrl}/payment/result?status=error&message=Khong_tim_thay_don_hang`);
    }

    if (isSuccess) {
      // Cập nhật đơn hàng
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        paymentMethod: 'vnpay',
        statusHistory: [...order.statusHistory, { status: order.status, note: `VNPay thanh toán thành công. Mã GD: ${transactionId}` }],
      });

      // Cập nhật payment record
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'vnpay', status: 'pending' },
        { status: 'success', transactionId, providerRef: bankCode, paidAt: new Date(), rawResponse: req.query }
      );

      return res.redirect(`${frontendUrl}/payment/result?status=success&orderCode=${orderCode}&amount=${amount}`);
    } else {
      const message = vnpay.getResponseMessage(responseCode);
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'vnpay', status: 'pending' },
        { status: 'failed', failReason: message, rawResponse: req.query }
      );
      return res.redirect(`${frontendUrl}/payment/result?status=failed&orderCode=${orderCode}&message=${encodeURIComponent(message)}`);
    }

  } catch (err) {
    console.error('vnpayCallback error:', err);
    res.redirect(`${process.env.CLIENT_URL}/payment/result?status=error`);
  }
};

// ════════════════════════════════════════════════════
// IPN VNPAY (server-to-server, VNPay gọi vào)
// GET /api/payments/vnpay/ipn
// ════════════════════════════════════════════════════
const vnpayIPN = async (req, res) => {
  try {
    const result = vnpay.verifyCallback(req.query);

    if (!result.isValid) {
      return res.json({ RspCode: '97', Message: 'Invalid checksum' });
    }

    const order = await Order.findOne({ orderCode: result.orderCode });
    if (!order) return res.json({ RspCode: '01', Message: 'Order not found' });

    if (order.paymentStatus === 'paid') {
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (order.totalAmount !== result.amount) {
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }

    if (result.isSuccess) {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'paid' });
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'vnpay' },
        { status: 'success', transactionId: result.transactionId, paidAt: new Date(), rawResponse: req.query }
      );
    }

    res.json({ RspCode: '00', Message: 'Confirmed' });

  } catch (err) {
    console.error('vnpayIPN error:', err);
    res.json({ RspCode: '99', Message: 'Unknown error' });
  }
};

// ════════════════════════════════════════════════════
// CALLBACK MOMO (IPN – MoMo gọi vào server)
// POST /api/payments/momo/callback
// ════════════════════════════════════════════════════
const momoCallback = async (req, res) => {
  try {
    const result = momo.verifyCallback(req.body);

    if (!result.isValid) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const order = await Order.findOne({ orderCode: result.orderCode });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (result.isSuccess) {
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        paymentMethod: 'momo',
      });
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'momo', status: 'pending' },
        { status: 'success', transactionId: result.transactionId, paidAt: new Date(), rawResponse: req.body }
      );
    } else {
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'momo', status: 'pending' },
        { status: 'failed', failReason: result.message, rawResponse: req.body }
      );
    }

    res.json({ message: 'OK' }); // MoMo yêu cầu trả về 200

  } catch (err) {
    console.error('momoCallback error:', err);
    res.status(500).json({ message: 'Error' });
  }
};

// ════════════════════════════════════════════════════
// CALLBACK ZALOPAY
// POST /api/payments/zalopay/callback
// ════════════════════════════════════════════════════
const zalopayCallback = async (req, res) => {
  try {
    const result = zalopay.verifyCallback(req.body);

    if (!result.isValid) {
      return res.json({ return_code: -1, return_message: 'Invalid mac' });
    }

    const order = await Order.findOne({ orderCode: result.orderCode });
    if (!order) return res.json({ return_code: -1, return_message: 'Order not found' });

    if (result.isSuccess) {
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        paymentMethod: 'zalopay',
      });
      await Payment.findOneAndUpdate(
        { order: order._id, provider: 'zalopay', status: 'pending' },
        { status: 'success', transactionId: result.transactionId, paidAt: new Date(), rawResponse: req.body }
      );
    }

    res.json({ return_code: 1, return_message: 'success' }); // ZaloPay yêu cầu trả về này

  } catch (err) {
    console.error('zalopayCallback error:', err);
    res.json({ return_code: 0, return_message: 'Error' });
  }
};

// ════════════════════════════════════════════════════
// XEM LỊCH SỬ THANH TOÁN CỦA ĐƠN HÀNG
// GET /api/payments/order/:orderId
// ════════════════════════════════════════════════════
const getPaymentByOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, data: payments });

  } catch (err) {
    console.error('getPaymentByOrder error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// FIX B-04: [ADMIN] XÁC NHẬN CHUYỂN KHOẢN
// PUT /api/payments/admin/bank-transfer/:orderId/confirm
// Body: { transactionRef? } — mã tham chiếu giao dịch ngân hàng (tuỳ chọn)
// ════════════════════════════════════════════════════
const adminConfirmBankTransfer = async (req, res) => {
  try {
    const { transactionRef = '' } = req.body;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này không dùng phương thức chuyển khoản' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã được xác nhận thanh toán rồi' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Không thể xác nhận thanh toán cho đơn đã hủy/hoàn tiền' });
    }

    // Cập nhật trạng thái thanh toán
    order.paymentStatus = 'paid';
    order.statusHistory.push({
      status: order.status,
      note: `Admin xác nhận chuyển khoản thành công${transactionRef ? `. Mã GD: ${transactionRef}` : ''}`,
      updatedBy: req.user._id,
    });
    await order.save();

    // Cập nhật hoặc tạo payment record
    await Payment.findOneAndUpdate(
      { order: order._id, provider: 'bank_transfer' },
      {
        status:       'success',
        transactionId: transactionRef || `MANUAL-${Date.now()}`,
        paidAt:        new Date(),
        rawResponse:  { confirmedBy: req.user._id, confirmedAt: new Date(), transactionRef },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Đã xác nhận thanh toán cho đơn hàng ${order.orderCode}`,
      data: { orderCode: order.orderCode, paymentStatus: order.paymentStatus },
    });

  } catch (err) {
    console.error('adminConfirmBankTransfer error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] XÁC NHẬN VIETQR
// PUT /api/payments/admin/vietqr/:orderId/confirm
// Body: { transactionRef? }
// ════════════════════════════════════════════════════
const confirmVietQR = async (req, res) => {
  try {
    const { transactionRef = '' } = req.body;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (!['vietqr', 'bank_transfer'].includes(order.paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Đơn hàng này không dùng phương thức QR/chuyển khoản' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã được xác nhận thanh toán rồi' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Không thể xác nhận thanh toán cho đơn đã hủy/hoàn tiền' });
    }

    order.paymentStatus = 'paid';
    order.statusHistory.push({
      status: order.status,
      note: `Admin xác nhận VietQR thành công${transactionRef ? `. Mã GD: ${transactionRef}` : ''}`,
      updatedBy: req.user._id,
    });
    await order.save();

    await Payment.findOneAndUpdate(
      { order: order._id, provider: { $in: ['vietqr', 'bank_transfer'] } },
      {
        status:       'success',
        transactionId: transactionRef || `VIETQR-${Date.now()}`,
        paidAt:        new Date(),
        rawResponse:  { confirmedBy: req.user._id, confirmedAt: new Date(), transactionRef },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Đã xác nhận VietQR cho đơn hàng ${order.orderCode}`,
      data: { orderCode: order.orderCode, paymentStatus: order.paymentStatus },
    });

  } catch (err) {
    console.error('confirmVietQR error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};


// ════════════════════════════════════════════════════
// POLLING: KIỂM TRA TRẠNG THÁI THANH TOÁN VIETQR
// GET /api/payments/vietqr/status/:orderCode
// Frontend gọi mỗi 5 giây để biết đơn đã thanh toán chưa
// ════════════════════════════════════════════════════
const { checkOrderPaymentStatus } = require('../services/paymentVerification');

const getVietQRPaymentStatus = async (req, res) => {
  // POLLING ENDPOINT — Public (orderCode đủ dài để bảo mật)
  // Không yêu cầu JWT vì: sau khi clearCart token có thể hết hạn
  // và polling cần tiếp tục để cập nhật UI cho khách
  try {
    const { orderCode } = req.params;
    if (!orderCode) {
      return res.status(400).json({ success: false, message: 'Thiếu orderCode' });
    }
    const result = await checkOrderPaymentStatus(orderCode);
    if (!result.found) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('getVietQRPaymentStatus error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  createPayment,
  vnpayCallback,
  vnpayIPN,
  momoCallback,
  zalopayCallback,
  getPaymentByOrder,
  adminConfirmBankTransfer,
  confirmVietQR,
  getVietQRPaymentStatus,
};
