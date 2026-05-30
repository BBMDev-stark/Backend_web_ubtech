// utils/payment/zalopay.js
// Tài liệu: https://docs.zalopay.vn/v2/
const crypto = require('crypto');
const axios  = require('axios');

const ZALO_CONFIG = {
  appId:      process.env.ZALOPAY_APP_ID,
  key1:       process.env.ZALOPAY_KEY1,
  key2:       process.env.ZALOPAY_KEY2,
  endpoint:   process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL,
  redirectUrl: process.env.ZALOPAY_REDIRECT_URL,
};

// ── Tạo request thanh toán ZaloPay ───────────────────
const createPayment = async ({ orderCode, amount, description, userId }) => {
  const date       = new Date();
  const appTransId = `${date.getFullYear().toString().slice(2)}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${orderCode}`;
  const appTime    = date.getTime();

  const embedData  = JSON.stringify({ redirecturl: ZALO_CONFIG.redirectUrl, orderId: orderCode });
  const items      = JSON.stringify([{ itemid: orderCode, itemname: description, itemprice: amount, itemquantity: 1 }]);

  // Tạo chữ ký: appid|apptransid|appuser|amount|apptime|embeddata|item
  const rawMac = [
    ZALO_CONFIG.appId,
    appTransId,
    userId || 'customer',
    amount,
    appTime,
    embedData,
    items,
  ].join('|');

  const mac = crypto.createHmac('sha256', ZALO_CONFIG.key1)
    .update(rawMac)
    .digest('hex');

  const body = {
    app_id:      Number(ZALO_CONFIG.appId),
    app_trans_id: appTransId,
    app_user:    userId || 'customer',
    app_time:    appTime,
    amount,
    item:        items,
    description: description || `Ecommerce VN - Don hang #${orderCode}`,
    embed_data:  embedData,
    bank_code:   '',
    callback_url: ZALO_CONFIG.callbackUrl,
    mac,
  };

  const response = await axios.post(ZALO_CONFIG.endpoint, null, {
    params: body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  return { ...response.data, appTransId };
};

// ── Xác thực callback từ ZaloPay ─────────────────────
const verifyCallback = (body) => {
  try {
    const { data: dataStr, mac: receivedMac } = body;

    const checkMac = crypto.createHmac('sha256', ZALO_CONFIG.key2)
      .update(dataStr)
      .digest('hex');

    if (checkMac !== receivedMac) {
      return { isValid: false, isSuccess: false };
    }

    const data = JSON.parse(dataStr);
    return {
      isValid:       true,
      isSuccess:     data.return_code === 1,
      orderCode:     data.app_trans_id?.split('_')[1],
      amount:        data.amount,
      transactionId: String(data.zp_trans_id),
      appTransId:    data.app_trans_id,
    };
  } catch {
    return { isValid: false, isSuccess: false };
  }
};

module.exports = { createPayment, verifyCallback };
