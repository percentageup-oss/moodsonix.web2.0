// Stream quality for the embedded YouTube player.
//
// YouTube removed setPlaybackQuality() / suggestedQuality from the IFrame API in October 2019:
// the calls are accepted and silently ignored, so a quality picker built on them only changes the UI.
// The one lever left is the size of the player. Adaptive streaming never downloads more pixels than
// the player can show, so each quality maps to a target render size and the player is drawn at that
// size (then scaled with CSS to fit the dock). The result is best-effort, because YouTube still
// makes the final call.

export type QualityId = 'auto' | 'tiny' | 'small' | 'medium' | 'large' | 'hd720' | 'hd1080';

export const QUALITY_STORAGE_KEY = 'moodsonix_quality';

// If a phone with a high pixel ratio still gets more than you asked for, leave this true.
// If HD choices come out too low in testing, set it to false.
const COMPENSATE_PIXEL_RATIO = true;

const SIZES: Record<Exclude<QualityId, 'auto'>, { w: number; h: number; label: string }> = {
  tiny: { w: 256, h: 144, label: '144p' },
  small: { w: 426, h: 240, label: '240p' },
  medium: { w: 640, h: 360, label: '360p' },
  large: { w: 854, h: 480, label: '480p' },
  hd720: { w: 1280, h: 720, label: '720p' },
  hd1080: { w: 1920, h: 1080, label: '1080p' }
};

export function isValidQuality(q: string | null | undefined): q is QualityId {
  return q === 'auto' || (!!q && q in SIZES);
}

export function loadSavedQuality(): QualityId {
  try {
    const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
    return isValidQuality(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

// True on mobile data, on slow links, or when the browser's Data Saver is on.
// Network Information API: Chrome/Android support it, Safari/Firefox do not (returns false there).
export function isMeteredConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as any).connection;
  if (!c) return false;
  if (c.saveData) return true;
  if (c.type === 'cellular') return true;
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g' || c.effectiveType === '3g';
}

// Which concrete quality should actually be used right now.
export function resolveQuality(selected: string, videoVisible: boolean): Exclude<QualityId, 'auto'> {
  // Music only: the video is not on screen, so there is no reason to download more than the smallest video track.
  if (!videoVisible) return 'tiny';
  if (selected !== 'auto' && selected in SIZES) return selected as Exclude<QualityId, 'auto'>;
  // Auto with the video showing: light on mobile data, normal on Wi-Fi.
  return isMeteredConnection() ? 'small' : 'medium';
}

export function qualityLabel(resolved: string): string {
  return (SIZES as any)[resolved]?.label ?? resolved;
}

// CSS pixel size the player should be laid out at to ask YouTube for that quality.
export function getRenderSize(resolved: string): { w: number; h: number } {
  const size = (SIZES as any)[resolved] ?? SIZES.medium;
  const dpr =
    COMPENSATE_PIXEL_RATIO && typeof window !== 'undefined'
      ? Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
      : 1;
  return { w: Math.round(size.w / dpr), h: Math.round(size.h / dpr) };
}
