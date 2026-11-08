// Logic and storage service for Moodsonix Data Usage tracking
// Handles local storage persistence, network classification, PerformanceObserver measurement,
// and bitrate-based playback estimation.

export const DATA_USAGE_STORAGE_KEY = 'moodsonix_data_usage_v1';
export const MAX_STORED_DAYS = 400;

// Editable bitrates constant as specified:
// Audio: 128 kbps
// Video: tiny: 80, small: 150, medium: 300, large: 600, hd720: 1500, hd1080: 3000 kbps
// Direct <audio> songs: 128 kbps, no video
export const STREAM_BITRATES = {
  audioKbps: 128,
  videoKbps: {
    tiny: 80,
    small: 150,
    medium: 300,
    large: 600,
    hd720: 1500,
    hd1080: 3000
  }
} as const;

export type VideoQualityKey = keyof typeof STREAM_BITRATES.videoKbps;

export type ConnectionBucket = 'mobile' | 'wifi' | 'unknown';

export interface ByteBuckets {
  est: number;  // Estimated bytes
  meas: number; // Measured bytes
}

export interface ExactBuckets {
  mobile?: number;
  wifi?: number;
}

export interface DayDataUsageRecord {
  mobile: ByteBuckets;
  wifi: ByteBuckets;
  unknown: ByteBuckets;
  secondsPlayed: number;
  songsPlayed: number;
  exact?: ExactBuckets;
  qualities?: Record<string, number>; // quality -> seconds played
}

export type DataUsageStorage = Record<string, DayDataUsageRecord>;

export type DataSourceType = 'Exact' | 'Measured' | 'Estimated';

// Subscribers for real-time reactivity
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeDataUsage(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

// In-memory cache of stored records
let memoryStore: DataUsageStorage | null = null;

// Return local date key in YYYY-MM-DD format (rolls over at local midnight)
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format units: 1 MB = 1,000,000 bytes (matches phone data meters), one decimal place
export function formatDataBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1000) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1000000) {
    return `${(bytes / 1000).toFixed(1)} KB`;
  }
  if (bytes < 1000000000) {
    return `${(bytes / 1000000).toFixed(1)} MB`;
  }
  return `${(bytes / 1000000000).toFixed(1)} GB`;
}

// Bucket determination rule:
// navigator.connection.type === "cellular" -> mobile;
// "wifi" or "ethernet" -> wifi;
// anything else, or API missing (Safari, Firefox, desktop) -> unknown.
// Never guess "mobile" from effectiveType.
export function getCurrentBucket(): ConnectionBucket {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = (navigator as any).connection;
  if (!conn || typeof conn.type !== 'string') return 'unknown';
  const type = conn.type.toLowerCase();
  if (type === 'cellular') return 'mobile';
  if (type === 'wifi' || type === 'ethernet') return 'wifi';
  return 'unknown';
}

export function createEmptyDayRecord(): DayDataUsageRecord {
  return {
    mobile: { est: 0, meas: 0 },
    wifi: { est: 0, meas: 0 },
    unknown: { est: 0, meas: 0 },
    secondsPlayed: 0,
    songsPlayed: 0,
    qualities: {}
  };
}

function pruneOlderThan400Days(data: DataUsageStorage): DataUsageStorage {
  const keys = Object.keys(data);
  if (keys.length <= MAX_STORED_DAYS) return data;

  const cutoff = Date.now() - MAX_STORED_DAYS * 24 * 60 * 60 * 1000;
  const result: DataUsageStorage = {};
  for (const key of keys) {
    const parts = key.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const time = new Date(year, month, day).getTime();
      if (time >= cutoff) {
        result[key] = data[key];
      }
    }
  }
  return result;
}

export function loadDataUsage(): DataUsageStorage {
  if (memoryStore !== null) {
    return memoryStore;
  }
  try {
    const raw = localStorage.getItem(DATA_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        memoryStore = parsed as DataUsageStorage;
        return memoryStore;
      }
    }
  } catch {}
  memoryStore = {};
  return memoryStore;
}

function persistStore(data: DataUsageStorage) {
  memoryStore = data;
  try {
    const pruned = pruneOlderThan400Days(data);
    memoryStore = pruned;
    localStorage.setItem(DATA_USAGE_STORAGE_KEY, JSON.stringify(pruned));
  } catch (err) {
    console.warn('[Moodsonix] Failed to persist data usage to localStorage:', err);
  }
  notifyListeners();
}

function getOrCreateTodayRecord(store: DataUsageStorage, todayKey: string): DayDataUsageRecord {
  if (!store[todayKey]) {
    store[todayKey] = createEmptyDayRecord();
  }
  return store[todayKey];
}

// Measured: PerformanceObserver on "resource" entries, add transferSize only when > 0.
// Cross-origin files that expose no size (YouTube's own traffic, most thumbnails) are NOT counted
// as measured; do not invent a number for them.
export function recordMeasuredBytes(bytes: number) {
  if (bytes <= 0 || !Number.isFinite(bytes)) return;
  try {
    const store = { ...loadDataUsage() };
    const todayKey = getLocalDateKey();
    const day = getOrCreateTodayRecord(store, todayKey);
    const bucket = getCurrentBucket();

    day[bucket] = {
      ...day[bucket],
      meas: (day[bucket]?.meas || 0) + bytes
    };
    persistStore(store);
  } catch (err) {
    console.warn('[Moodsonix] Error recording measured bytes:', err);
  }
}

// Estimated (YouTube playback): while playbackState === "playing", add elapsedSeconds x (audioKbps + videoKbps) / 8 x 1000 bytes.
// Use timestamp deltas between ticks (cap each delta at 5 s so phone sleep isn't counted).
export function recordPlaybackProgress(
  elapsedSeconds: number,
  audioKbps: number,
  videoKbps: number,
  qualityLabelName: string
) {
  if (elapsedSeconds <= 0 || !Number.isFinite(elapsedSeconds)) return;
  try {
    const store = { ...loadDataUsage() };
    const todayKey = getLocalDateKey();
    const day = getOrCreateTodayRecord(store, todayKey);
    const bucket = getCurrentBucket();

    const totalKbps = audioKbps + videoKbps;
    const addedBytes = (elapsedSeconds * totalKbps * 1000) / 8;

    day[bucket] = {
      ...day[bucket],
      est: (day[bucket]?.est || 0) + addedBytes
    };

    day.secondsPlayed = (day.secondsPlayed || 0) + elapsedSeconds;

    if (!day.qualities) {
      day.qualities = {};
    }
    day.qualities[qualityLabelName] = (day.qualities[qualityLabelName] || 0) + elapsedSeconds;

    persistStore(store);
  } catch (err) {
    console.warn('[Moodsonix] Error recording estimated playback bytes:', err);
  }
}

export function recordSongPlay() {
  try {
    const store = { ...loadDataUsage() };
    const todayKey = getLocalDateKey();
    const day = getOrCreateTodayRecord(store, todayKey);
    day.songsPlayed = (day.songsPlayed || 0) + 1;
    persistStore(store);
  } catch (err) {
    console.warn('[Moodsonix] Error recording song play count:', err);
  }
}

export function clearDataUsageHistory() {
  try {
    localStorage.removeItem(DATA_USAGE_STORAGE_KEY);
    memoryStore = {};
    notifyListeners();
  } catch (err) {
    console.warn('[Moodsonix] Error clearing data usage history:', err);
  }
}

// PerformanceObserver listener setup
export function setupPerformanceObserver(): (() => void) | undefined {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return undefined;
  }
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const res = entry as PerformanceResourceTiming;
        if (res.transferSize && res.transferSize > 0) {
          recordMeasuredBytes(res.transferSize);
        }
      }
    });

    observer.observe({ type: 'resource', buffered: true });
    return () => {
      try {
        observer.disconnect();
      } catch {}
    };
  } catch {
    return undefined;
  }
}
