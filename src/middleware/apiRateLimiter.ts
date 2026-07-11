import rateLimit from 'express-rate-limit';

/**
 * Rate limiting for public endpoints (e.g., static files, potential future webhooks).
 * Protects against basic DDoS and scraping.
 */
export const publicRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' }
});

/**
 * Rate limiting for batch endpoints triggered by Cloud Scheduler.
 * We keep this relatively low since batches run infrequently (e.g., once an hour or once a day).
 */
export const batchRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // More than enough for cron jobs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many batch requests.' }
});

/**
 * Rate limiting for Cloud Tasks worker endpoints.
 * 
 * Note from Google Senior Engineer perspective: 
 * Cloud Tasks inherently manages the dispatch rate via queue configurations (maxDispatchesPerSecond).
 * Applying strict IP-based rate limits here can lead to a "retry storm" where Cloud Tasks 
 * continually retries blocked requests, overwhelming the network layer.
 * Furthermore, worker traffic usually comes from a small pool of Google internal IPs, 
 * so IP-based limiting is likely to cause false positives.
 * 
 * Therefore, we either omit the rate limit entirely, or set an exceptionally high fallback limit.
 * We choose to set a very high fallback limit just to prevent catastrophic infinite loops.
 */
export const workerRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5000, // Extremely high limit, basically acting as a circuit breaker for catastrophic bugs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Worker circuit breaker triggered.' }
});
