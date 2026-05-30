// middleware/validate.middleware.js
// Utility validators dung chung cho cac controller

/**
 * Sanitize string input: trim, strip HTML tags co ban
 */
const sanitizeStr = (str) =>
  typeof str === 'string'
    ? str.trim().replace(/<[^>]*>/g, '')
    : str;

/**
 * Sanitize toan bo req.body (de quy)
 */
const sanitizeBody = (req, _res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') obj[key] = sanitizeStr(obj[key]);
      else if (typeof obj[key] === 'object') sanitize(obj[key]);
    }
    return obj;
  };
  req.body = sanitize(req.body);
  next();
};

/**
 * Kiem tra ObjectId hop le
 */
const { Types } = require('mongoose');
const isValidObjectId = (id) => Types.ObjectId.isValid(id);

/**
 * Middleware: tu choi neu param la ObjectId khong hop le
 */
const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: `${paramName} khong hop le` });
  }
  next();
};

module.exports = { sanitizeBody, sanitizeStr, isValidObjectId, validateObjectId };
