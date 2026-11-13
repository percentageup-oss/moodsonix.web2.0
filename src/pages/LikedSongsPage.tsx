import React, { useState } from 'react';
import { useQueue } from '../context/QueueContext';
import { usePlaylists } from '../context/PlaylistContext';
import { usePlayer } from '../context/PlayerContext';
import { useArtistNavigation } from '../context/ArtistNavigationContext';
import { useToast } from '../context/ToastContext';
import { Song } from '../types/music';
import { SongRow } from '../components/music/SongRow';
import { CreatePlaylistModal } from '../components/music/CreatePlaylistModal';
import {
  Heart,
  Play,
  Shuffle,
  Search,
  Users,
  UserCheck,
  ListMusic,
  Plus,
  Lock,
  Globe,
  Share2,
  Trash2,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LikedSongsPageProps {
  onShareSong: (song: Song) => void;
  onNavigate: (page: string) => void;
  onOpenPlaylist: (playlistId: string) => void;
}

export const LikedSongsPage: React.FC<LikedSongsPageProps> = ({
  onShareSong,
  onNavigate,
  onOpenPlaylist
}) => {
  const {
    likedSongs,
    likedLoading,
    followedArtists,
    toggleFollowArtist,
    setQueueList
  } = useQueue();
  const {
    myPlaylists,
    myPlaylistsLoading,
    togglePlaylistPrivacy,
    updatePlaylistDetails,
    deletePlaylist
  } = usePlaylists();
  const { playSong } = usePlayer();
  const { openArtist } = useArtistNavigation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists' | 'artists'>('tracks');
  const [filterQuery, setFilterQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Quick rename state on playlist card
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredSongs = likedSongs.filter((song) => {
    const q = filterQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q)
    );
  });

  const filteredPlaylists = myPlaylists.filter((pl) => {
    const q = filterQuery.toLowerCase();
    return (
      pl.name.toLowerCase().includes(q) ||
      (pl.description && pl.description.toLowerCase().includes(q))
    );
  });

  const filteredArtists = followedArtists.filter((artist) => {
    const q = filterQuery.toLowerCase();
    return (
      artist.name.toLowerCase().includes(q) ||
      (artist.genre && artist.genre.toLowerCase().includes(q))
    );
  });

  const handlePlayAll = () => {
    if (likedSongs.length === 0) return;
    const [first, ...rest] = likedSongs;
    setQueueList(rest);
    playSong(first);
  };

  const handleShuffleAll = () => {
    if (likedSongs.length === 0) return;
    const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
    const [first, ...rest] = shuffled;
    setQueueList(rest);
    playSong(first);
  };

  const handleSharePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/playlist/${playlistId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Playlist link copied to clipboard', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  const submitRename = async (e: React.FormEvent, playlistId: string) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    const ok = await updatePlaylistDetails(playlistId, { name: renameValue.trim() });
    if (ok) {
      setRenamingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-5xl">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-red-950/35 via-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border-color)]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] font-semibold">
              Your Library
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mt-0.5">
              Favorites, Playlists & Artists
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'} · {myPlaylists.length} {myPlaylists.length === 1 ? 'playlist' : 'playlists'} · {followedArtists.length} followed {followedArtists.length === 1 ? 'artist' : 'artists'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'tracks' && likedSongs.length > 0 && (
            <>
              <button
                onClick={handlePlayAll}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play All</span>
              </button>
              <button
                onClick={handleShuffleAll}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-color)] font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Shuffle className="w-4 h-4 text-[var(--accent)]" />
                <span>Shuffle</span>
              </button>
            </>
          )}

          {activeTab === 'playlists' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* Library Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('tracks')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer',
              activeTab === 'tracks'
                ? 'bg-[var(--accent)] text-black shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', activeTab === 'tracks' ? 'fill-black' : '')} />
            <span>Liked Songs ({likedSongs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer',
              activeTab === 'playlists'
                ? 'bg-[var(--accent)] text-black shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
            )}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>My Playlists ({myPlaylists.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('artists')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer',
              activeTab === 'artists'
                ? 'bg-[var(--accent)] text-black shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Artists ({followedArtists.length})</span>
          </button>
        </div>

        {/* Filter Input */}
        <div className="relative sm:max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={
              activeTab === 'tracks'
                ? 'Filter liked songs...'
                : activeTab === 'playlists'
                ? 'Filter playlists...'
                : 'Filter artists...'
            }
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* TAB 1: LIKED SONGS */}
      {activeTab === 'tracks' && (
        <div className="space-y-4">
          {likedLoading && likedSongs.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] animate-pulse"
                />
              ))}
            </div>
          ) : likedSongs.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)] space-y-3">
              <Heart className="w-12 h-12 mx-auto opacity-20 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">No liked songs yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Tap the heart icon on any song while listening or browsing to save it to your favorites.
              </p>
              <button
                onClick={() => onNavigate('search')}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors inline-block mt-2 cursor-pointer"
              >
                Discover Music
              </button>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <p className="text-xs">No favorites matching "{filterQuery}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSongs.map((song, idx) => (
                <SongRow key={song.id} song={song} index={idx} onShare={onShareSong} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY PLAYLISTS */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          {myPlaylistsLoading && myPlaylists.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] animate-pulse space-y-3"
                >
                  <div className="h-36 rounded-xl bg-[var(--surface-secondary)]" />
                  <div className="h-4 w-2/3 rounded bg-[var(--surface-secondary)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--surface-secondary)]" />
                </div>
              ))}
            </div>
          ) : myPlaylists.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] space-y-3 px-4">
              <ListMusic className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-30" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                No playlists yet
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Organize your favorite tracks into private collections or public playlists to share.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Playlist</span>
              </button>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <p className="text-xs">No playlists matching "{filterQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaylists.map((playlist) => {
                const isRenaming = renamingId === playlist.id;
                const isConfirmingDelete = confirmDeleteId === playlist.id;

                return (
                  <div
                    key={playlist.id}
                    onClick={() => !isRenaming && onOpenPlaylist(playlist.id)}
                    className="group flex flex-col p-4 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 transition-all cursor-pointer"
                  >
                    {/* Cover */}
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] mb-3 flex items-center justify-center">
                      {playlist.coverUrl ? (
                        <img
                          src={playlist.coverUrl}
                          alt={playlist.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ListMusic className="w-10 h-10 text-[var(--accent)]/50" />
                      )}

                      {playlist.songs.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const tracks = playlist.songs.map((ps) => ps.song);
                            setQueueList(tracks.slice(1));
                            playSong(tracks[0]);
                          }}
                          title="Play playlist"
                          className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </button>
                      )}
                    </div>

                    {/* Title / Rename */}
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => submitRename(e, playlist.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 mb-2"
                      >
                        <input
                          type="text"
                          autoFocus
                          required
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--accent)] text-xs text-[var(--text-primary)] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg bg-[var(--accent)] text-black cursor-pointer"
                          title="Save name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="p-1.5 rounded-lg bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors flex items-center gap-1.5">
                            {playlist.isPublic ? (
                              <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                            )}
                            <span className="truncate">{playlist.name}</span>
                          </h3>
                          {playlist.description && (
                            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                              {playlist.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Meta + Quick Controls */}
                    <div
                      className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="tabular-nums">
                        {playlist.isPublic ? 'Public' : 'Private'} · {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePlaylistPrivacy(playlist.id)}
                          title={playlist.isPublic ? 'Make Private' : 'Make Public'}
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                        >
                          {playlist.isPublic ? (
                            <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setRenamingId(playlist.id);
                            setRenameValue(playlist.name);
                          }}
                          title="Rename playlist"
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleSharePlaylist(e, playlist.id)}
                          title="Copy share link"
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        {isConfirmingDelete ? (
                          <button
                            onClick={() => {
                              deletePlaylist(playlist.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(playlist.id)}
                            title="Delete playlist"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FOLLOWED ARTISTS */}
      {activeTab === 'artists' && (
        <div className="space-y-4">
          {followedArtists.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)] space-y-3">
              <Users className="w-12 h-12 mx-auto opacity-20 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">No followed artists yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Tap any artist name in the player or search results and press "Follow" to keep up with their latest tracks and albums.
              </p>
              <button
                onClick={() => onNavigate('search')}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors inline-block mt-2 cursor-pointer"
              >
                Find Artists
              </button>
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <p className="text-xs">No artists matching "{filterQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredArtists.map((artist) => {
                const initial = artist.name ? artist.name.charAt(0).toUpperCase() : 'A';

                return (
                  <div
                    key={artist.id}
                    className="group relative flex flex-col items-center p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-secondary)] transition-all cursor-pointer shadow-sm text-center"
                    onClick={() => openArtist(artist.name)}
                  >
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-[var(--accent)] transition-all shadow-md bg-[var(--surface-elevated)]">
                      {artist.avatarUrl ? (
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900 text-[var(--accent)] font-mono font-bold text-2xl">
                          {initial}
                        </div>
                      )}
                    </div>

                    <p className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate w-full">
                      {artist.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 w-full">
                      {artist.genre || artist.monthlyListeners || 'Artist'}
                    </p>

                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleFollowArtist(artist)}
                        title="Unfollow artist"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--accent)]/30 hover:border-red-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Following</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(id) => onOpenPlaylist(id)}
      />
    </div>
  );
};
