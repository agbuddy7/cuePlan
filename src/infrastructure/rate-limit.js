const rateBuckets = new Map();
export function allowRequest(request, now = Date.now()) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  for (const [key, timestamps] of rateBuckets) {
    if (now - timestamps[timestamps.length - 1] >= 60000) rateBuckets.delete(key);
  }
  if (!rateBuckets.has(ip) && rateBuckets.size >= 10000) return false;
  const previous = rateBuckets.get(ip) || [];
  const recent = previous.filter((time) => now - time < 60000);
  if (recent.length >= 12) return false;
  recent.push(now);
  rateBuckets.set(ip, recent);
  return true;
}

