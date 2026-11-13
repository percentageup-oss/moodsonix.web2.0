import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylists } from '../context/PlaylistContext';
import { usePlayer } from '../context/PlayerContext';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { Playlist } from '../types/playlist';
import {
  Globe,
  Search,
  Play,
  Share2,
  ListMusic,
  RefreshCw,
  AlertCircle,
  X,
  User
} from 'lucide-react';

interface ExplorePageProps {
  onOpenPlaylist: (playlistId: string) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ onOpenPlaylist }) => {
  const {
    publicPlaylists,
    publicPlaylistsLoading,
    publicPlaylistsError,
    refreshPublicPlaylists
  } = usePlaylists();
  const { playSong } = usePlayer();
  const { setQueueList } = useQueue();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    refreshPublicPlaylists();
  }, [refreshPublicPlaylists]);

  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return publicPlaylists;
    return publicPlaylists.filter((pl) => {
      return (
        pl.name.toLowerCase().includes(q) ||
        (pl.description && pl.description.toLowerCase().includes(q)) ||
        (pl.ownerName && pl.ownerName.toLowerCase().includes(q))
      );
    });
  }, [publicPlaylists, searchQuery]);

  const handlePlayPlaylist = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    if (playlist.songs.length === 0) {
      showToast('This playlist has no songs yet', 'info');
      return;
    }
    const tracks = playlist.songs.map((ps) => ps.song);
    const [first, ...rest] = tracks;
    setQueueList(rest);
    playSong(first);
  };

  const handleSharePlaylist = async (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    const url = `${window.location.origin}/playlist/${playlist.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Playlist link copied to clipboard', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent)]">
            <Globe className="w-4 h-4" />
            <span>Community Discovery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Explore Public Playlists
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Listen to collections curated and shared by listeners across Moodsonix.
          </p>
        </div>

        <button
          onClick={refreshPublicPlaylists}
          disabled={publicPlaylistsLoading}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${publicPlaylistsLoading ? 'animate-spin text-[var(--accent)]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search public playlists by name, mood, or creator..."
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {publicPlaylistsLoading && publicPlaylists.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] animate-pulse"
            >
              <div className="aspect-square w-full rounded-xl bg-[var(--surface-secondary)] mb-3" />
              <div className="h-4 w-3/4 bg-[var(--surface-secondary)] rounded mb-2" />
              <div className="h-3 w-1/2 bg-[var(--surface-secondary)] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!publicPlaylistsLoading && publicPlaylistsError && (
        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-red-500/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Could not load public playlists
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">{publicPlaylistsError}</p>
          </div>
          <button
            onClick={refreshPublicPlaylists}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!publicPlaylistsLoading && !publicPlaylistsError && filteredPlaylists.length === 0 && (
        <div className="py-16 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] space-y-3 px-4">
          <ListMusic className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-40" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {searchQuery
              ? `No public playlists matching "${searchQuery}"`
              : 'No public playlists shared yet'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {searchQuery
              ? 'Try another keyword or clear your search filter.'
              : 'Create a playlist in your Library and switch it to Public to share it with everyone.'}
          </p>
        </div>
      )}

      {/* Playlists Grid */}
      {!publicPlaylistsError && filteredPlaylists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => onOpenPlaylist(playlist.id)}
              className="group relative flex flex-col p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 transition-all cursor-pointer"
            >
              {/* Cover Art from First Song */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] mb-3 flex items-center justify-center">
                {playlist.coverUrl ? (
                  <img
                    src={playlist.coverUrl}
                    alt={playlist.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#161822] to-[#0D0E14] flex items-center justify-center">
                    <ListMusic className="w-10 h-10 text-[var(--accent)]/60" />
                  </div>
                )}

                {/* Play Overlay */}
                {playlist.songs.length > 0 && (
                  <button
                    onClick={(e) => handlePlayPlaylist(e, playlist)}
                    title="Play playlist"
                    aria-label={`Play ${playlist.name}`}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                )}
              </div>

              {/* Metadata */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                    {playlist.description}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{playlist.ownerName || 'Listener'}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="tabular-nums">
                      {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}
                    </span>
                    <button
                      onClick={(e) => handleSharePlaylist(e, playlist)}
                      title="Copy share link"
                      aria-label="Share playlist"
                      className="p-1.5 -mr-1 rounded-lg hover:bg-[var(--surface-elevated)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
