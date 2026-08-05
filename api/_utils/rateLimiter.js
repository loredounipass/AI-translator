const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map(); // Map<ip, timestamps[]>

const checkRateLimit = (req) => {
  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  let timestamps = rateLimitMap.get(ip) || [];
  
  timestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
  
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }
  
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true; // OK
};

const cleanupRateLimiter = (now) => {
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
};

module.exports = {
  checkRateLimit,
  cleanupRateLimiter,
};
