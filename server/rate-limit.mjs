/** Small in-process limiter for single-instance endpoints; shared-store deployment can replace it. */
export function createRateLimiter({ windowMs, max, key = (req) => req.ip || "unknown", now = Date.now }) {
  const buckets = new Map();
  return (req, res, next) => {
    const at = now();
    const id = String(key(req));
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= at) bucket = { count: 0, resetAt: at + windowMs };
    bucket.count += 1;
    buckets.set(id, bucket);
    if (buckets.size > 10000) {
      for (const [entry, value] of buckets) if (value.resetAt <= at) buckets.delete(entry);
    }
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - at) / 1000))));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}
