import { ItunesArtist, ItunesSong, ItunesAlbum, ArtistProfileData } from '../types/artist';
import { Song } from '../types/music';
import { generateMonthlyListeners } from '../lib/artistUtils';

// In-memory cache for instant revisiting of artist profiles
const artistProfileCache = new Map<string, ArtistProfileData>();

/**
 * Safely parse JSON from a response, handling non-JSON (HTML/text error pages) gracefully.
 */
async function parseJsonSafely<T>(res: Response): Promise<{ data: T | null; isOk: boolean; error?: string }> {
  if (!res.ok) {
    return {
      data: null,
      isOk: false,
      error: `Network error: received status ${res.status}`
    };
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!text || (!contentType.includes('application/json') && !text.trim().startsWith('{') && !text.trim().startsWith('['))) {
    return {
      data: null,
      isOk: false,
      error: 'Received non-JSON response from iTunes'
    };
  }

  try {
    const parsed = JSON.parse(text) as T;
    return { data: parsed, isOk: true };
  } catch (err: any) {
    return {
      data: null,
      isOk: false,
      error: err?.message || 'Failed to parse JSON response'
    };
  }
}

/**
 * Upscales an iTunes artwork URL from 100x100 to 600x600.
 */
export function upscaleArtwork(url?: string | null): string {
  if (!url) return '';
  return url.replace('100x100', '600x600').replace('100x100bb', '600x600bb');
}

/**
 * Searches for music artists using the iTunes Search API directly from browser.
 */
export async function searchArtists(
  query: string,
  signal?: AbortSignal
): Promise<{ artists: ItunesArtist[]; error: string | null }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { artists: [], error: null };
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=musicArtist&limit=6`;
    const res = await fetch(url, { signal });
    const { data, isOk, error } = await parseJsonSafely<{ resultCount: number; results: any[] }>(res);

    if (!isOk || !data) {
      return {
        artists: [],
        error: error || 'Could not load artist suggestions. Please try again.'
      };
    }

    const artists: ItunesArtist[] = (data.results || [])
      .filter((item) => item && (item.wrapperType === 'artist' || item.artistType === 'Artist' || item.artistName))
      .map((item) => ({
        artistId: item.artistId,
        artistName: item.artistName || 'Unknown Artist',
        primaryGenreName: item.primaryGenreName,
        artistLinkUrl: item.artistLinkUrl
      }));

    return { artists, error: null };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { artists: [], error: null };
    }
    return {
      artists: [],
      error: 'Unable to reach iTunes artist service. Check your internet connection.'
    };
  }
}

/**
 * Fetches YouTube videos for an artist (official music videos, live performances).
 */
async function fetchArtistVideos(artistName: string, signal?: AbortSignal): Promise<Song[]> {
  try {
    const query = `${artistName} official video`;
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json?.results)) {
      return json.results.slice(0, 10);
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

/**
 * Fetches similar artists based on genre and name.
 */
async function fetchSimilarArtists(
  artistName: string,
  genre?: string,
  signal?: AbortSignal
): Promise<ItunesArtist[]> {
  try {
    const query = genre || `${artistName} music`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=8`,
      { signal }
    );
    const { data } = await parseJsonSafely<{ results: any[] }>(res);
    if (!data?.results) return [];

    const normalizedCurrent = artistName.toLowerCase().trim();
    return data.results
      .filter((item) => item && item.artistName && item.artistName.toLowerCase().trim() !== normalizedCurrent)
      .slice(0, 6)
      .map((item) => ({
        artistId: item.artistId,
        artistName: item.artistName,
        primaryGenreName: item.primaryGenreName,
        artistLinkUrl: item.artistLinkUrl
      }));
  } catch {
    return [];
  }
}

/**
 * Fetches full artist profile data: top artwork, avatar, monthly listeners, bio, popular songs,
 * deduplicated all songs, albums, singles & EPs, videos, and similar artists.
 * Cached in memory so revisiting is instant.
 */
export async function fetchArtistProfile(
  artistIdOrName: number | string,
  fallbackArtistName?: string,
  fallbackGenre?: string,
  signal?: AbortSignal
): Promise<{ data: ArtistProfileData | null; error: string | null }> {
  const cacheKey = String(artistIdOrName).toLowerCase().trim();

  // Instant cache hit
  if (artistProfileCache.has(cacheKey)) {
    return { data: artistProfileCache.get(cacheKey)!, error: null };
  }

  let resolvedId: number | string = artistIdOrName;
  let resolvedName = fallbackArtistName || (typeof artistIdOrName === 'string' && isNaN(Number(artistIdOrName)) ? artistIdOrName : '');
  let resolvedGenre = fallbackGenre || '';

  // If the parameter is an artist name rather than an ID, first search iTunes
  const isNumericId = !isNaN(Number(artistIdOrName));
  if (!isNumericId) {
    try {
      const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(String(artistIdOrName))}&entity=musicArtist&limit=1`;
      const searchRes = await fetch(searchUrl, { signal });
      const { data: searchData } = await parseJsonSafely<{ results: any[] }>(searchRes);

      if (searchData?.results && searchData.results.length > 0) {
        const topMatch = searchData.results[0];
        resolvedId = topMatch.artistId;
        resolvedName = topMatch.artistName || resolvedName;
        resolvedGenre = topMatch.primaryGenreName || resolvedGenre;
      }
    } catch {
      // Continue with name
    }
  }

  // If we still don't have a numeric ID (e.g. indie artist not on iTunes), fallback directly to YouTube search
  if (isNaN(Number(resolvedId))) {
    try {
      const ytRes = await fetch(`/api/search?q=${encodeURIComponent(resolvedName)}`, { signal });
      const ytData = ytRes.ok ? await ytRes.json() : null;
      const ytSongs: Song[] = ytData?.results || [];

      if (ytSongs.length === 0) {
        return { data: null, error: `Artist "${resolvedName}" not found.` };
      }

      const itunesSongs: ItunesSong[] = ytSongs.map((s, idx) => ({
        trackId: s.id,
        trackName: s.title,
        artistName: s.artist || resolvedName,
        artistId: resolvedId,
        artworkUrl100: s.thumbnail,
        trackTimeMillis: s.duration * 1000,
        trackNumber: idx + 1
      }));

      const topThumb = ytSongs[0]?.thumbnail || null;
      const profileData: ArtistProfileData = {
        artist: {
          artistId: resolvedId,
          artistName: resolvedName,
          primaryGenreName: resolvedGenre || 'Independent Music',
          artworkUrl: topThumb || undefined,
          avatarUrl: topThumb || undefined
        },
        topArtwork: topThumb,
        avatarUrl: topThumb,
        monthlyListeners: generateMonthlyListeners(resolvedName),
        bio: `${resolvedName} is an active music artist featured on Moodsonix streaming. Listen to their most popular songs, trending music videos, and discography below.`,
        popularSongs: itunesSongs.slice(0, 5),
        allSongs: itunesSongs,
        albums: [],
        singlesAndEPs: [],
        videos: ytSongs.slice(0, 6),
        similarArtists: []
      };

      artistProfileCache.set(cacheKey, profileData);
      return { data: profileData, error: null };
    } catch {
      return { data: null, error: `Unable to load profile for ${resolvedName}. Please try again.` };
    }
  }

  // Normal iTunes Lookup by ID
  try {
    const songsUrl = `https://itunes.apple.com/lookup?id=${resolvedId}&entity=song&limit=150`;
    const albumsUrl = `https://itunes.apple.com/lookup?id=${resolvedId}&entity=album&limit=40`;

    const [songsRes, albumsRes] = await Promise.all([
      fetch(songsUrl, { signal }).catch((e) => e),
      fetch(albumsUrl, { signal }).catch((e) => e)
    ]);

    if (songsRes instanceof Error || albumsRes instanceof Error) {
      return {
        data: null,
        error: 'Network connection failed while fetching artist data.'
      };
    }

    const [parsedSongs, parsedAlbums] = await Promise.all([
      parseJsonSafely<{ resultCount: number; results: any[] }>(songsRes),
      parseJsonSafely<{ resultCount: number; results: any[] }>(albumsRes)
    ]);

    if (!parsedSongs.isOk && !parsedAlbums.isOk) {
      return {
        data: null,
        error: parsedSongs.error || 'Failed to retrieve artist information.'
      };
    }

    const songResults = parsedSongs.data?.results || [];
    const albumResults = parsedAlbums.data?.results || [];

    // Extract artist information
    const artistMeta =
      songResults.find((r) => r.wrapperType === 'artist') ||
      albumResults.find((r) => r.wrapperType === 'artist') ||
      {};

    const artistName = artistMeta.artistName || resolvedName || 'Artist';
    const primaryGenreName = artistMeta.primaryGenreName || resolvedGenre || 'Music';

    // Parse and filter tracks
    const rawTracks: ItunesSong[] = songResults
      .filter((r) => (r.wrapperType === 'track' || r.kind === 'song') && r.trackName)
      .map((r) => ({
        trackId: r.trackId,
        trackName: r.trackName,
        artistName: r.artistName || artistName,
        artistId: r.artistId || resolvedId,
        collectionId: r.collectionId,
        collectionName: r.collectionName,
        artworkUrl100: r.artworkUrl100,
        trackTimeMillis: r.trackTimeMillis,
        previewUrl: r.previewUrl,
        releaseDate: r.releaseDate,
        primaryGenreName: r.primaryGenreName,
        trackNumber: r.trackNumber
      }));

    // Parse and filter albums
    const rawAlbums: ItunesAlbum[] = albumResults
      .filter((r) => (r.wrapperType === 'collection' || r.collectionType === 'Album') && r.collectionName)
      .map((r) => {
        const isSingleOrEp =
          (r.trackCount && r.trackCount <= 3) ||
          r.collectionName.toLowerCase().includes(' - single') ||
          r.collectionName.toLowerCase().includes(' - ep') ||
          r.collectionName.toLowerCase().includes(' (single)') ||
          r.collectionName.toLowerCase().includes(' (ep)');

        return {
          collectionId: r.collectionId,
          collectionName: r.collectionName,
          artistName: r.artistName || artistName,
          artistId: r.artistId || resolvedId,
          artworkUrl100: r.artworkUrl100,
          trackCount: r.trackCount,
          releaseDate: r.releaseDate,
          primaryGenreName: r.primaryGenreName,
          copyright: r.copyright,
          isSingleOrEp
        };
      });

    // Deduplicate albums by collectionName
    const seenAlbumNames = new Set<string>();
    const uniqueAlbums: ItunesAlbum[] = [];
    const singlesAndEPs: ItunesAlbum[] = [];

    for (const album of rawAlbums) {
      const normalized = album.collectionName.toLowerCase().trim();
      if (!seenAlbumNames.has(normalized)) {
        seenAlbumNames.add(normalized);
        if (album.isSingleOrEp) {
          singlesAndEPs.push(album);
        } else {
          uniqueAlbums.push(album);
        }
      }
    }

    // Determine top artwork
    const topAlbum = uniqueAlbums[0] || singlesAndEPs[0] || rawAlbums[0];
    const topSong = rawTracks[0];
    const rawTopArtwork = topAlbum?.artworkUrl100 || topSong?.artworkUrl100 || null;
    const topArtwork = rawTopArtwork ? upscaleArtwork(rawTopArtwork) : null;
    const avatarUrl = topArtwork;

    // Top 5 songs as Popular section
    const popularSongs = rawTracks.slice(0, 5);

    // Deduplicate "All Songs" by track name
    const seenTrackNames = new Set<string>();
    const deduplicatedSongs: ItunesSong[] = [];
    for (const song of rawTracks) {
      const normalized = song.trackName
        .toLowerCase()
        .replace(/\(remaster(ed)?.*?\)/gi, '')
        .replace(/\(live.*?\)/gi, '')
        .trim();

      if (!seenTrackNames.has(normalized)) {
        seenTrackNames.add(normalized);
        deduplicatedSongs.push(song);
      }
    }

    // Parallel fetch videos and similar artists
    const [videos, similarArtists] = await Promise.all([
      fetchArtistVideos(artistName, signal).catch(() => []),
      fetchSimilarArtists(artistName, primaryGenreName, signal).catch(() => [])
    ]);

    const profileData: ArtistProfileData = {
      artist: {
        artistId: resolvedId,
        artistName,
        primaryGenreName,
        artistLinkUrl: artistMeta.artistLinkUrl,
        artworkUrl: topArtwork || undefined,
        avatarUrl: avatarUrl || undefined
      },
      topArtwork,
      avatarUrl,
      monthlyListeners: generateMonthlyListeners(artistName),
      bio: `${artistName} is a acclaimed ${primaryGenreName.toLowerCase()} music artist. Explore their discography, full track catalogue, popular singles, and official YouTube music videos.`,
      popularSongs,
      allSongs: deduplicatedSongs.length > 0 ? deduplicatedSongs : rawTracks,
      albums: uniqueAlbums,
      singlesAndEPs,
      videos,
      similarArtists
    };

    // Store in cache under both ID and artist name for instant lookups
    artistProfileCache.set(cacheKey, profileData);
    if (artistName.toLowerCase() !== cacheKey) {
      artistProfileCache.set(artistName.toLowerCase().trim(), profileData);
    }

    return { data: profileData, error: null };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { data: null, error: null };
    }
    return {
      data: null,
      error: 'An unexpected error occurred while loading the artist profile.'
    };
  }
}

/**
 * Fetches the tracks of a specific album by collectionId.
 */
export async function fetchAlbumTracks(
  collectionId: number | string,
  signal?: AbortSignal
): Promise<{ album: ItunesAlbum | null; tracks: ItunesSong[]; error: string | null }> {
  try {
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`;
    const res = await fetch(url, { signal });
    const { data, isOk, error } = await parseJsonSafely<{ resultCount: number; results: any[] }>(res);

    if (!isOk || !data) {
      return {
        album: null,
        tracks: [],
        error: error || 'Failed to load album tracks.'
      };
    }

    const results = data.results || [];
    const albumMeta = results.find((r) => r.wrapperType === 'collection' || r.collectionType === 'Album');
    const tracks: ItunesSong[] = results
      .filter((r) => (r.wrapperType === 'track' || r.kind === 'song') && r.trackName)
      .map((r) => ({
        trackId: r.trackId,
        trackName: r.trackName,
        artistName: r.artistName || albumMeta?.artistName || 'Unknown Artist',
        artistId: r.artistId,
        collectionId: r.collectionId || collectionId,
        collectionName: r.collectionName || albumMeta?.collectionName,
        artworkUrl100: r.artworkUrl100 || albumMeta?.artworkUrl100,
        trackTimeMillis: r.trackTimeMillis,
        previewUrl: r.previewUrl,
        trackNumber: r.trackNumber
      }));

    const album: ItunesAlbum | null = albumMeta
      ? {
          collectionId: albumMeta.collectionId,
          collectionName: albumMeta.collectionName,
          artistName: albumMeta.artistName,
          artworkUrl100: albumMeta.artworkUrl100,
          trackCount: albumMeta.trackCount || tracks.length,
          releaseDate: albumMeta.releaseDate,
          primaryGenreName: albumMeta.primaryGenreName,
          copyright: albumMeta.copyright
        }
      : null;

    return { album, tracks, error: null };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { album: null, tracks: [], error: null };
    }
    return {
      album: null,
      tracks: [],
      error: 'Could not load album tracklist.'
    };
  }
}

/**
 * Convert an ItunesSong into a Moodsonix Song structure.
 */
export function itunesSongToMoodsonixSong(song: ItunesSong): Song {
  const upscaledThumb = upscaleArtwork(song.artworkUrl100);
  const seconds = song.trackTimeMillis ? Math.round(song.trackTimeMillis / 1000) : 180;

  return {
    id: `itunes_${song.trackId}`,
    source: 'youtube', // resolved on playback
    title: song.trackName,
    artist: song.artistName,
    channel: song.artistName,
    album: song.collectionName || null,
    thumbnail: upscaledThumb || `https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg`,
    duration: seconds,
    url: '',
    audioUrl: song.previewUrl || undefined,
    isPlayable: true
  };
}
