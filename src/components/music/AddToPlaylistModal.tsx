import React, { useState } from 'react';
import { usePlaylists } from '../../context/PlaylistContext';
import {
  X,
  Plus,
  Check,
  Lock,
  Globe,
  ListMusic,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const AddToPlaylistModal: React.FC = () => {
  const {
    addToPlaylistTarget,
    setAddToPlaylistTarget,
    myPlaylists,
    addSongToPlaylist,
    createPlaylist
  } = usePlaylists();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  if (!addToPlaylistTarget) return null;

  const song = addToPlaylistTarget;

  const handleClose = () => {
    setShowCreateForm(false);
    setNewName('');
    setNewIsPublic(false);
    setAddToPlaylistTarget(null);
  };

  const handleSelectPlaylist = async (playlistId: string) => {
    setAddingId(playlistId);
    await addSongToPlaylist(playlistId, song);
    setAddingId(null);
    handleClose();
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const created = await createPlaylist({
      name: newName.trim(),
      isPublic: newIsPublic
    });
    if (created) {
      await addSongToPlaylist(created.id, song);
      setCreating(false);
      handleClose();
      return;
    }
    setCreating(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl p-6 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-[var(--border-color)] rounded-full mx-auto -mt-2 mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ListMusic className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              Add to Playlist
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Song Preview */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] mb-4 shrink-0">
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-[var(--text-primary)]">
              {song.title}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {song.artist}
            </p>
          </div>
        </div>

        {/* Quick Create Playlist Toggle / Form */}
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-xs font-semibold text-[var(--accent)] transition-colors mb-3 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create new playlist</span>
          </button>
        ) : (
          <form
            onSubmit={handleCreateAndAdd}
            className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--accent)]/40 space-y-3 mb-3 shrink-0"
          >
            <input
              type="text"
              required
              autoFocus
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New playlist name..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setNewIsPublic(false)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer',
                    !newIsPublic
                      ? 'bg-[var(--accent)] text-black font-semibold'
                      : 'text-[var(--text-muted)]'
                  )}
                >
                  <Lock className="w-3 h-3" />
                  <span>Private</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewIsPublic(true)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer',
                    newIsPublic
                      ? 'bg-[var(--accent)] text-black font-semibold'
                      : 'text-[var(--text-muted)]'
                  )}
                >
                  <Globe className="w-3 h-3" />
                  <span>Public</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || creating}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black text-[11px] font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Create & Add</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Existing Playlists */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {myPlaylists.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              You don't have any playlists yet. Create one above!
            </div>
          ) : (
            myPlaylists.map((pl) => {
              const alreadyAdded = pl.songs.some((ps) => ps.videoId === song.id);
              const isAdding = addingId === pl.id;

              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => handleSelectPlaylist(pl.id)}
                  disabled={isAdding}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                      {pl.coverUrl ? (
                        <img
                          src={pl.coverUrl}
                          alt={pl.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ListMusic className="w-4 h-4 text-[var(--accent)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-[var(--text-primary)]">
                        {pl.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                        {pl.isPublic ? (
                          <Globe className="w-3 h-3 text-[var(--accent)] shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 shrink-0" />
                        )}
                        <span>{pl.isPublic ? 'Public' : 'Private'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {pl.songs.length} {pl.songs.length === 1 ? 'song' : 'songs'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)] shrink-0" />
                  ) : alreadyAdded ? (
                    <span className="text-[11px] font-medium text-[var(--accent)] flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      Added
                    </span>
                  ) : (
                    <Plus className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
