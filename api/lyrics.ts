import { Innertube, UniversalCache, Log, Parser } from 'youtubei.js';

try {
  Parser.setParserErrorHandler((context: any) => {
    if (
      context?.error_type === 'class_not_found' ||
      context?.classname === 'ListView' ||
      context?.classname === 'ListItemView'
    ) {
      return;
    }
  });
  Log.setLevel(Log.Level.ERROR);
} catch {}

let innertubeInstance: Innertube | null = null;
let innertubePromise: Promise<Innertube> | null = null;

async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;
  if (innertubePromise) return innertubePromise;

  innertubePromise = (async () => {
    try {
      const yt = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
        retrieve_player: false
      });
      innertubeInstance = yt;
      return yt;
    } catch (err) {
      innertubePromise = null;
      throw err;
    }
  })();

  return innertubePromise;
}

function cleanSongTitle(rawTitle: string): { title: string; artistHint?: string } {
  let cleaned = rawTitle || '';
  let artistHint: string | undefined;
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    if (parts.length >= 2) {
      artistHint = parts[0].trim();
      cleaned = parts.slice(1).join(' - ').trim();
    }
  }

  cleaned = cleaned.replace(
    /\s*[([{\u3010](official\s*(music\s*)?video|official\s*audio|lyrics?|lyric\s*video|audio|visualizer|video|hd|4k|mv|music\s*video)[)\]}\u3011]/gi,
    ' '
  );
  cleaned = cleaned.replace(/\s*-\s*topic$/gi, '');
  cleaned = cleaned.replace(/\s*ft\.?\s*[^()\[\]]+/gi, '');
  cleaned = cleaned.replace(/\s*feat\.?\s*[^()\[\]]+/gi, '');
  cleaned = cleaned.replace(/\|.*/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { title: cleaned || rawTitle, artistHint };
}

function parseLRC(lrcText: string) {
  const lines = lrcText.split('\n');
  const result: Array<{ time: number; text: string }> = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const matches = Array.from(line.matchAll(timeRegex));
    if (matches.length > 0) {
      const text = line.replace(timeRegex, '').trim();
      for (const match of matches) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const frac = match[3] ? parseFloat('0.' + match[3]) : 0;
        const totalSeconds = mins * 60 + secs + frac;
        result.push({ time: totalSeconds, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

async function fetchJsonWithTimeout(url: string, ms: number, userAgent: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const songId = String(req.query?.id || '').trim();
    const rawTitle = String(req.query?.title || '').trim();
    const rawArtist = String(req.query?.artist || '').trim();
    const duration = parseInt(String(req.query?.duration || '0'), 10);

    if (!songId && !rawTitle) {
      return res.status(400).json({ error: 'Song ID or Title is required' });
    }

    const { title: cleanTitle, artistHint } = cleanSongTitle(rawTitle);
    const searchArtist = rawArtist || artistHint || '';

    // 1. LRCLIB exact lookup
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: searchArtist
    });
    if (duration > 0) params.append('duration', duration.toString());

    const exactData = await fetchJsonWithTimeout(
      `https://lrclib.net/api/get?${params.toString()}`,
      3500,
      'Moodsonix/2.0 (contact: moodsonix@example.com)'
    );

    if (exactData && (exactData.syncedLyrics || exactData.plainLyrics)) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
      return res.status(200).json({
        songId,
        provider: 'lrclib',
        syncedLyrics: exactData.syncedLyrics ? parseLRC(exactData.syncedLyrics) : null,
        plainLyrics: exactData.plainLyrics || null,
        notFound: false,
        attribution: 'Lyrics from LRCLIB'
      });
    }

    // 2. LRCLIB search lookup
    const searchQuery = `${cleanTitle} ${searchArtist}`.trim();
    const candidates = await fetchJsonWithTimeout(
      `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`,
      3500,
      'Moodsonix/2.0 (contact: moodsonix@example.com)'
    );

    if (Array.isArray(candidates) && candidates.length > 0) {
      let best = candidates[0];
      let minDiff = Infinity;
      for (const cand of candidates) {
        const diff = duration > 0 ? Math.abs((cand.duration || 0) - duration) : 0;
        if (diff < minDiff) {
          minDiff = diff;
          best = cand;
        }
      }

      if (best && (best.syncedLyrics || best.plainLyrics)) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
        return res.status(200).json({
          songId,
          provider: 'lrclib',
          syncedLyrics: best.syncedLyrics ? parseLRC(best.syncedLyrics) : null,
          plainLyrics: best.plainLyrics || null,
          notFound: false,
          attribution: 'Lyrics from LRCLIB'
        });
      }
    }

    // 3. YouTube Music lyrics fallback
    if (songId) {
      try {
        const yt = await getInnertube();
        const lyricsInfo = await yt.music.getLyrics(songId);
        const text = (lyricsInfo as any)?.description?.toString?.();
        if (text) {
          res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
          return res.status(200).json({
            songId,
            provider: 'youtube',
            syncedLyrics: null,
            plainLyrics: text,
            notFound: false,
            attribution: 'Lyrics from YouTube Music'
          });
        }
      } catch {
        // Not found
      }
    }

    return res.status(200).json({
      songId,
      provider: 'none',
      syncedLyrics: null,
      plainLyrics: null,
      notFound: true,
      attribution: ''
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to load lyrics',
      provider: 'none',
      syncedLyrics: null,
      plainLyrics: null,
      notFound: true,
      attribution: ''
    });
  }
}
