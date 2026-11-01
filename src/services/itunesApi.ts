import { ItunesArtist, ItunesSong, ItunesAlbum, ArtistProfileData } from '../types/artist';
import { Song } from '../types/music';

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
  return url.replace('100x100', '600x600');
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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=musicArtist&limit=5`;
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
 * Fetches full artist profile data: top artwork, popular songs (top 5), all deduplicated songs, and albums.
 */
export async function fetchArtistProfile(
  artistId: number,
  fallbackArtistName?: string,
  fallbackGenre?: string,
  signal?: AbortSignal
): Promise<{ data: ArtistProfileData | null; error: string | null }> {
  try {
    const songsUrl = `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=200`;
    const albumsUrl = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=50`;

    const [songsRes, albumsRes] = await Promise.all([
      fetch(songsUrl, { signal }).catch((e) => e),
      fetch(albumsUrl, { signal }).catch((e) => e)
    ]);

    // Handle network / fetch failures
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
        error: parsedSongs.error || 'Failed to retrieve artist information from iTunes.'
      };
    }

    const songResults = parsedSongs.data?.results || [];
    const albumResults = parsedAlbums.data?.results || [];

    // Extract artist information
    const artistMeta =
      songResults.find((r) => r.wrapperType === 'artist') ||
      albumResults.find((r) => r.wrapperType === 'artist') ||
      {};

    const artistName = artistMeta.artistName || fallbackArtistName || 'Artist';
    const primaryGenreName = artistMeta.primaryGenreName || fallbackGenre || 'Music';

    // Parse and filter tracks
    const rawTracks: ItunesSong[] = songResults
      .filter((r) => (r.wrapperType === 'track' || r.kind === 'song') && r.trackName)
      .map((r) => ({
        trackId: r.trackId,
        trackName: r.trackName,
        artistName: r.artistName || artistName,
        artistId: r.artistId || artistId,
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
      .map((r) => ({
        collectionId: r.collectionId,
        collectionName: r.collectionName,
        artistName: r.artistName || artistName,
        artistId: r.artistId || artistId,
        artworkUrl100: r.artworkUrl100,
        trackCount: r.trackCount,
        releaseDate: r.releaseDate,
        primaryGenreName: r.primaryGenreName,
        copyright: r.copyright
      }));

    // Deduplicate albums by collectionName
    const seenAlbumNames = new Set<string>();
    const uniqueAlbums: ItunesAlbum[] = [];
    for (const album of rawAlbums) {
      const normalized = album.collectionName.toLowerCase().trim();
      if (!seenAlbumNames.has(normalized)) {
        seenAlbumNames.add(normalized);
        uniqueAlbums.push(album);
      }
    }

    // Determine top artwork from top album or top song
    const topAlbum = uniqueAlbums[0] || rawAlbums[0];
    const topSong = rawTracks[0];
    const rawTopArtwork = topAlbum?.artworkUrl100 || topSong?.artworkUrl100 || null;
    const topArtwork = rawTopArtwork ? upscaleArtwork(rawTopArtwork) : null;

    // Top 5 songs as Popular section
    const popularSongs = rawTracks.slice(0, 5);

    // Deduplicate "All Songs" by track name (case-insensitive)
    const seenTrackNames = new Set<string>();
    const deduplicatedSongs: ItunesSong[] = [];
    for (const song of rawTracks) {
      // Normalize name by removing parenthesis extra version notes for cleaner deduplication
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

    return {
      data: {
        artist: {
          artistId,
          artistName,
          primaryGenreName,
          artistLinkUrl: artistMeta.artistLinkUrl,
          artworkUrl: topArtwork || undefined
        },
        topArtwork,
        popularSongs,
        allSongs: deduplicatedSongs.length > 0 ? deduplicatedSongs : rawTracks,
        albums: uniqueAlbums
      },
      error: null
    };
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
  collectionId: number,
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
