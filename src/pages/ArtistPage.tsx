import React, { useState, useEffect } from 'react';
import { fetchArtistProfile, itunesSongToMoodsonixSong, upscaleArtwork } from '../services/itunesApi';
import { searchMusic } from '../services/musicApi';
import { ArtistProfileData, ItunesAlbum, ItunesSong } from '../types/artist';
import { Song } from '../types/music';
import { ArtistSongRow } from '../components/music/ArtistSongRow';
import { ArtistRoundCard } from '../components/music/ArtistRoundCard';
import { AlbumModal } from '../components/music/AlbumModal';
import { usePlayer } from '../context/PlayerContext';
import { useQueue } from '../context/QueueContext';
import { useArtistNavigation } from '../context/ArtistNavigationContext';
import { formatTime, cn } from '../lib/utils';
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Disc,
  Music2,
  Calendar,
  Sparkles,
  Heart,
  UserPlus,
  UserCheck,
  Tv,
  Users,
  Info
} from 'lucide-react';

interface ArtistPageProps {
  artistIdOrName: string | number;
  initialArtistName?: string;
  initialGenre?: string;
  onBack: () => void;
  onShareSong?: (song: Song) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artistIdOrName,
  initialArtistName,
  initialGenre,
  onBack,
  onShareSong
}) => {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { setQueueList, toggleFollowArtist, isArtistFollowed, toggleLike, isLiked } = useQueue();
  const { openArtist } = useArtistNavigation();

  const [profile, setProfile] = useState<ArtistProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPlay, setIsProcessingPlay] = useState<boolean>(false);
  const [selectedAlbum, setSelectedAlbum] = useState<ItunesAlbum | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();

    fetchArtistProfile(artistIdOrName, initialArtistName, initialGenre, controller.signal)
      .then(({ data, error: profileError }) => {
        if (profileError) {
          setError(profileError);
        } else if (data) {
          setProfile(data);
        } else {
          setError('Artist not found.');
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
  }, [artistIdOrName]);

  const artistIdentifier = profile ? profile.artist.artistId : artistIdOrName;
  const artistName = profile?.artist.artistName || initialArtistName || String(artistIdOrName);
  const followed = isArtistFollowed(artistIdentifier) || isArtistFollowed(artistName);

  const handleToggleFollow = () => {
    if (!profile) return;
    toggleFollowArtist({
      id: String(profile.artist.artistId || profile.artist.artistName),
      name: profile.artist.artistName,
      avatarUrl: profile.avatarUrl || profile.topArtwork || undefined,
      genre: profile.artist.primaryGenreName,
      monthlyListeners: profile.monthlyListeners,
      followedAt: Date.now()
    });
  };

  // Play All: plays first song and queues the rest of the artist's songs
  const handlePlayAll = async (shuffle = false) => {
    if (!profile) return;
    const songList = profile.popularSongs.length > 0 ? profile.popularSongs : profile.allSongs;
    if (songList.length === 0) return;

    setIsProcessingPlay(true);
    let songsToQueue = [...songList];

    if (shuffle) {
      for (let i = songsToQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songsToQueue[i], songsToQueue[j]] = [songsToQueue[j], songsToQueue[i]];
      }
    }

    const first = songsToQueue[0];
    const rest = songsToQueue.slice(1).map(itunesSongToMoodsonixSong);

    // Queue remaining tracks
    setQueueList(rest);

    try {
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

  // Tapping a popular song: plays it and queues the rest of the artist's songs
  const handlePlayPopularSong = async (song: ItunesSong) => {
    if (!profile) return;

    // Filter out the tapped song to create queue
    const all = profile.allSongs.length > 0 ? profile.allSongs : profile.popularSongs;
    const rest = all.filter((s) => s.trackId !== song.trackId).map(itunesSongToMoodsonixSong);
    setQueueList(rest);

    const moodsonixSong = itunesSongToMoodsonixSong(song);
    const isCurrent = currentSong?.id === moodsonixSong.id || currentSong?.title.toLowerCase() === song.trackName.toLowerCase();

    if (isCurrent) {
      togglePlay();
      return;
    }

    try {
      const query = `${song.artistName} ${song.trackName}`.trim();
      const { results } = await searchMusic(query);
      if (results && results.length > 0) {
        const bestMatch = results[0];
        playSong({
          ...bestMatch,
          title: song.trackName,
          artist: song.artistName,
          album: song.collectionName || bestMatch.album,
          thumbnail: upscaleArtwork(song.artworkUrl100) || bestMatch.thumbnail
        });
      } else {
        playSong(moodsonixSong);
      }
    } catch {
      playSong(moodsonixSong);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white hover:border-[var(--accent)] transition-all shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--accent)] group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>

        {profile && (
          <span className="text-[11px] font-mono text-[var(--text-muted)] hidden sm:inline">
            // {profile.artist.artistName.toUpperCase()} PROFILE
          </span>
        )}
      </div>

      {/* SKELETON LOADER STATE */}
      {isLoading && (
        <div className="space-y-8 animate-pulse">
          {/* Header Banner Skeleton */}
          <div className="relative min-h-[280px] sm:min-h-[340px] rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border-color)] overflow-hidden p-6 sm:p-10 flex flex-col justify-end">
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[var(--surface-elevated)] shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="w-24 h-4 bg-[var(--surface-elevated)] rounded-md" />
                <div className="w-2/3 h-10 sm:h-14 bg-[var(--surface-elevated)] rounded-xl" />
                <div className="w-1/3 h-4 bg-[var(--surface-elevated)] rounded-md" />
              </div>
            </div>
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-11 bg-[var(--surface-secondary)] rounded-full" />
            <div className="w-28 h-11 bg-[var(--surface-secondary)] rounded-full" />
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
                  <div className="w-12 h-12 bg-[var(--surface-elevated)] rounded-xl shrink-0" />
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
          <AlertCircle className="w-12 h-12 mx-auto opacity-80" />
          <div>
            <h3 className="font-bold text-base text-[var(--text-primary)]">Artist not found</h3>
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
          {/* HEADER: Large blurred banner background, round avatar, artist name, follower/listener count */}
          <div className="relative min-h-[300px] sm:min-h-[360px] rounded-3xl overflow-hidden border border-[var(--border-color)] shadow-2xl flex flex-col justify-end p-6 sm:p-10 select-none">
            {/* Background Blurred Artwork */}
            {profile.topArtwork ? (
              <img
                src={profile.topArtwork}
                alt={profile.artist.artistName}
                className="absolute inset-0 w-full h-full object-cover object-center filter blur-xl scale-110 opacity-60"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1b1c2b] via-[#101018] to-[#0a0a0f]" />
            )}

            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-[var(--bg)]/40" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/30 to-black/70" />

            {/* Header Content: Round Avatar + Info */}
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-5">
              {/* Round Avatar */}
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden shrink-0 border-2 border-[var(--accent)]/50 shadow-2xl bg-[var(--surface-elevated)] group">
                {profile.avatarUrl || profile.topArtwork ? (
                  <img
                    src={profile.avatarUrl || profile.topArtwork || ''}
                    alt={profile.artist.artistName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-950 text-[var(--accent)] font-mono font-bold text-3xl">
                    {profile.artist.artistName.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/10" />
              </div>

              {/* Text Meta */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-xs font-medium text-[var(--text-primary)] bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    {profile.monthlyListeners}
                  </span>
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
          </div>

          {/* ACTION BUTTONS: Play, Shuffle, and Follow */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handlePlayAll(false)}
              disabled={isProcessingPlay || profile.allSongs.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-black font-semibold text-xs sm:text-sm hover:bg-[var(--accent-hover)] transition-all shadow-lg glow-accent-sm hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isProcessingPlay ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
              <span>Play</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              disabled={isProcessingPlay || profile.allSongs.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-color)] font-semibold text-xs sm:text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            {/* Follow / Following Button */}
            <button
              onClick={handleToggleFollow}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-xs sm:text-sm transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer',
                followed
                  ? 'bg-[var(--accent)]/15 border border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-white/20'
              )}
            >
              {followed ? (
                <>
                  <UserCheck className="w-4 h-4 text-[var(--accent)]" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>
          </div>

          {/* POPULAR SONGS: List with number, cover art, title, duration, and heart button */}
          {profile.popularSongs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>// POPULAR</span>
                </h2>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Tap track to play & queue discography
                </span>
              </div>

              <div className="space-y-1">
                {profile.popularSongs.map((song, idx) => {
                  const moodsonixSong = itunesSongToMoodsonixSong(song);
                  const isCurrent =
                    currentSong?.id === moodsonixSong.id ||
                    (currentSong?.title?.toLowerCase() === song.trackName.toLowerCase() &&
                      currentSong?.artist?.toLowerCase().includes(song.artistName.toLowerCase()));
                  const isSongPlaying = isCurrent && isPlaying;
                  const liked = isLiked(moodsonixSong.id) || (currentSong && isCurrent ? isLiked(currentSong.id) : false);
                  const artwork = upscaleArtwork(song.artworkUrl100) || song.artworkUrl100;
                  const durationSec = song.trackTimeMillis ? Math.round(song.trackTimeMillis / 1000) : 180;

                  return (
                    <div
                      key={song.trackId}
                      onClick={() => handlePlayPopularSong(song)}
                      className={cn(
                        'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent select-none',
                        isCurrent
                          ? 'bg-[var(--surface-elevated)] border-[var(--border-color)] text-[var(--accent)] shadow-sm'
                          : 'hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                      )}
                    >
                      {/* Left: Index, Cover, Title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-mono font-bold text-[var(--text-muted)] group-hover:hidden">
                          {idx + 1}
                        </span>

                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[var(--surface)] border border-[var(--border-color)]">
                          {artwork ? (
                            <img
                              src={artwork}
                              alt={song.trackName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-xs text-[var(--accent)]">
                              {song.trackName.charAt(0)}
                            </div>
                          )}

                          <div
                            className={cn(
                              'absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity',
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            {isSongPlaying ? (
                              <Pause className="w-5 h-5 text-[var(--accent)] fill-[var(--accent)]" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'font-medium text-sm truncate',
                              isCurrent ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'
                            )}
                          >
                            {song.trackName}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                            {song.collectionName || song.artistName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Heart button, Duration */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleLike(moodsonixSong)}
                          title={liked ? 'Unlike' : 'Like'}
                          className={cn(
                            'p-2 rounded-lg transition-colors hover:bg-[var(--surface-elevated)]',
                            liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-white'
                          )}
                        >
                          <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
                        </button>

                        <span className="text-xs font-mono text-[var(--text-muted)] w-11 text-right">
                          {formatTime(durationSec)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ALBUMS SECTION: Horizontal scroll row */}
          {profile.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5" />
                  <span>// ALBUMS ({profile.albums.length})</span>
                </h2>
                <span className="text-[11px] text-[var(--text-muted)]">Scroll for more →</span>
              </div>

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
                        {album.trackCount && <span>{album.trackCount} tracks</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SINGLES & EPS SECTION: Horizontal scroll row */}
          {profile.singlesAndEPs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>// SINGLES & EPS ({profile.singlesAndEPs.length})</span>
                </h2>
                <span className="text-[11px] text-[var(--text-muted)]">Scroll for more →</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
                {profile.singlesAndEPs.map((single) => {
                  const artwork = upscaleArtwork(single.artworkUrl100) || single.artworkUrl100;
                  const year = single.releaseDate ? new Date(single.releaseDate).getFullYear() : null;

                  return (
                    <div
                      key={single.collectionId}
                      onClick={() => setSelectedAlbum(single)}
                      className="group cursor-pointer shrink-0 w-36 sm:w-44 flex flex-col p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-secondary)] transition-all snap-start shadow-sm"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] mb-2.5 shadow-md">
                        {artwork ? (
                          <img
                            src={artwork}
                            alt={single.collectionName}
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
                        {single.collectionName}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                        {year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{year}</span>
                          </span>
                        )}
                        <span>Single / EP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIDEOS SECTION: Horizontal scroll row of YouTube Music Videos */}
          {profile.videos && profile.videos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>// MUSIC VIDEOS & PERFORMANCES</span>
                </h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
                {profile.videos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => playSong(vid)}
                    className="group cursor-pointer shrink-0 w-56 sm:w-64 flex flex-col p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-secondary)] transition-all snap-start shadow-sm"
                  >
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] mb-2 shadow-md">
                      <img
                        src={vid.thumbnail}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-white/90">
                        {formatTime(vid.duration)}
                      </div>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-black shadow-lg">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <p className="font-semibold text-xs text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                      {vid.title}
                    </p>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                      YouTube Video
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIMILAR ARTISTS SECTION: Row of round avatars */}
          {profile.similarArtists && profile.similarArtists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>// FANS ALSO LIKE</span>
                </h2>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
                {profile.similarArtists.map((similar) => (
                  <ArtistRoundCard
                    key={similar.artistId}
                    artist={similar}
                    onClick={(a) => openArtist(a.artistName, a)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ABOUT SECTION: Bio, stats, image */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>// ABOUT {profile.artist.artistName.toUpperCase()}</span>
            </h2>

            <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] flex flex-col md:flex-row items-center md:items-start gap-6">
              {profile.avatarUrl && (
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                  <img
                    src={profile.avatarUrl}
                    alt={profile.artist.artistName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <span className="text-lg font-bold text-white">
                    {profile.monthlyListeners}
                  </span>
                  <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-0.5 rounded-full border border-[var(--accent)]/30 font-mono">
                    {profile.artist.primaryGenreName || 'Music'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleToggleFollow}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-elevated)] border border-[var(--border-color)] hover:border-[var(--accent)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
                  >
                    {followed ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Following Artist</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow on Moodsonix</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ALL SONGS SECTION */}
          {profile.allSongs.length > 0 && (
            <div className="space-y-3 pt-2">
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
