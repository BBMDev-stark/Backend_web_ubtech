// utils/payment/vnpay.js
// Tài liệu chính thức: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
const crypto = require('crypto');
const qs     = require('querystring');

const VNPAY_CONFIG = {
  tmnCode:    process.env.VNPAY_TMN_CODE,       // Mã website merchant
  hashSecret: process.env.VNPAY_HASH_SECRET,    // Chuỗi bí mật
  url:        process.env.VNPAY_URL || 'https://pay.vnpay.vn/vpcpay.html',
  returnUrl:  process.env.VNPAY_RETURN_URL,     // URL callback sau thanh toán
  version:    '2.1.0',
  command:    'pay',
  currCode:   'VND',
  locale:     'vn',
};

// ── Tạo URL thanh toán VNPay ──────────────────────────
const createPaymentUrl = ({ orderId, orderCode, amount, orderInfo, ipAddr, bankCode = '' }) => {
  const date     = new Date();
  const createDate = date.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  const expireDate = new Date(date.getTime() + 15 * 60 * 1000)
    .toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);

  const params = {
    vnp_Version:     VNPAY_CONFIG.version,
    vnp_Command:     VNPAY_CONFIG.command,
    vnp_TmnCode:     VNPAY_CONFIG.tmnCode,
    vnp_Amount:      amount * 100,               // VNPay yêu cầu nhân 100
    vnp_CurrCode:    VNPAY_CONFIG.currCode,
    vnp_TxnRef:      orderCode,                  // mã đơn hàng
    vnp_OrderInfo:   orderInfo || `Thanh toan don hang ${orderCode}`,
    vnp_OrderType:   'other',
    vnp_Locale:      VNPAY_CONFIG.locale,
    vnp_ReturnUrl:   VNPAY_CONFIG.returnUrl,
    vnp_IpAddr:      ipAddr || '127.0.0.1',
    vnp_CreateDate:  createDate,
    vnp_ExpireDate:  expireDate,
  };

  if (bankCode) params.vnp_BankCode = bankCode;

  // Sắp xếp params theo alphabet (yêu cầu của VNPay)
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj, key) => { obj[key] = params[key]; return obj; }, {});

  const signData   = qs.stringify(sortedParams, { encode: false });
  const signature  = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');

  sortedParams.vnp_SecureHash = signature;

  return `${VNPAY_CONFIG.url}?${qs.stringify(sortedParams, { encode: false })}`;
};

// ── Xác thực chữ ký callback từ VNPay ────────────────
const verifyCallback = (query) => {
  const secureHash = query.vnp_SecureHash;
  const params     = { ...query };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj, key) => { obj[key] = params[key]; return obj; }, {});

  const signData  = qs.stringify(sortedParams, { encode: false });
  const checkHash = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');

  return {
    isValid:     checkHash === secureHash,
    isSuccess:   query.vnp_ResponseCode === '00',
    orderCode:   query.vnp_TxnRef,
    amount:      Number(query.vnp_Amount) / 100,
    bankCode:    query.vnp_BankCode,
    bankTranNo:  query.vnp_BankTranNo,
    transactionId: query.vnp_TransactionNo,
    responseCode:  query.vnp_ResponseCode,
  };
};

// ── Mã lỗi VNPay → thông báo tiếng Việt ──────────────
const getResponseMessage = (code) => {
  const messages = {
    '00': 'Giao dịch thành công',
    '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo)',
    '09': 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
    '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
    '11': 'Đã hết hạn chờ thanh toán',
    '12': 'Thẻ/Tài khoản bị khóa',
    '13': 'Nhập sai mật khẩu OTP',
    '24': 'Khách hàng hủy giao dịch',
    '51': 'Tài khoản không đủ số dư',
    '65': 'Tài khoản vượt quá hạn mức giao dịch trong ngày',
    '75': 'Ngân hàng thanh toán đang bảo trì',
    '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
    '99': 'Lỗi không xác định',
  };
  return messages[code] || 'Giao dịch không thành công';
};

module.exports = { createPaymentUrl, verifyCallback, getResponseMessage };
