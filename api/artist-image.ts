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

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://piped-api.lunar.icu'
];

function normalizeAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let url = rawUrl.trim();
  if (!url) return null;
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  if (!/^https?:\/\//i.test(url)) return null;

  if (url.includes('yt3.ggpht.com') || url.includes('yt3.googleusercontent.com')) {
    url = url.replace(/=s\d+(-c-k-)?/i, '=s512$1');
  }
  return url;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function fetchJsonWithTimeout(url: string, ms: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Moodsonix/2.0',
        Accept: 'application/json'
      }
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

interface ArtistImageLookup {
  imageUrl: string | null;
  channelId: string | null;
  channelName: string | null;
}

async function lookupViaInnertube(artistName: string): Promise<ArtistImageLookup> {
  const yt = await withTimeout(getInnertube(), 4500);
  const target = artistName.toLowerCase().trim();

  // 1. Search YouTube channels (returns Official Artist Channel badges + yt3 avatar URLs)
  try {
    const channelSearch = await withTimeout(yt.search(artistName, { type: 'channel' }), 4500);
    const candidates: any[] = (channelSearch as any)?.channels || (channelSearch as any)?.results || [];

    let bestScore = -1;
    let bestResult: ArtistImageLookup = { imageUrl: null, channelId: null, channelName: null };

    for (const ch of candidates.slice(0, 8)) {
      const thumbs: any[] = ch?.author?.thumbnails || ch?.thumbnails || [];
      const rawThumb = thumbs[0]?.url || thumbs[thumbs.length - 1]?.url;
      const imageUrl = normalizeAvatarUrl(rawThumb);
      if (!imageUrl) continue;

      const name = String(ch?.author?.name || '').trim();
      const lowerName = name.toLowerCase();
      const badges: any[] = ch?.author?.badges || [];

      let score = 1;
      const isArtistBadge = badges.some(
        (b) =>
          b?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST' ||
          String(b?.tooltip || '').toLowerCase().includes('official artist')
      );
      const isVerifiedBadge = badges.some(
        (b) => b?.style === 'BADGE_STYLE_TYPE_VERIFIED' || b?.icon_type === 'CHECK_CIRCLE_THICK'
      );

      if (isArtistBadge) score += 100;
      else if (isVerifiedBadge) score += 40;

      if (lowerName === target) score += 50;
      else if (lowerName.includes(target) || target.includes(lowerName)) score += 20;

      if (!lowerName.endsWith('- topic')) score += 15;

      if (score > bestScore) {
        bestScore = score;
        bestResult = {
          imageUrl,
          channelId: ch?.id || ch?.author?.id || null,
          channelName: name || null
        };
      }
    }

    if (bestResult.imageUrl) {
      return bestResult;
    }
  } catch {
    // Continue to YouTube Music artist search fallback
  }

  // 2. Fallback: YouTube Music artist search
  try {
    const musicSearch = await withTimeout(yt.music.search(artistName, { type: 'artist' }), 4000);
    const shelves: any[] = (musicSearch as any)?.contents || [];
    for (const shelf of shelves) {
      const items: any[] = shelf?.contents || [shelf];
      for (const item of items) {
        const thumbs: any[] = item?.thumbnails || item?.thumbnail?.contents || [];
        const rawThumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
        const imageUrl = normalizeAvatarUrl(rawThumb);
        if (imageUrl) {
          return {
            imageUrl,
            channelId: item?.id || null,
            channelName: item?.name || item?.title?.toString?.() || artistName
          };
        }
      }
    }
  } catch {
    // Continue
  }

  return { imageUrl: null, channelId: null, channelName: null };
}

async function lookupViaYouTubeDataApi(artistName: string): Promise<ArtistImageLookup> {
  const apiKey = (process.env.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) return { imageUrl: null, channelId: null, channelName: null };

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=3&q=${encodeURIComponent(
      artistName
    )}&key=${encodeURIComponent(apiKey)}`;
    const searchData = await fetchJsonWithTimeout(searchUrl, 3500);
    const items: any[] = searchData?.items || [];
    if (items.length === 0) return { imageUrl: null, channelId: null, channelName: null };

    const channelId = items[0]?.id?.channelId || items[0]?.snippet?.channelId;
    const channelName = items[0]?.snippet?.channelTitle || artistName;

    if (channelId) {
      const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(
        channelId
      )}&key=${encodeURIComponent(apiKey)}`;
      const chData = await fetchJsonWithTimeout(chUrl, 3500);
      const thumbs = chData?.items?.[0]?.snippet?.thumbnails;
      const rawUrl = thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url;
      const imageUrl = normalizeAvatarUrl(rawUrl);
      if (imageUrl) {
        return { imageUrl, channelId, channelName };
      }
    }

    const fallbackThumb = normalizeAvatarUrl(
      items[0]?.snippet?.thumbnails?.high?.url || items[0]?.snippet?.thumbnails?.default?.url
    );
    if (fallbackThumb) {
      return { imageUrl: fallbackThumb, channelId: channelId || null, channelName };
    }
  } catch {
    // Continue
  }

  return { imageUrl: null, channelId: null, channelName: null };
}

async function lookupViaPiped(artistName: string): Promise<ArtistImageLookup> {
  const target = artistName.toLowerCase().trim();
  for (const instance of PIPED_INSTANCES) {
    const data = await fetchJsonWithTimeout(
      `${instance}/search?q=${encodeURIComponent(artistName)}&filter=channels`,
      3000
    );
    const items: any[] = data?.items || [];
    if (!Array.isArray(items) || items.length === 0) continue;

    const preferred =
      items.find((it) => it?.verified && String(it?.name || '').toLowerCase().includes(target)) ||
      items.find((it) => it?.verified) ||
      items[0];

    const imageUrl = normalizeAvatarUrl(preferred?.thumbnail);
    if (imageUrl) {
      return {
        imageUrl,
        channelId: preferred?.url ? String(preferred.url).replace('/channel/', '') : null,
        channelName: preferred?.name || artistName
      };
    }
  }
  return { imageUrl: null, channelId: null, channelName: null };
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
    const artistName = String(req.query?.name || req.query?.artist || '').trim();
    if (!artistName) {
      return res.status(400).json({
        error: 'Artist name is required',
        imageUrl: null,
        found: false
      });
    }

    let result: ArtistImageLookup = { imageUrl: null, channelId: null, channelName: null };

    try {
      result = await lookupViaInnertube(artistName);
    } catch {
      // Fallback below
    }

    if (!result.imageUrl) {
      result = await lookupViaYouTubeDataApi(artistName);
    }

    if (!result.imageUrl) {
      result = await lookupViaPiped(artistName);
    }

    if (result.imageUrl) {
      res.setHeader(
        'Cache-Control',
        'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800'
      );
      return res.status(200).json({
        artist: artistName,
        imageUrl: result.imageUrl,
        channelId: result.channelId,
        channelName: result.channelName,
        found: true
      });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=300');
    return res.status(200).json({
      artist: artistName,
      imageUrl: null,
      channelId: null,
      channelName: null,
      found: false
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to resolve artist image',
      imageUrl: null,
      found: false
    });
  }
}
