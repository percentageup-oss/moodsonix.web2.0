import React from 'react';
import { usePlaylists } from '../../context/PlaylistContext';
import { CloudUpload, Heart, ListMusic, Loader2, X } from 'lucide-react';

export const CloudSyncModal: React.FC = () => {
  const {
    showSyncOffer,
    localSyncSummary,
    isSyncingToCloud,
    syncLocalDataToCloud,
    dismissSyncOffer
  } = usePlaylists();

  if (!showSyncOffer) return null;

  const { localLikedCount, localPlaylistCount } = localSyncSummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismissSyncOffer}
          disabled={isSyncingToCloud}
          aria-label="Skip cloud sync"
          className="absolute top-5 right-5 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] mb-4">
          <CloudUpload className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Upload your local library to the cloud?
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          We found music saved locally on this device from guest mode. We can upload it to your account without creating duplicates.
        </p>

        <div className="mt-4 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] space-y-2 text-xs">
          {localLikedCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Heart className="w-4 h-4 text-red-500 fill-current" />
                Local liked songs
              </span>
              <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {localLikedCount}
              </span>
            </div>
          )}
          {localPlaylistCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                <ListMusic className="w-4 h-4 text-[var(--accent)]" />
                Local playlists
              </span>
              <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {localPlaylistCount}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 mt-6">
          <button
            type="button"
            onClick={dismissSyncOffer}
            disabled={isSyncingToCloud}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={syncLocalDataToCloud}
            disabled={isSyncingToCloud}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md glow-accent-sm disabled:opacity-60 cursor-pointer"
          >
            {isSyncingToCloud ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                <span>Upload to Cloud</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
