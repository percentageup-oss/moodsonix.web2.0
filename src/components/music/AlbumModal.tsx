import React, { useState, useEffect } from 'react';
import { ItunesAlbum, ItunesSong } from '../../types/artist';
import { Song } from '../../types/music';
import { fetchAlbumTracks, upscaleArtwork, itunesSongToMoodsonixSong } from '../../services/itunesApi';
import { searchMusic } from '../../services/musicApi';
import { ArtistSongRow } from './ArtistSongRow';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { X, Play, Loader2, Disc, Calendar, Music } from 'lucide-react';

interface AlbumModalProps {
  album: ItunesAlbum | null;
  isOpen: boolean;
  onClose: () => void;
  onShareSong?: (song: Song) => void;
}

export const AlbumModal: React.FC<AlbumModalProps> = ({
  album,
  isOpen,
  onClose,
  onShareSong
}) => {
  const { playSong } = usePlayer();
  const { setQueueList } = useQueue();

  const [tracks, setTracks] = useState<ItunesSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  useEffect(() => {
    if (!isOpen || !album) {
      setTracks([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchAlbumTracks(album.collectionId, controller.signal)
      .then(({ tracks: albumTracks, error: fetchErr }) => {
        if (fetchErr) {
          setError(fetchErr);
        } else {
          setTracks(albumTracks);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Failed to load tracks for this album.');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, album]);

  if (!isOpen || !album) return null;

  const artworkSrc = upscaleArtwork(album.artworkUrl100) || album.artworkUrl100;
  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;

  const handlePlayAlbum = async () => {
    if (tracks.length === 0) return;
    setIsPlayingAll(true);

    try {
      const first = tracks[0];
      const rest = tracks.slice(1).map(itunesSongToMoodsonixSong);

      // Load rest of album tracks into the queue
      setQueueList(rest);

      // Resolve and play the first track
      const { results } = await searchMusic(`${first.artistName} ${first.trackName}`);
      if (results && results.length > 0) {
        const bestMatch = results[0];
        playSong({
          ...bestMatch,
          title: first.trackName,
          artist: first.artistName,
          album: album.collectionName,
          thumbnail: upscaleArtwork(first.artworkUrl100) || bestMatch.thumbnail
        });
      } else {
        playSong(itunesSongToMoodsonixSong(first));
      }
    } catch {
      playSong(itunesSongToMoodsonixSong(tracks[0]));
    } finally {
      setIsPlayingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-[var(--surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden z-10">
        {/* Header with Album Artwork & Meta */}
        <div className="relative p-6 bg-gradient-to-b from-[var(--surface-elevated)] to-[var(--surface)] border-b border-[var(--border-color)] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-white/10 bg-[var(--surface-secondary)]">
              {artworkSrc ? (
                <img
                  src={artworkSrc}
                  alt={album.collectionName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--accent)]">
                  <Disc className="w-12 h-12" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] font-semibold">
                Album
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight line-clamp-2 mt-1">
                {album.collectionName}
              </h2>
              <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">
                {album.artistName}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-[var(--text-muted)] font-mono">
                {releaseYear && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>{releaseYear}</span>
                  </span>
                )}
                {album.primaryGenreName && (
                  <span className="flex items-center gap-1">
                    <Music className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>{album.primaryGenreName}</span>
                  </span>
                )}
                {tracks.length > 0 && (
                  <span>• {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
                )}
              </div>

              {/* Play Album Button */}
              <div className="mt-4 flex justify-center sm:justify-start">
                <button
                  onClick={handlePlayAlbum}
                  disabled={tracks.length === 0 || isPlayingAll}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm disabled:opacity-50"
                >
                  {isPlayingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                  <span>Play Album</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Tracks List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {isLoading && (
            <div className="space-y-2 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-color)] animate-pulse flex items-center gap-3"
                >
                  <div className="w-6 h-4 bg-[var(--surface-elevated)] rounded" />
                  <div className="w-10 h-10 bg-[var(--surface-elevated)] rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/2" />
                    <div className="h-3 bg-[var(--surface-elevated)] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="py-12 text-center text-xs text-red-400 space-y-2">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && tracks.length > 0 && (
            <div>
              {tracks.map((track, idx) => (
                <ArtistSongRow
                  key={track.trackId}
                  song={track}
                  index={idx}
                  showIndexNumber={true}
                  onShare={onShareSong}
                />
              ))}
            </div>
          )}

          {!isLoading && !error && tracks.length === 0 && (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No tracks available for this album.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
