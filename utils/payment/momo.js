// utils/payment/momo.js
// Tài liệu: https://developers.momo.vn/v3/docs/payment/api/payment-method/
const crypto = require('crypto');
const axios  = require('axios');

const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE,
  accessKey:   process.env.MOMO_ACCESS_KEY,
  secretKey:   process.env.MOMO_SECRET_KEY,
  endpoint:    process.env.MOMO_ENDPOINT || 'https://payment.momo.vn/v2/gateway/api/create',
  redirectUrl: process.env.MOMO_REDIRECT_URL,   // URL redirect sau khi TT
  ipnUrl:      process.env.MOMO_IPN_URL,         // URL nhận callback (IPN)
  requestType: 'payWithMethod',
};

// ── Tạo request thanh toán MoMo ───────────────────────
const createPayment = async ({ orderId, orderCode, amount, orderInfo }) => {
  const requestId   = `${MOMO_CONFIG.partnerCode}_${Date.now()}`;
  const extraData   = '';
  const autoCapture = true;
  const lang        = 'vi';

  // Tạo chữ ký HMAC SHA256
  const rawSignature = [
    `accessKey=${MOMO_CONFIG.accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${MOMO_CONFIG.ipnUrl}`,
    `orderId=${orderCode}`,
    `orderInfo=${orderInfo || `Thanh toan don hang ${orderCode}`}`,
    `partnerCode=${MOMO_CONFIG.partnerCode}`,
    `redirectUrl=${MOMO_CONFIG.redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${MOMO_CONFIG.requestType}`,
  ].join('&');

  const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
    .update(rawSignature)
    .digest('hex');

  const body = {
    partnerCode:  MOMO_CONFIG.partnerCode,
    partnerName:  'Ecommerce VN',
    storeId:      MOMO_CONFIG.partnerCode,
    requestId,
    amount,
    orderId:      orderCode,
    orderInfo:    orderInfo || `Thanh toan don hang ${orderCode}`,
    redirectUrl:  MOMO_CONFIG.redirectUrl,
    ipnUrl:       MOMO_CONFIG.ipnUrl,
    lang,
    requestType:  MOMO_CONFIG.requestType,
    autoCapture,
    extraData,
    signature,
  };

  const response = await axios.post(MOMO_CONFIG.endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  return response.data;
};

// ── Xác thực callback IPN từ MoMo ─────────────────────
const verifyCallback = (body) => {
  const {
    accessKey, amount, extraData, message, orderId,
    orderInfo, orderType, partnerCode, payType,
    requestId, responseCode, resultCode, signature,
    transId,
  } = body;

  const rawSignature = [
    `accessKey=${MOMO_CONFIG.accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseCode=${responseCode}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join('&');

  const checkSignature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
    .update(rawSignature)
    .digest('hex');

  return {
    isValid:       checkSignature === signature,
    isSuccess:     resultCode === 0,
    orderCode:     orderId,
    amount:        Number(amount),
    transactionId: String(transId),
    resultCode,
    message,
  };
};

module.exports = { createPayment, verifyCallback };
