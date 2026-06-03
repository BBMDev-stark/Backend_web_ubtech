// server.js
// Hỗ trợ cả 2 môi trường:
//   - Local development: chạy trực tiếp với `node server.js` → listen port
//   - Vercel serverless : export app (vercel.json route về file này)

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const connectDB    = require('./config/database');

const app = express();

// ── Kết nối Database ──────────────────────────────────
connectDB().catch(err => {
  console.error('[SERVER] DB connect failed:', err.message);
  // Trong serverless: không gọi process.exit(1) – để request trả 503
  if (!process.env.VERCEL) process.exit(1);
});

// ── Payment Checker Worker (VietQR auto-detection) ────
// Chỉ chạy ở môi trường long-running (local, VPS, Railway, Render…)
// KHÔNG chạy trên Vercel serverless vì mỗi invocation là stateless + short-lived
if (!process.env.VERCEL) {
  const paymentChecker = require('./workers/paymentChecker');
  paymentChecker.start();
  // Graceful shutdown cho long-running
  const shutdown = (sig) => {
    console.log(`\n[SERVER] ${sig} — shutting down...`);
    paymentChecker.stop();
    server.close(() => { console.log('[SERVER] Closed'); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// ── CORS ──────────────────────────────────────────────
// Đọc danh sách domain cho phép từ biến môi trường CLIENT_URL
// Có thể set nhiều domain cách nhau bằng dấu phẩy, ví dụ:
//   CLIENT_URL=https://myshop.vercel.app,https://ubtechvietnam.com
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, mobile app, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Localhost khi dev
    if (origin.includes('localhost')) {
      return callback(null, true);
    }

    try {
      const hostname = new URL(origin).hostname;

      // Cho phép mọi subdomain *.vercel.app
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      // Cho phép các domain custom được khai báo trong CLIENT_URL
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    } catch (err) {
      return callback(new Error('Invalid origin'));
    }

    // Chặn các domain khác
    return callback(new Error(`CORS blocked: ${origin}`));
  },

  credentials: true,
}));

// ── Middleware cơ bản ─────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Input Sanitization ───────────────────────────────
const { sanitizeBody } = require('./middleware/validate.middleware');
app.use(sanitizeBody);

// ── Rate Limiting ─────────────────────────────────────
// In-memory rate limiter phù hợp single-instance / dev.
// Production multi-instance: dùng express-rate-limit + Redis (xem rateLimit.middleware.js)
const { createRateLimiter } = require('./middleware/rateLimit.middleware');
const apiLimiter  = createRateLimiter({ windowMs: 60_000, max: 150, message: 'Qua nhieu yeu cau, thu lai sau 1 phut.' });
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 15,  message: 'Qua nhieu lan thu, vui long thu lai sau.' });

// ── Security headers ──────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Request logger (dev only) ─────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms    = Date.now() - start;
      const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[${res.statusCode}]\x1b[0m ${req.method} ${req.path} — ${ms}ms`);
    });
    next(); 
  });
}

// ── Routes ────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth.route'));
app.use('/api/products', apiLimiter,  require('./routes/product.route'));
app.use('/api/cart',     apiLimiter,  require('./routes/cart.route'));
app.use('/api/orders',   apiLimiter,  require('./routes/order.route'));
app.use('/api/reviews',  apiLimiter,  require('./routes/review.route'));
app.use('/api/users',    apiLimiter,  require('./routes/user.route'));
app.use('/api/payments', apiLimiter,  require('./routes/payment.route'));

// ── Health check ──────────────────────────────────────
app.get('/', (_req, res) => res.json({
  success: true,
  message: 'UBTECH Shop API',
  version: '2.0.0',
  time: new Date().toISOString(),
}));

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  serverless: !!process.env.VERCEL,
}));

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route khong ton tai: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────
app.use((err, req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Loi server, vui long thu lai';

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 && { stack: err.stack }),
  });
});

// ── Khởi động server (chỉ khi chạy local, không phải Vercel) ─────────
let server;
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () => {
    console.log(`[SERVER] Running → http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
  process.on('unhandledRejection', (r) => console.error('[UNHANDLED]', r));
}

// Export app cho Vercel serverless
module.exports = app;