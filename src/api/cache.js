const CACHE_PREFIX = "spacex-cache:";
const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch a URL with localStorage-backed caching.
 * @param {string} url
 * @param {{ttl?: number, bypass?: boolean}} [options]
 * @returns {Promise<any>} Parsed JSON body.
 */
export async function cachedFetch(
  url,
  { ttl = DEFAULT_TTL, bypass = false } = {},
) {
  const key = CACHE_PREFIX + url;

  if (!bypass) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const { timestamp, data } = JSON.parse(raw);
        if (Date.now() - timestamp < ttl) {
          return data;
        }
        localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} for ${url}`);
  }
  const data = await response.json();

  localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  return data;
}

/**
 * Remove only the entries created by cachedFetch.
 * Unlike localStorage.clear(), this leaves any other app data intact.
 */
export function clearCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
