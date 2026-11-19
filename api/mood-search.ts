import { GoogleGenAI } from '@google/genai';
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

async function searchMusicTracks(query: string) {
  const songs: any[] = [];

  try {
    const yt = await withTimeout(getInnertube(), 4000);
    const searchRes = await withTimeout(yt.music.search(query, { type: 'song' }), 4000);
    const contents: any[] = (searchRes as any).contents || [];

    for (const item of contents) {
      const itemId = item?.id || item?.video_id;
      if (!itemId) continue;

      const title = item.title?.toString() || item.name || 'Unknown Song';
      let artist = 'Unknown Artist';
      if (item.artists && Array.isArray(item.artists) && item.artists.length > 0) {
        artist = item.artists.map((a: any) => a.name).join(', ');
      } else if (item.author?.name) {
        artist = item.author.name;
      }

      const album = item.album?.name || null;
      let duration = 180;
      if (item.duration?.seconds) duration = item.duration.seconds;
      else if (typeof item.duration === 'number') duration = item.duration;

      let thumbnail = `https://i.ytimg.com/vi/${itemId}/hqdefault.jpg`;
      if (item.thumbnails && item.thumbnails.length > 0) {
        thumbnail = item.thumbnails[item.thumbnails.length - 1].url;
      }

      songs.push({
        id: itemId,
        source: 'youtube',
        title,
        artist,
        channel: artist,
        album,
        thumbnail,
        duration,
        url: `https://www.youtube.com/watch?v=${itemId}`,
        isPlayable: true
      });
    }
  } catch {
    // Fallback to Piped below
  }

  if (songs.length === 0) {
    for (const instance of PIPED_INSTANCES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(
          `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Moodsonix/2.0', Accept: 'application/json' }
          }
        );
        if (!res.ok) continue;
        const text = await res.text();
        if (!text || !text.trim().startsWith('{')) continue;
        const data = JSON.parse(text);
        if (!Array.isArray(data.items)) continue;
        for (const item of data.items.slice(0, 25)) {
          const vidId = item.url ? item.url.replace('/watch?v=', '') : item.id || '';
          if (!vidId) continue;
          songs.push({
            id: vidId,
            source: 'youtube',
            title: item.title || 'Unknown Title',
            artist: item.uploaderName || item.channel || 'Unknown Artist',
            channel: item.uploaderName || 'Unknown Channel',
            album: null,
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
            duration: item.duration || 180,
            url: `https://www.youtube.com/watch?v=${vidId}`,
            isPlayable: true
          });
        }
        if (songs.length > 0) break;
      } catch {
        // Continue
      } finally {
        clearTimeout(timer);
      }
    }
  }

  const seen = new Set<string>();
  return songs.filter((s) => {
    if (!s?.id || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let bodyObj: any = req.body;
    if (typeof bodyObj === 'string') {
      try {
        bodyObj = JSON.parse(bodyObj);
      } catch {
        bodyObj = {};
      }
    }

    const mood = String(bodyObj?.mood || req.query?.mood || '').trim();
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    let generatedQuery = mood;

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
        const prompt = `You are a music curator for Moodsonix. Given the user's mood or vibe description: "${mood}", generate a concise, highly effective 3 to 6 word YouTube Music search query string that returns songs matching this mood.
Respond ONLY with the search query string. No quotes, no markdown, no punctuation.`;

        const response = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt
          }),
          4000
        );

        const text = response.text?.trim();
        if (text) {
          generatedQuery = text.replace(/["'\n\r]/g, '');
        }
      } catch {
        // Fallback to rule-based mapper
      }
    }

    if (generatedQuery === mood) {
      const moodLower = mood.toLowerCase();
      if (moodLower.includes('rain') || moodLower.includes('relax')) {
        generatedQuery = `${mood} ambient lofi chill`;
      } else if (moodLower.includes('focus') || moodLower.includes('study')) {
        generatedQuery = `${mood} instrumental deep focus electronic`;
      } else if (moodLower.includes('gym') || moodLower.includes('workout')) {
        generatedQuery = `${mood} workout motivation phonk bass`;
      } else if (moodLower.includes('drive') || moodLower.includes('night')) {
        generatedQuery = `${mood} synthwave night drive chill`;
      } else {
        generatedQuery = `${mood} music playlist`;
      }
    }

    const results = await searchMusicTracks(generatedQuery);
    return res.status(200).json({
      mood,
      generatedQuery,
      results,
      count: results.length
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Mood search failed',
      details: err?.message || 'Unknown error',
      results: []
    });
  }
}
