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
    const rawId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    const id = String(rawId || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    try {
      const yt = await withTimeout(getInnertube(), 4500);
      const info = await withTimeout(yt.getInfo(id), 4500);
      const basic = info.basic_info;

      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
      return res.status(200).json({
        id,
        source: 'youtube',
        title: basic.title || 'Unknown Song',
        artist: basic.author || 'Unknown Artist',
        channel: basic.author || 'YouTube',
        album: null,
        thumbnail: basic.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: basic.duration || 180,
        url: `https://www.youtube.com/watch?v=${id}`,
        isPlayable: true
      });
    } catch {
      // Fallback to YouTube oEmbed
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
          return res.status(200).json({
            id,
            source: 'youtube',
            title: oembed?.title || 'YouTube Track',
            artist: oembed?.author_name || 'YouTube Music',
            channel: oembed?.author_name || 'YouTube',
            album: null,
            thumbnail: oembed?.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: 180,
            url: `https://www.youtube.com/watch?v=${id}`,
            isPlayable: true
          });
        }
      } catch {
        // Fallback below
      }
    }

    return res.status(200).json({
      id,
      source: 'youtube',
      title: 'YouTube Track',
      artist: 'YouTube Music',
      channel: 'YouTube',
      album: null,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      duration: 180,
      url: `https://www.youtube.com/watch?v=${id}`,
      isPlayable: true
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to load song metadata'
    });
  }
}
