import { safeJsonResponse } from './musicApi';

const STORAGE_KEY = 'moodsonix_artist_image_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STORAGE_ENTRIES = 200;

interface StoredEntry {
  url: string;
  cachedAt: number;
}

interface MemoryEntry {
  url: string | null;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();
const inFlightRequests = new Map<string, Promise<string | null>>();

function normalizeKey(artistName: string): string {
  return artistName.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readStorageMap(): Record<string, StoredEntry> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, StoredEntry>;
  } catch {
    return {};
  }
}

function writeStorageMap(map: Record<string, StoredEntry>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const entries = Object.entries(map);
    if (entries.length > MAX_STORAGE_ENTRIES) {
      entries.sort((a, b) => (b[1]?.cachedAt || 0) - (a[1]?.cachedAt || 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_STORAGE_ENTRIES));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function getCachedArtistImage(artistName: string): string | null {
  const key = normalizeKey(artistName);
  if (!key) return null;

  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.url;
  }

  const stored = readStorageMap();
  const entry = stored[key];
  if (entry && entry.url && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
    memoryCache.set(key, {
      url: entry.url,
      expiresAt: entry.cachedAt + CACHE_TTL_MS
    });
    return entry.url;
  }

  return null;
}

export function invalidateCachedArtistImage(artistName: string): void {
  const key = normalizeKey(artistName);
  if (!key) return;
  memoryCache.delete(key);
  const stored = readStorageMap();
  if (stored[key]) {
    delete stored[key];
    writeStorageMap(stored);
  }
}

function savePositiveArtistImage(key: string, imageUrl: string): void {
  const now = Date.now();
  memoryCache.set(key, {
    url: imageUrl,
    expiresAt: now + CACHE_TTL_MS
  });
  const stored = readStorageMap();
  stored[key] = { url: imageUrl, cachedAt: now };
  writeStorageMap(stored);
}

/**
 * Resolves the real YouTube channel profile picture for an artist via /api/artist-image,
 * with localStorage + in-memory caching and concurrent request deduplication.
 * Returns null if no real channel picture could be resolved.
 */
export async function fetchArtistImage(
  artistName: string,
  signal?: AbortSignal
): Promise<string | null> {
  const trimmed = artistName.trim();
  const key = normalizeKey(trimmed);
  if (!key) return null;

  if (signal?.aborted) {
    return null;
  }

  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.url;
  }

  const stored = readStorageMap();
  const entry = stored[key];
  if (entry && entry.url && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
    memoryCache.set(key, {
      url: entry.url,
      expiresAt: entry.cachedAt + CACHE_TTL_MS
    });
    return entry.url;
  }

  let pending = inFlightRequests.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(`/api/artist-image?name=${encodeURIComponent(trimmed)}`, {
          headers: { Accept: 'application/json' }
        });
        const { data, isJson } = await safeJsonResponse<{
          imageUrl?: string | null;
          found?: boolean;
        }>(res);

        const resolvedUrl =
          res.ok && isJson && data?.imageUrl && typeof data.imageUrl === 'string'
            ? data.imageUrl.trim()
            : null;

        if (resolvedUrl) {
          savePositiveArtistImage(key, resolvedUrl);
          return resolvedUrl;
        }

        memoryCache.set(key, {
          url: null,
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS
        });
        return null;
      } catch {
        memoryCache.set(key, {
          url: null,
          expiresAt: Date.now() + 60 * 1000
        });
        return null;
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, pending);
  }

  if (!signal) {
    return pending;
  }

  return new Promise<string | null>((resolve) => {
    const onAbort = () => resolve(null);
    signal.addEventListener('abort', onAbort, { once: true });
    pending!.then(
      (result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(signal.aborted ? null : result);
      },
      () => {
        signal.removeEventListener('abort', onAbort);
        resolve(null);
      }
    );
  });
}
