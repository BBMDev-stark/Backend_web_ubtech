// services/emailService.js
// Dịch vụ gửi email — dùng nodemailer + Gmail App Password
//
// Cấu hình trong .env:
//   MAIL_FROM=shopubtech@gmail.com
//   MAIL_PASS=xxxx xxxx xxxx xxxx   ← Gmail App Password (16 ký tự)
//   ADMIN_EMAIL=admin@yourshop.com
//   CLIENT_URL=https://yourshop.com

'use strict';

const nodemailer = require('nodemailer');

const FROM_EMAIL  = process.env.MAIL_FROM    || '';
const MAIL_PASS   = process.env.MAIL_PASS    || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL  || FROM_EMAIL;
const CLIENT_URL  = process.env.CLIENT_URL   || 'http://localhost:3000';
const SHOP_NAME   = process.env.SHOP_NAME    || 'UBTECH Việt Nam';
const SHOP_PHONE  = process.env.NEXT_PUBLIC_PHONE || process.env.ZALO_PHONE || '0915594103';

// ── Tạo transporter (lazy, chỉ tạo 1 lần) ────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!FROM_EMAIL || !MAIL_PASS) {
    console.warn('[EmailService] MAIL_FROM hoặc MAIL_PASS chưa cấu hình → email bị tắt');
    return null;
  }
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL, pass: MAIL_PASS },
  });
  return _transporter;
}

async function sendMail({ to, subject, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[EmailService] ⚠ Email chưa cấu hình. Kiểm tra MAIL_FROM và MAIL_PASS trong .env');
    return;
  }
  try {
    const info = await transport.sendMail({
      from: `"${SHOP_NAME}" <${FROM_EMAIL}>`,
      to, subject, html,
    });
    console.log(`[EmailService] ✉ Gửi OK → ${to} | ${subject} | msgId: ${info.messageId}`);
  } catch (err) {
    // Giải thích lỗi thường gặp
    let hint = '';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      hint = '\n  → MAIL_PASS sai! Cần dùng Gmail App Password (16 ký tự), không phải mật khẩu Gmail thường.\n  → Tạo tại: https://myaccount.google.com/apppasswords';
    } else if (err.code === 'ECONNREFUSED') {
      hint = '\n  → Không kết nối được SMTP. Kiểm tra mạng/firewall.';
    } else if (err.responseCode === 534) {
      hint = '\n  → Gmail yêu cầu bật 2-Factor Authentication trước khi tạo App Password.';
    }
    console.error(`[EmailService] ❌ Lỗi gửi email → ${to}: ${err.message}${hint}`);
  }
}

// ── Format tiền VND ────────────────────────────────────────────────────
const vnd = n => Number(n).toLocaleString('vi-VN') + 'đ';

// ── Template HTML dùng chung ──────────────────────────────────────────
function wrapTemplate(title, body) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#0057FF,#338BFF); padding:28px 32px; }
    .header h1 { color:#fff; margin:0; font-size:22px; font-weight:800; }
    .header p  { color:rgba(255,255,255,.8); margin:4px 0 0; font-size:14px; }
    .body { padding:28px 32px; }
    .order-code { background:#EEF3FF; border-radius:12px; padding:16px 20px; margin:20px 0; text-align:center; }
    .order-code span { font-size:24px; font-weight:900; color:#0057FF; font-family:monospace; letter-spacing:1px; }
    table.items { width:100%; border-collapse:collapse; margin:16px 0; }
    table.items th { background:#f5f7fa; padding:8px 12px; text-align:left; font-size:12px; color:#6b7280; font-weight:600; }
    table.items td { padding:10px 12px; border-bottom:1px solid #f0f0f0; font-size:14px; }
    .total-row td { font-weight:700; font-size:15px; border-top:2px solid #0057FF; padding-top:12px; }
    .addr-box { background:#f9fafb; border-radius:10px; padding:14px 18px; margin:16px 0; font-size:14px; line-height:1.7; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; }
    .badge-blue   { background:#EEF3FF; color:#0057FF; }
    .badge-green  { background:#DCFCE7; color:#16a34a; }
    .badge-orange { background:#FFF7ED; color:#ea580c; }
    .btn { display:inline-block; padding:12px 28px; background:#0057FF; color:#fff !important; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px; }
    .footer { background:#f5f7fa; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; }
    .footer a { color:#0057FF; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${SHOP_NAME}</h1>
      <p>Nhà phân phối độc quyền Robot & AI Giáo Dục</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      ${SHOP_NAME} · ☎ ${SHOP_PHONE} · <a href="${CLIENT_URL}">${CLIENT_URL.replace('https://','').replace('http://','')}</a><br/>
      Email này được gửi tự động, vui lòng không trả lời.
    </div>
  </div>
</body>
</html>`;
}

// ── Render bảng sản phẩm ──────────────────────────────────────────────
function itemsTable(items) {
  const rows = items.map(i => `
    <tr>
      <td>${i.name}${i.variantName ? ` <span style="color:#9ca3af;font-size:12px">(${i.variantName})</span>` : ''}</td>
      <td style="text-align:center">×${i.quantity}</td>
      <td style="text-align:right">${vnd(i.price)}</td>
      <td style="text-align:right;font-weight:600">${vnd(i.subtotal)}</td>
    </tr>`).join('');
  return `
    <table class="items">
      <thead><tr><th>Sản phẩm</th><th style="text-align:center">SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Render địa chỉ giao hàng ──────────────────────────────────────────
function addrBlock(addr) {
  return `
    <div class="addr-box">
      <strong>${addr.fullName}</strong> · ${addr.phone}<br/>
      ${addr.street}, ${addr.ward}, ${addr.district}, ${addr.province}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// 1. Email xác nhận đặt hàng — gửi cho KHÁCH
// ════════════════════════════════════════════════════════════════════════
async function sendOrderConfirmationToCustomer(order, userEmail) {
  if (!userEmail) return;

  const payLabel = {
    cod          : '💰 Thanh toán khi nhận hàng (COD)',
    vietqr       : '📱 VietQR — Chờ thanh toán',
    bank_transfer: '🏦 Chuyển khoản ngân hàng',
  }[order.paymentMethod] || order.paymentMethod;

  const body = `
    <p style="font-size:16px">Xin chào <strong>${order.shippingAddress?.fullName || 'Quý khách'}</strong>,</p>
    <p>Cảm ơn bạn đã đặt hàng tại <strong>${SHOP_NAME}</strong>! 🎉<br/>
    Đơn hàng của bạn đã được ghi nhận thành công.</p>

    <div class="order-code"><span>${order.orderCode}</span></div>

    ${itemsTable(order.items)}

    <table style="width:100%;font-size:14px;margin-bottom:20px">
      <tr><td style="color:#6b7280">Tạm tính</td><td style="text-align:right">${vnd(order.itemsTotal)}</td></tr>
      ${order.discount > 0 ? `<tr><td style="color:#16a34a">Giảm giá (${order.coupon?.code || ''})</td><td style="text-align:right;color:#16a34a">-${vnd(order.discount)}</td></tr>` : ''}
      <tr><td style="color:#6b7280">Phí vận chuyển</td><td style="text-align:right">${order.shippingFee === 0 ? '<span style="color:#16a34a">Miễn phí</span>' : vnd(order.shippingFee)}</td></tr>
      <tr style="font-size:18px;font-weight:800"><td>TỔNG CỘNG</td><td style="text-align:right;color:#0057FF">${vnd(order.totalAmount)}</td></tr>
    </table>

    <p><strong>Phương thức thanh toán:</strong> ${payLabel}</p>

    <p><strong>Địa chỉ giao hàng:</strong></p>
    ${addrBlock(order.shippingAddress)}

    ${order.paymentMethod === 'vietqr' ? `
    <div style="background:#EEF3FF;border-radius:12px;padding:16px 20px;margin:20px 0;border-left:4px solid #0057FF">
      <p style="margin:0 0 8px;font-weight:700;color:#0057FF">📱 Hướng dẫn thanh toán VietQR</p>
      <p style="margin:0;font-size:14px;color:#374151">Quét QR hoặc chuyển khoản đúng nội dung <strong>${order.orderCode}</strong> để đơn hàng được xác nhận tự động.</p>
      <a href="${CLIENT_URL}/tai-khoan/don-hang" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#0057FF;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px">Xem & Thanh toán ngay →</a>
    </div>` : ''}

    <p style="text-align:center;margin-top:28px">
      <a class="btn" href="${CLIENT_URL}/tai-khoan/don-hang">Theo dõi đơn hàng →</a>
    </p>
    <p style="font-size:13px;color:#9ca3af;margin-top:24px">
      Cần hỗ trợ? Liên hệ chúng tôi qua Zalo: <strong>${SHOP_PHONE}</strong>
    </p>`;

  await sendMail({
    to     : userEmail,
    subject: `✅ Xác nhận đơn hàng ${order.orderCode} — ${SHOP_NAME}`,
    html   : wrapTemplate(`Xác nhận đơn hàng ${order.orderCode}`, body),
  });
}

// ════════════════════════════════════════════════════════════════════════
// 2. Email thông báo đơn mới — gửi cho ADMIN
// ════════════════════════════════════════════════════════════════════════
async function sendNewOrderNotificationToAdmin(order, userEmail) {
  const payLabel = {
    cod          : 'COD — Thu tiền khi giao',
    vietqr       : 'VietQR — Chờ khách thanh toán',
    bank_transfer: 'Chuyển khoản thủ công',
  }[order.paymentMethod] || order.paymentMethod;

  const body = `
    <p>🔔 Có đơn hàng mới cần xử lý!</p>

    <div class="order-code"><span>${order.orderCode}</span></div>

    <table style="width:100%;font-size:14px;margin-bottom:16px">
      <tr><td style="color:#6b7280;width:40%">Khách hàng</td><td><strong>${order.shippingAddress?.fullName}</strong></td></tr>
      <tr><td style="color:#6b7280">Điện thoại</td><td><strong>${order.shippingAddress?.phone}</strong></td></tr>
      <tr><td style="color:#6b7280">Email KH</td><td>${userEmail || '—'}</td></tr>
      <tr><td style="color:#6b7280">Thanh toán</td><td><span class="badge badge-blue">${payLabel}</span></td></tr>
      <tr><td style="color:#6b7280">Tổng tiền</td><td style="font-size:18px;font-weight:900;color:#0057FF">${vnd(order.totalAmount)}</td></tr>
    </table>

    ${itemsTable(order.items)}

    <p><strong>Địa chỉ giao hàng:</strong></p>
    ${addrBlock(order.shippingAddress)}

    ${order.note ? `<p><strong>Ghi chú:</strong> ${order.note}</p>` : ''}

    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="${CLIENT_URL}/admin/orders">Xem tất cả đơn hàng →</a>
    </p>`;

  await sendMail({
    to     : ADMIN_EMAIL,
    subject: `🛒 Đơn hàng mới ${order.orderCode} — ${vnd(order.totalAmount)} — ${SHOP_NAME}`,
    html   : wrapTemplate(`Đơn hàng mới ${order.orderCode}`, body),
  });
}

// ════════════════════════════════════════════════════════════════════════
// 3. Email xác nhận thanh toán thành công — gửi cho KHÁCH
// ════════════════════════════════════════════════════════════════════════
async function sendPaymentConfirmedToCustomer(order, userEmail) {
  if (!userEmail) return;

  const body = `
    <p style="font-size:16px">Xin chào <strong>${order.shippingAddress?.fullName || 'Quý khách'}</strong>,</p>

    <div style="background:#DCFCE7;border-radius:12px;padding:20px;text-align:center;margin:20px 0;border:2px solid #86efac">
      <p style="font-size:28px;margin:0">✅</p>
      <p style="font-size:18px;font-weight:800;color:#16a34a;margin:8px 0 4px">Thanh toán đã được xác nhận!</p>
      <p style="color:#15803d;margin:0;font-size:14px">Đơn hàng của bạn đang được chuẩn bị để giao</p>
    </div>

    <div class="order-code"><span>${order.orderCode}</span></div>

    ${itemsTable(order.items)}

    <p><strong>Địa chỉ nhận hàng:</strong></p>
    ${addrBlock(order.shippingAddress)}

    <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:700;color:#374151">📦 Bước tiếp theo:</p>
      <ol style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:1.8">
        <li>Đội ngũ đóng gói đơn hàng của bạn</li>
        <li>Bàn giao cho đơn vị vận chuyển</li>
        <li>Bạn nhận được mã vận đơn qua email/Zalo</li>
        <li>Nhận hàng tại địa chỉ đã cung cấp</li>
      </ol>
    </div>

    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="${CLIENT_URL}/tai-khoan/don-hang">Theo dõi đơn hàng →</a>
    </p>
    <p style="font-size:13px;color:#9ca3af;margin-top:20px">
      Cần hỗ trợ? Zalo: <strong>${SHOP_PHONE}</strong>
    </p>`;

  await sendMail({
    to     : userEmail,
    subject: `💳 Thanh toán xác nhận — Đơn ${order.orderCode} đang được xử lý`,
    html   : wrapTemplate(`Thanh toán xác nhận ${order.orderCode}`, body),
  });
}

// ════════════════════════════════════════════════════════════════════════
// 4. Email thông báo đã thanh toán — gửi cho ADMIN (cần ship ngay)
// ════════════════════════════════════════════════════════════════════════
async function sendPaymentConfirmedToAdmin(order, userEmail, txId) {
  const body = `
    <p>💳 Đơn hàng đã được thanh toán, cần xử lý giao hàng!</p>

    <div style="background:#DCFCE7;border-radius:12px;padding:16px 20px;margin:16px 0;border-left:4px solid #16a34a">
      <p style="margin:0;font-size:13px;color:#15803d"><strong>Mã giao dịch ngân hàng:</strong> ${txId || 'N/A'}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#15803d"><strong>Thời gian xác nhận:</strong> ${new Date().toLocaleString('vi-VN')}</p>
    </div>

    <div class="order-code"><span>${order.orderCode}</span></div>

    <table style="width:100%;font-size:14px;margin-bottom:16px">
      <tr><td style="color:#6b7280;width:40%">Khách hàng</td><td><strong>${order.shippingAddress?.fullName}</strong></td></tr>
      <tr><td style="color:#6b7280">Điện thoại</td><td><strong>${order.shippingAddress?.phone}</strong></td></tr>
      <tr><td style="color:#6b7280">Email KH</td><td>${userEmail || '—'}</td></tr>
      <tr><td style="color:#6b7280">Tổng tiền</td><td style="font-size:18px;font-weight:900;color:#16a34a">${vnd(order.totalAmount)} ✅</td></tr>
    </table>

    ${itemsTable(order.items)}

    <p><strong>📍 Địa chỉ giao hàng:</strong></p>
    ${addrBlock(order.shippingAddress)}

    ${order.note ? `<div style="background:#fffbeb;border-radius:10px;padding:12px 16px;border-left:3px solid #f59e0b"><strong>📝 Ghi chú KH:</strong> ${order.note}</div>` : ''}

    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="${CLIENT_URL}/admin/orders">Xử lý đơn hàng →</a>
    </p>`;

  await sendMail({
    to     : ADMIN_EMAIL,
    subject: `💰 ĐÃ THANH TOÁN — ${order.orderCode} — ${vnd(order.totalAmount)} — Cần ship ngay!`,
    html   : wrapTemplate(`Đã thanh toán ${order.orderCode}`, body),
  });
}

module.exports = {
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToAdmin,
  sendPaymentConfirmedToCustomer,
  sendPaymentConfirmedToAdmin,
};
