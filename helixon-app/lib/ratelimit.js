const requests = new Map();

export function rateLimit(ip, maxPerHour = 20) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const key = ip;

  if (!requests.has(key)) {
    requests.set(key, []);
  }

  const timestamps = requests.get(key).filter(t => now - t < windowMs);
  timestamps.push(now);
  requests.set(key, timestamps);

  return timestamps.length <= maxPerHour;
}