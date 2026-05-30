// workers/paymentChecker.js
//
// Worker kiểm tra thanh toán VietQR / bank_transfer định kỳ.
//
// Khởi động từ server.js:
//   const paymentChecker = require('./workers/paymentChecker');
//   paymentChecker.start();

'use strict';

const { runVerificationCycle } = require('../services/paymentVerification');

const CHECK_INTERVAL_MS         = parseInt(process.env.PAYMENT_CHECK_INTERVAL_MS  || '5000',  10);
const MAX_BACKOFF_MS            = parseInt(process.env.PAYMENT_MAX_BACKOFF_MS     || '60000', 10);
const BACKOFF_MULTIPLIER        = parseFloat(process.env.PAYMENT_BACKOFF_MULT     || '2');
const MAX_ERRORS_BEFORE_BACKOFF = parseInt(process.env.PAYMENT_MAX_ERRORS        || '3',     10);

let _timer          = null;
let _running        = false;
let _consecutiveErr = 0;
let _currentInterval= CHECK_INTERVAL_MS;
let _cycleCount     = 0;
let _totalMatched   = 0;

const tag = '[PaymentChecker]';

async function tick() {
  if (!_running) return;
  _cycleCount++;
  const start = Date.now();

  try {
    const stats   = await runVerificationCycle();
    const elapsed = Date.now() - start;

    if (stats.matched > 0) {
      _totalMatched += stats.matched;
      console.log(tag, `✅ Chu kỳ #${_cycleCount} — khớp ${stats.matched}/${stats.checked} GD (${elapsed}ms)`);
    }
    if (stats.errors > 0) {
      console.warn(tag, `Chu kỳ #${_cycleCount} — ${stats.errors} lỗi (${elapsed}ms)`);
    } else if (_cycleCount % 60 === 0) {
      console.log(tag, `Chu kỳ #${_cycleCount} — OK, ${stats.checked} GD, tổng khớp: ${_totalMatched} (${elapsed}ms)`);
    }

    if (_consecutiveErr > 0) {
      console.log(tag, `Kết nối API ngân hàng phục hồi sau ${_consecutiveErr} lần lỗi.`);
      _consecutiveErr  = 0;
      _currentInterval = CHECK_INTERVAL_MS;
    }
  } catch (e) {
    _consecutiveErr++;
    console.error(tag, `Lỗi chu kỳ #${_cycleCount}:`, e.message);
    if (_consecutiveErr >= MAX_ERRORS_BEFORE_BACKOFF) {
      const next = Math.min(_currentInterval * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      if (next !== _currentInterval) {
        console.warn(tag, `${_consecutiveErr} lỗi liên tiếp → interval: ${_currentInterval}ms → ${next}ms`);
        _currentInterval = next;
      }
    }
  }

  if (_running) _timer = setTimeout(tick, _currentInterval);
}

function start() {
  if (_running) { console.warn(tag, 'Đã đang chạy.'); return; }

  const provider = (process.env.BANK_PROVIDER || 'casso').toLowerCase();
  const hasKey   =
    (provider === 'casso' && process.env.CASSO_API_KEY) ||
    (provider === 'sepay' && process.env.SEPAY_API_KEY);

  if (!hasKey) {
    console.warn(tag,
      `BANK_PROVIDER="${provider}" nhưng API key chưa cấu hình. Worker KHÔNG khởi động.`,
      `Thêm ${provider === 'casso' ? 'CASSO_API_KEY' : 'SEPAY_API_KEY'} vào .env`
    );
    return;
  }

  _running = true; _consecutiveErr = 0; _currentInterval = CHECK_INTERVAL_MS; _cycleCount = 0;
  console.log(tag, `Khởi động — provider=${provider} interval=${CHECK_INTERVAL_MS}ms maxBackoff=${MAX_BACKOFF_MS}ms`);
  _timer = setTimeout(tick, 1000);
}

function stop() {
  if (!_running) return;
  _running = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
  console.log(tag, `Đã dừng sau ${_cycleCount} chu kỳ. Tổng GD khớp: ${_totalMatched}`);
}

function status() {
  return {
    running        : _running,
    cycleCount     : _cycleCount,
    totalMatched   : _totalMatched,
    consecutiveErr : _consecutiveErr,
    currentInterval: _currentInterval,
    provider       : process.env.BANK_PROVIDER || 'casso',
  };
}

module.exports = { start, stop, status };
