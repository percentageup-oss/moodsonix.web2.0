import React, { useState, useEffect } from 'react';
import { fetchArtistProfile, itunesSongToMoodsonixSong, upscaleArtwork } from '../services/itunesApi';
import { searchMusic } from '../services/musicApi';
import { ArtistProfileData, ItunesAlbum } from '../types/artist';
import { Song } from '../types/music';
import { ArtistSongRow } from '../components/music/ArtistSongRow';
import { AlbumModal } from '../components/music/AlbumModal';
import { usePlayer } from '../context/PlayerContext';
import { useQueue } from '../context/QueueContext';
import {
  ArrowLeft,
  Play,
  Shuffle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Disc,
  Music2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ArtistPageProps {
  artistId: number;
  initialArtistName?: string;
  initialGenre?: string;
  onBack: () => void;
  onShareSong?: (song: Song) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artistId,
  initialArtistName,
  initialGenre,
  onBack,
  onShareSong
}) => {
  const { playSong } = usePlayer();
  const { setQueueList } = useQueue();

  const [profile, setProfile] = useState<ArtistProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPlay, setIsProcessingPlay] = useState<boolean>(false);
  const [selectedAlbum, setSelectedAlbum] = useState<ItunesAlbum | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();

    fetchArtistProfile(artistId, initialArtistName, initialGenre, controller.signal)
      .then(({ data, error: profileError }) => {
        if (profileError) {
          setError(profileError);
        } else if (data) {
          setProfile(data);
        } else {
          setError('Could not load artist profile.');
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setError('Failed to fetch artist details. Please check your connection.');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  };

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      if (cleanup) cleanup();
    };
  }, [artistId]);

  // Play All: resolves first song and loads the rest into the queue
  const handlePlayAll = async (shuffle = false) => {
    if (!profile) return;
    const songList = profile.allSongs.length > 0 ? profile.allSongs : profile.popularSongs;
    if (songList.length === 0) return;

    setIsProcessingPlay(true);
    let songsToQueue = [...songList];

    if (shuffle) {
      // Fisher-Yates shuffle
      for (let i = songsToQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songsToQueue[i], songsToQueue[j]] = [songsToQueue[j], songsToQueue[i]];
      }
    }

    const first = songsToQueue[0];
    const rest = songsToQueue.slice(1).map(itunesSongToMoodsonixSong);

    // Load remaining tracks into existing queue
    setQueueList(rest);

    try {
      // Search "{artist} {song title}" via YouTube search, take the best match
      const query = `${first.artistName} ${first.trackName}`.trim();
      const { results } = await searchMusic(query);

      if (results && results.length > 0) {
        const bestMatch = results[0];
        playSong({
          ...bestMatch,
          title: first.trackName || bestMatch.title,
          artist: first.artistName || bestMatch.artist,
          album: first.collectionName || bestMatch.album,
          thumbnail: upscaleArtwork(first.artworkUrl100) || bestMatch.thumbnail
        });
      } else {
        playSong(itunesSongToMoodsonixSong(first));
      }
    } catch {
      playSong(itunesSongToMoodsonixSong(first));
    } finally {
      setIsProcessingPlay(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white hover:border-[var(--accent)] transition-all shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--accent)] group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Search</span>
        </button>
      </div>

      {/* SKELETON LOADER STATE */}
      {isLoading && (
        <div className="space-y-8 animate-pulse">
          {/* Header Banner Skeleton */}
          <div className="relative h-64 sm:h-80 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border-color)] overflow-hidden p-6 sm:p-8 flex flex-col justify-end">
            <div className="w-20 h-4 bg-[var(--surface-elevated)] rounded-md mb-2" />
            <div className="w-2/3 h-9 sm:h-12 bg-[var(--surface-elevated)] rounded-lg mb-3" />
            <div className="w-1/3 h-4 bg-[var(--surface-elevated)] rounded-md" />
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-11 bg-[var(--surface-secondary)] rounded-full" />
            <div className="w-28 h-11 bg-[var(--surface-secondary)] rounded-full" />
          </div>

          {/* Popular Tracks Skeleton */}
          <div className="space-y-3">
            <div className="w-36 h-4 bg-[var(--surface-secondary)] rounded" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-color)] flex items-center gap-3"
                >
                  <div className="w-5 h-4 bg-[var(--surface-elevated)] rounded" />
                  <div className="w-11 h-11 bg-[var(--surface-elevated)] rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/2" />
                    <div className="h-3 bg-[var(--surface-elevated)] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {error && !isLoading && (
        <div className="p-8 text-center rounded-3xl bg-[var(--surface)] border border-red-500/20 text-red-400 space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto opacity-80" />
          <div>
            <h3 className="font-bold text-base text-[var(--text-primary)]">Unable to load artist profile</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="px-5 py-2.5 rounded-xl bg-[var(--surface-secondary)] text-xs text-white hover:bg-[var(--surface-elevated)] transition-colors inline-flex items-center gap-2 border border-[var(--border-color)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* LOADED ARTIST PROFILE */}
      {!isLoading && !error && profile && (
        <div className="space-y-8">
          {/* HEADER: Big banner with artist name, genre, top album artwork upscaled to 600x600, dark gradient */}
          <div className="relative min-h-[260px] sm:min-h-[320px] rounded-3xl overflow-hidden border border-[var(--border-color)] shadow-2xl flex flex-col justify-end p-6 sm:p-10 select-none">
            {/* Background Artwork */}
            {profile.topArtwork ? (
              <img
                src={profile.topArtwork}
                alt={profile.artist.artistName}
                className="absolute inset-0 w-full h-full object-cover object-center filter blur-xs scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#12121e] to-[#0a0a0f]" />
            )}

            {/* Dark Gradient Overlay for optimal contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-[var(--bg)]/35" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/20 to-black/60" />

            {/* Content over Banner */}
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--accent)] font-mono text-[10px] font-semibold uppercase tracking-wider">
                  Verified Artist
                </span>
                {profile.artist.primaryGenreName && (
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    • {profile.artist.primaryGenreName}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                {profile.artist.artistName}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] pt-1">
                <span className="flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>{profile.allSongs.length} Tracks</span>
                </span>
                {profile.albums.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{profile.albums.length} Albums</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS: Green Play All & Shuffle */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handlePlayAll(false)}
              disabled={isProcessingPlay || profile.allSongs.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-black font-semibold text-xs sm:text-sm hover:bg-[var(--accent-hover)] transition-all shadow-lg glow-accent-sm hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {isProcessingPlay ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
              <span>Play All</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              disabled={isProcessingPlay || profile.allSongs.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-color)] font-semibold text-xs sm:text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-md hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>

          {/* "POPULAR" SECTION: Top 5 songs with numbers, artwork, title, and duration */}
          {profile.popularSongs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>// POPULAR</span>
                </h2>
              </div>

              <div className="space-y-1">
                {profile.popularSongs.map((song, idx) => (
                  <ArtistSongRow
                    key={song.trackId}
                    song={song}
                    index={idx}
                    showIndexNumber={true}
                    onShare={onShareSong}
                  />
                ))}
              </div>
            </div>
          )}

          {/* "ALBUMS" SECTION: Horizontal scroll of album cards. Tapping one shows album tracks */}
          {profile.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5" />
                  <span>// ALBUMS ({profile.albums.length})</span>
                </h2>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Scroll for more →
                </span>
              </div>

              {/* Horizontal Scroll of Album Cards */}
              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
                {profile.albums.map((album) => {
                  const artwork = upscaleArtwork(album.artworkUrl100) || album.artworkUrl100;
                  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;

                  return (
                    <div
                      key={album.collectionId}
                      onClick={() => setSelectedAlbum(album)}
                      className="group cursor-pointer shrink-0 w-36 sm:w-44 flex flex-col p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-secondary)] transition-all snap-start shadow-sm"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] mb-2.5 shadow-md">
                        {artwork ? (
                          <img
                            src={artwork}
                            alt={album.collectionName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                            <Disc className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-black shadow-lg">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <p className="font-semibold text-xs text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                        {album.collectionName}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                        {year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{year}</span>
                          </span>
                        )}
                        {album.trackCount && (
                          <span>{album.trackCount} tracks</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* "ALL SONGS" SECTION: Full list deduplicated by track name */}
          {profile.allSongs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>// ALL SONGS ({profile.allSongs.length})</span>
                </h2>
              </div>

              <div className="space-y-1">
                {profile.allSongs.map((song, idx) => (
                  <ArtistSongRow
                    key={song.trackId}
                    song={song}
                    index={idx}
                    showIndexNumber={false}
                    onShare={onShareSong}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Album Tracks Modal */}
      <AlbumModal
        album={selectedAlbum}
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
        onShareSong={onShareSong}
      />
    </div>
  );
};
