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
    const urlOrId = String(req.query?.url || req.query?.id || '').trim();
    if (!urlOrId) {
      return res.status(400).json({ error: 'Playlist URL or ID is required' });
    }

    let playlistId = urlOrId;
    const listMatch = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) playlistId = listMatch[1];

    // 1. Try YouTube.js Innertube
    try {
      const yt = await withTimeout(getInnertube(), 4500);
      const playlist = await withTimeout(yt.getPlaylist(playlistId), 4500);
      const title = (playlist.info as any)?.title || 'Imported Playlist';
      const thumbnail = (playlist.info as any)?.thumbnails?.[0]?.url || '';
      const videos: any[] = (playlist as any).videos || [];
      const tracks = videos
        .map((v) => {
          const vId = v?.id || v?.video_id;
          if (!vId) return null;
          return {
            id: vId,
            source: 'youtube',
            title: v.title?.toString() || 'Unknown Title',
            artist: v.author?.name || 'Unknown Artist',
            channel: v.author?.name || 'YouTube',
            album: null,
            thumbnail: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            duration: v.duration?.seconds || 180,
            url: `https://www.youtube.com/watch?v=${vId}`,
            isPlayable: true
          };
        })
        .filter(Boolean);

      if (tracks.length > 0) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
        return res.status(200).json({
          id: playlistId,
          title,
          thumbnail,
          trackCount: tracks.length,
          tracks
        });
      }
    } catch {
      // Fallback to Piped
    }

    // 2. Piped fallback
    for (const instance of PIPED_INSTANCES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const pipedRes = await fetch(`${instance}/playlists/${encodeURIComponent(playlistId)}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Moodsonix/2.0', Accept: 'application/json' }
        });
        if (!pipedRes.ok) continue;
        const text = await pipedRes.text();
        if (!text || !text.trim().startsWith('{')) continue;
        const pipedData = JSON.parse(text);
        const tracks = (pipedData.relatedStreams || []).map((s: any) => {
          const vidId = s.url ? s.url.replace('/watch?v=', '') : '';
          return {
            id: vidId,
            source: 'youtube',
            title: s.title || 'Unknown Title',
            artist: s.uploaderName || 'Unknown Artist',
            channel: s.uploaderName || 'YouTube',
            album: null,
            thumbnail: s.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
            duration: s.duration || 180,
            url: `https://www.youtube.com/watch?v=${vidId}`,
            isPlayable: true
          };
        });

        res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
        return res.status(200).json({
          id: playlistId,
          title: pipedData.name || 'Imported Playlist',
          thumbnail: pipedData.thumbnailUrl || '',
          trackCount: tracks.length,
          tracks
        });
      } catch {
        // Continue
      } finally {
        clearTimeout(timer);
      }
    }

    return res.status(404).json({ error: 'Playlist not found or is private' });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Playlist lookup failed'
    });
  }
}
