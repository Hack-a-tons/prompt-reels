/**
 * API Request/Response Logger
 * Logs all API calls with timestamp, IP, request, and response
 * Keeps each log line under 140 columns
 */

/**
 * Truncate string to max length with ellipsis
 */
const truncate = (str, maxLen = 50) => {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? s.substring(0, maxLen - 3) + '...' : s;
};

/**
 * Format timestamp
 */
const timestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Get client IP from request
 */
const getIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         req.ip ||
         'unknown';
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'token', 'api_key', 'apiKey', 'secret'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***';
    }
  }
  
  return sanitized;
};

/**
 * Format request info for logging
 */
const formatRequest = (req) => {
  const method = req.method.padEnd(4);
  const path = truncate(req.path, 40);
  
  // Format body
  let bodyStr = '';
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitized = sanitizeBody(req.body);
    bodyStr = JSON.stringify(sanitized);
  } else if (req.query && Object.keys(req.query).length > 0) {
    bodyStr = JSON.stringify(req.query);
  }
  
  return `${method} ${path} ${truncate(bodyStr, 30)}`.trim();
};

/**
 * Format response info for logging
 */
const formatResponse = (statusCode, body, duration) => {
  const status = String(statusCode).padEnd(3);
  const time = `${duration}ms`.padStart(6);
  
  let bodyStr = '';
  if (body && typeof body === 'object') {
    // Extract key fields
    if (body.success !== undefined) bodyStr += `ok=${body.success} `;
    if (body.error) bodyStr += `err="${truncate(body.error, 20)}" `;
    if (body.videoId) bodyStr += `vid=${truncate(body.videoId, 15)} `;
    if (body.articleId) bodyStr += `aid=${truncate(body.articleId, 15)} `;
    if (body.count !== undefined) bodyStr += `cnt=${body.count} `;
  }
  
  return `${status} ${time} ${truncate(bodyStr.trim(), 40)}`.trim();
};

/**
 * Express middleware for request/response logging
 */
const logMiddleware = (req, res, next) => {
  // Skip health checks and static files to reduce noise
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }
  
  const startTime = Date.now();
  const ip = getIP(req);
  const ts = timestamp();
  
  // Capture original res.json to intercept response
  const originalJson = res.json.bind(res);
  let responseBody = null;
  
  res.json = function(body) {
    responseBody = body;
    return originalJson(body);
  };
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const reqInfo = formatRequest(req);
    const resInfo = formatResponse(res.statusCode, responseBody, duration);
    
    // Build log line (max 140 chars)
    const logLine = `${ts} ${ip.padEnd(15)} ${reqInfo} → ${resInfo}`;
    const finalLog = truncate(logLine, 140);
    
    // Color code by status
    if (res.statusCode >= 500) {
      console.error(`❌ ${finalLog}`);
    } else if (res.statusCode >= 400) {
      console.warn(`⚠️  ${finalLog}`);
    } else if (res.statusCode >= 300) {
      console.log(`↪️  ${finalLog}`);
    } else {
      console.log(`✓  ${finalLog}`);
    }
  });
  
  next();
};

/**
 * Manual log function for non-middleware logging
 */
const log = {
  info: (message) => {
    console.log(`✓  ${timestamp()} ${truncate(message, 120)}`);
  },
  
  error: (message) => {
    console.error(`❌ ${timestamp()} ${truncate(message, 120)}`);
  },
  
  warn: (message) => {
    console.warn(`⚠️  ${timestamp()} ${truncate(message, 120)}`);
  },
  
  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐛 ${timestamp()} ${truncate(message, 120)}`);
    }
  },
};

module.exports = {
  logMiddleware,
  log,
  getIP,
  timestamp,
};
