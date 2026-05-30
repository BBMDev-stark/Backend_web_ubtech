/**
 * FIX B-11: Rate Limit Middleware
 *
 * Hiện tại dùng in-memory Map — phù hợp single-instance / development.
 *
 * ── Cách chuyển sang Redis (production, multi-instance) ──────────────────
 * npm install express-rate-limit @express-rate-limit/redis ioredis
 *
 * const rateLimit  = require('express-rate-limit');
 * const { RedisStore } = require('@express-rate-limit/redis');
 * const Redis = require('ioredis');
 * const redisClient = new Redis(process.env.REDIS_URL);
 *
 * const createRateLimiter = ({ windowMs, max, message }) => rateLimit({
 *   windowMs,
 *   max,
 *   standardHeaders: true,
 *   legacyHeaders: false,
 *   message: { success: false, message },
 *   store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }),
 * });
 * ─────────────────────────────────────────────────────────────────────────
 */

const rateLimitStore = new Map();

// Dọn store mỗi phút để tránh memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.resetAt) rateLimitStore.delete(k);
  }
}, 60_000);

/**
 * @param {{ windowMs: number, max: number, message: string }} options
 * @returns Express middleware
 */
const createRateLimiter = ({ windowMs, max, message }) => (req, res, next) => {
  // Key theo IP; trong production sau reverse proxy cần thêm trust proxy
  const key  = req.ip;
  const now  = Date.now();
  const data = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > data.resetAt) {
    data.count  = 0;
    data.resetAt = now + windowMs;
  }
  data.count++;
  rateLimitStore.set(key, data);

  // Thêm header chuẩn để client biết giới hạn
  res.setHeader('X-RateLimit-Limit',     max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - data.count));
  res.setHeader('X-RateLimit-Reset',     Math.ceil(data.resetAt / 1000));

  if (data.count > max) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ success: false, message, retryAfter });
  }
  next();
};

module.exports = { createRateLimiter };
