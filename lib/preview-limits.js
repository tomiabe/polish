export function createPreviewLimits({
  now = () => Date.now(),
  rateWindowMs,
  rateMax,
  dailyCap,
  maxConcurrent
}) {
  const rateLimits = new Map();
  let dailyCount = 0;
  let concurrentReviews = 0;

  function check(key) {
    const currentTime = now();
    for (const [entryKey, entry] of rateLimits) {
      if (currentTime - entry.startedAt >= rateWindowMs) rateLimits.delete(entryKey);
    }

    const entry = rateLimits.get(key);
    if (!entry || currentTime - entry.startedAt >= rateWindowMs) {
      rateLimits.set(key, { startedAt: currentTime, count: 1 });
    } else {
      entry.count += 1;
    }

    const current = rateLimits.get(key);
    if (current.count > rateMax) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((rateWindowMs - (currentTime - current.startedAt)) / 1_000),
        reason: `Rate limit: ${rateMax} reviews per hour. Try again later.`
      };
    }
    if (dailyCount >= dailyCap) {
      return {
        allowed: false,
        retryAfterSeconds: 3_600,
        reason: "Daily review limit reached. Try again tomorrow."
      };
    }
    if (concurrentReviews >= maxConcurrent) {
      return {
        allowed: false,
        retryAfterSeconds: 10,
        reason: "Too many reviews running. Try again in a moment."
      };
    }
    return { allowed: true };
  }

  return {
    check,
    start() {
      concurrentReviews += 1;
      dailyCount += 1;
    },
    finish() {
      concurrentReviews = Math.max(0, concurrentReviews - 1);
    },
    resetDaily() {
      dailyCount = 0;
    },
    snapshot() {
      return { dailyCount, concurrentReviews };
    }
  };
}
