import React, { useState } from 'react';
import { usePlaylists } from '../../context/PlaylistContext';
import { X, Lock, Globe, ListMusic, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (playlistId: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const { createPlaylist } = usePlaylists();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false); // Default Private
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    const created = await createPlaylist({
      name: name.trim(),
      description: description.trim(),
      isPublic
    });
    setSubmitting(false);

    if (created) {
      setName('');
      setDescription('');
      setIsPublic(false);
      onClose();
      onCreated?.(created.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Create Playlist
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Playlist Name
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Late Night Coding"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={3}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ambient electronics and mellow instrumentals..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* Public / Private Toggle */}
          <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center shrink-0">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-[var(--accent)]" />
                ) : (
                  <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {isPublic ? 'Public Playlist' : 'Private Playlist'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isPublic
                    ? 'Visible in Explore and via shared link'
                    : 'Only visible to you'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] shrink-0">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                  !isPublic
                    ? 'bg-[var(--accent)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                  isPublic
                    ? 'bg-[var(--accent)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                Public
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold text-xs transition-all shadow-md glow-accent-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Playlist</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
