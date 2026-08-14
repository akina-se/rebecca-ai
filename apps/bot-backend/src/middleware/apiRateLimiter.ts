import rateLimit from 'express-rate-limit';
import config from '../config';

/**
 * Rate limiter middleware for public-facing endpoints (e.g., static files, webhooks).
 * 
 * Provides foundational protection against basic DDoS attacks, brute-force attempts, and scraping
 * by restricting the number of requests a single IP address can make within a specified window.
 */
export const publicRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.limits.publicIpRateLimit, // Limit each IP to configured requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' }
});

/**
 * Rate limiter middleware for batch processing endpoints triggered by Cloud Scheduler.
 * 
 * Configured with a relatively low threshold since batch operations typically run infrequently
 * (e.g., hourly or daily). This ensures that misconfigured crons or external abuse cannot spam batch operations.
 */
export const batchRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // More than enough for cron jobs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many batch requests.' }
});

/**
 * Rate limiter middleware for Cloud Tasks worker endpoints.
 *
 * Cloud Tasks inherently manages the dispatch rate via queue configurations (e.g., `maxDispatchesPerSecond`).
 * Applying strict IP-based rate limits here can lead to a "retry storm" where Cloud Tasks continually retries 
 * blocked requests, overwhelming the network layer. Furthermore, worker traffic usually originates from a small 
 * pool of internal Google IPs, making strict IP-based limiting prone to false positives.
 *
 * Therefore, this limiter is configured with an exceptionally high threshold, acting primarily as a circuit 
 * breaker to prevent catastrophic infinite loops rather than as a strict traffic shaper.
 */
export const workerRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5000, // Extremely high limit, basically acting as a circuit breaker for catastrophic bugs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Worker circuit breaker triggered.' }
});
