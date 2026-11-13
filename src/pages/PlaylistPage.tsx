import React, { useEffect, useState, useCallback } from 'react';
import { usePlaylists } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { Playlist, PlaylistSong } from '../types/playlist';
import { Song } from '../types/music';
import { formatTime, cn } from '../lib/utils';
import { ArtistLinks } from '../components/music/ArtistLinks';
import {
  Play,
  Pause,
  Shuffle,
  Share2,
  Lock,
  Globe,
  ArrowLeft,
  ListMusic,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Check,
  X,
  GripVertical,
  Loader2,
  User,
  Heart,
  ListPlus
} from 'lucide-react';

interface PlaylistPageProps {
  playlistId: string;
  onNavigate: (page: string) => void;
  onShareSong: (song: Song) => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
  playlistId,
  onNavigate,
  onShareSong
}) => {
  const { authUser } = useAuth();
  const {
    myPlaylists,
    fetchPlaylistById,
    updatePlaylistDetails,
    togglePlaylistPrivacy,
    deletePlaylist,
    removeSongFromPlaylist,
    reorderPlaylistSongs
  } = usePlaylists();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { setQueueList, addToQueue, toggleLike, isLiked } = useQueue();
  const { showToast } = useToast();

  const [fetchedPlaylist, setFetchedPlaylist] = useState<Playlist | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'private' | 'not_found' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Owner edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // If this playlist is in myPlaylists, stay synced with optimistic updates!
  const ownPlaylistMatch = myPlaylists.find((p) => p.id === playlistId);
  const playlist = ownPlaylistMatch || fetchedPlaylist;
  const isOwner = Boolean(
    playlist &&
      (ownPlaylistMatch ||
        (authUser && playlist.ownerId === authUser.id) ||
        playlist.id.startsWith('local_'))
  );

  const loadPlaylist = useCallback(async () => {
    setStatus('loading');
    const res = await fetchPlaylistById(playlistId);
    if (res.status === 'found' && res.playlist) {
      setFetchedPlaylist(res.playlist);
      setStatus('found');
    } else if (res.status === 'private') {
      setFetchedPlaylist(null);
      setStatus('private');
    } else if (res.status === 'not_found') {
      setFetchedPlaylist(null);
      setStatus('not_found');
    } else {
      setFetchedPlaylist(null);
      setStatus('error');
      setErrorMessage(res.errorMessage || 'Unable to load playlist.');
    }
  }, [playlistId, fetchPlaylistById]);

  useEffect(() => {
    if (ownPlaylistMatch) {
      setStatus('found');
      return;
    }
    loadPlaylist();
  }, [playlistId, ownPlaylistMatch, loadPlaylist]);

  const handlePlayAll = () => {
    if (!playlist || playlist.songs.length === 0) return;
    const tracks = playlist.songs.map((ps) => ps.song);
    const [first, ...rest] = tracks;
    setQueueList(rest);
    playSong(first);
  };

  const handleShuffle = () => {
    if (!playlist || playlist.songs.length === 0) return;
    const tracks = [...playlist.songs.map((ps) => ps.song)].sort(() => Math.random() - 0.5);
    const [first, ...rest] = tracks;
    setQueueList(rest);
    playSong(first);
  };

  const handleShare = async () => {
    if (!playlist) return;
    const url = `${window.location.origin}/playlist/${playlist.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  const startEditing = () => {
    if (!playlist) return;
    setEditName(playlist.name);
    setEditDescription(playlist.description || '');
    setIsEditing(true);
  };

  const saveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlist || !editName.trim()) return;
    const ok = await updatePlaylistDetails(playlist.id, {
      name: editName.trim(),
      description: editDescription.trim()
    });
    if (ok) {
      setIsEditing(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    const ok = await deletePlaylist(playlist.id);
    if (ok) {
      onNavigate('liked');
    }
  };

  const handleDropSong = (targetIndex: number) => {
    if (!playlist || dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    reorderPlaylistSongs(playlist.id, dragIndex, targetIndex);
    setDragIndex(null);
  };

  // Loading Skeleton
  if (status === 'loading' && !playlist) {
    return (
      <div className="space-y-6 pb-12 max-w-4xl animate-pulse">
        <div className="h-8 w-32 rounded-xl bg-[var(--surface-secondary)]" />
        <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] flex flex-col sm:flex-row gap-6">
          <div className="w-40 h-40 rounded-2xl bg-[var(--surface-secondary)] shrink-0" />
          <div className="flex-1 space-y-3 py-2">
            <div className="h-4 w-24 rounded bg-[var(--surface-secondary)]" />
            <div className="h-8 w-2/3 rounded bg-[var(--surface-secondary)]" />
            <div className="h-4 w-1/2 rounded bg-[var(--surface-secondary)]" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--surface)] border border-[var(--border-color)]" />
          ))}
        </div>
      </div>
    );
  }

  // Private or Not Found
  if (status === 'private' || status === 'not_found' || (!playlist && status === 'error')) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-center mx-auto text-[var(--accent)]">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          {status === 'error' ? 'Could not load playlist' : 'This playlist is private'}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {status === 'error'
            ? errorMessage
            : 'Only the owner can view this playlist, or it is no longer shared publicly.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('explore')}
            className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            Explore Public Playlists
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  const totalDuration = playlist.songs.reduce(
    (sum, ps) => sum + (ps.song.duration || 0),
    0
  );

  return (
    <div className="space-y-6 pb-12 max-w-4xl animate-in fade-in duration-300">
      {/* Back bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => onNavigate(isOwner ? 'liked' : 'explore')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isOwner ? 'Back to Library' : 'Back to Explore'}</span>
        </button>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePlaylistPrivacy(playlist.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Switch public/private visibility"
            >
              {playlist.isPublic ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Public</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Private</span>
                </>
              )}
            </button>

            <button
              onClick={startEditing}
              className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Rename or edit details"
              aria-label="Edit playlist details"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-xl bg-[var(--surface)] hover:bg-red-500/10 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                title="Delete playlist"
                aria-label="Delete playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-950/50 border border-red-500/30 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-red-200">Delete?</span>
                <button
                  onClick={handleDeletePlaylist}
                  className="px-2 py-0.5 rounded-lg bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-white cursor-pointer"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hero Card */}
      <div className="p-6 rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex flex-col sm:flex-row gap-6">
        {/* Cover from first song */}
        <div className="w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--border-color)] shrink-0 mx-auto sm:mx-0 flex items-center justify-center shadow-xl">
          {playlist.coverUrl ? (
            <img
              src={playlist.coverUrl}
              alt={playlist.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#171923] to-[#0D0E14] flex items-center justify-center">
              <ListMusic className="w-14 h-14 text-[var(--accent)]/60" />
            </div>
          )}
        </div>

        {/* Playlist Info & Actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
          {isEditing ? (
            <form onSubmit={saveEdits} className="space-y-3">
              <input
                type="text"
                required
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--accent)] text-base font-bold text-[var(--text-primary)] focus:outline-none"
              />
              <textarea
                rows={2}
                maxLength={240}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                {playlist.isPublic ? (
                  <span className="inline-flex items-center gap-1 text-[var(--accent)] font-medium">
                    <Globe className="w-3.5 h-3.5" />
                    Public Playlist
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    Private Playlist
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {playlist.ownerName || 'Listener'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mt-1.5 break-words">
                {playlist.name}
              </h1>

              {playlist.description && (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  {playlist.description}
                </p>
              )}

              <p className="text-xs text-[var(--text-muted)] mt-2 tabular-nums">
                {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
                {playlist.songs.length > 0 && ` · ${formatTime(totalDuration)}`}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePlayAll}
              disabled={playlist.songs.length === 0}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play All</span>
            </button>

            <button
              onClick={handleShuffle}
              disabled={playlist.songs.length === 0}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] font-medium text-xs flex items-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-[var(--accent)]" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={handleShare}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[var(--accent)]" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Song List */}
      {playlist.songs.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] space-y-3 px-4">
          <ListMusic className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-40" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            This playlist is empty
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isOwner
              ? 'Search for tracks or tap "Add to playlist" from any song menu or the player bar.'
              : 'No tracks have been added to this playlist yet.'}
          </p>
          {isOwner && (
            <button
              onClick={() => onNavigate('search')}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Find Songs
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {playlist.songs.map((ps: PlaylistSong, idx: number) => {
            const song = ps.song;
            const isCurrent = currentSong?.id === song.id;
            const isSongPlaying = isCurrent && isPlaying;
            const liked = isLiked(song.id);

            return (
              <div
                key={ps.id}
                draggable={isOwner}
                onDragStart={() => isOwner && setDragIndex(idx)}
                onDragOver={(e) => {
                  if (isOwner) e.preventDefault();
                }}
                onDrop={() => isOwner && handleDropSong(idx)}
                onClick={() => (isCurrent ? togglePlay() : playSong(song))}
                className={cn(
                  'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer',
                  isCurrent
                    ? 'bg-[var(--surface-elevated)] border-[var(--accent)]/40 text-[var(--accent)]'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border-[var(--border-color)] text-[var(--text-primary)]',
                  dragIndex === idx && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isOwner && (
                    <span
                      className="hidden sm:inline-flex text-[var(--text-muted)] cursor-grab"
                      title="Drag to reorder"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}

                  <span className="w-5 text-center font-mono text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                    {idx + 1}
                  </span>

                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] shrink-0">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div
                      className={cn(
                        'absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity',
                        isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {isSongPlaying ? (
                        <Pause className="w-4 h-4 text-[var(--accent)] fill-[var(--accent)]" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        isCurrent ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {song.title}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                      <ArtistLinks artist={song.artist} className="truncate" />
                    </p>
                  </div>
                </div>

                {/* Right Controls */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleLike(song)}
                    title={liked ? 'Unlike' : 'Like'}
                    className={cn(
                      'p-2 rounded-lg transition-colors hover:bg-[var(--surface-elevated)] cursor-pointer',
                      liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
                  </button>

                  <button
                    onClick={() => {
                      addToQueue(song);
                      showToast('Added to queue', 'info');
                    }}
                    title="Add to queue"
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onShareSong(song)}
                    title="Share song"
                    className="hidden sm:inline-flex p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {isOwner && (
                    <>
                      {idx > 0 && (
                        <button
                          onClick={() => reorderPlaylistSongs(playlist.id, idx, idx - 1)}
                          title="Move up"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < playlist.songs.length - 1 && (
                        <button
                          onClick={() => reorderPlaylistSongs(playlist.id, idx, idx + 1)}
                          title="Move down"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => removeSongFromPlaylist(playlist.id, ps.id)}
                        title="Remove from playlist"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
