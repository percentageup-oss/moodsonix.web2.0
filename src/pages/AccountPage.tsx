import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useTheme } from '../context/ThemeContext';
import {
  Heart,
  History,
  ListMusic,
  LogIn,
  LogOut,
  Edit3,
  Check,
  X,
  CloudUpload,
  Loader2,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { PWAInstallButton } from '../components/common/PWAInstallButton';

interface AccountPageProps {
  onOpenTools: () => void;
  onOpenShortcuts: () => void;
  onNavigate?: (page: string) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onOpenTools,
  onOpenShortcuts,
  onNavigate
}) => {
  const { user, logout, setShowAuthModal, maxGuestSearches } = useUser();
  const { updateUsername } = useAuth();
  const { likedSongs, history, queue } = useQueue();
  const { myPlaylists, syncLocalDataToCloud, isSyncingToCloud } = usePlaylists();
  const { theme } = useTheme();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.displayName);
  const [savingName, setSavingName] = useState(false);

  const hasLocalItemsToSync = (() => {
    if (user.isGuest) return false;
    try {
      const localLiked = JSON.parse(localStorage.getItem('moodsonix_liked') || '[]');
      const localPl = JSON.parse(localStorage.getItem('moodsonix_local_playlists') || '[]');
      return (
        (Array.isArray(localLiked) && localLiked.length > 0) ||
        (Array.isArray(localPl) && localPl.length > 0)
      );
    } catch {
      return false;
    }
  })();

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setSavingName(true);
    const res = await updateUsername(usernameInput.trim());
    setSavingName(false);
    if (!res.error) {
      setEditingUsername(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-2xl">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] font-semibold">
          User Profile & Preferences
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
          Account & Settings
        </h1>
      </div>

      {/* User Status Card */}
      <div className="p-6 rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] flex items-center justify-center text-xl font-bold text-[var(--accent)] shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.displayName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="min-w-0 flex-1">
              {editingUsername && !user.isGuest ? (
                <form onSubmit={handleSaveUsername} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    autoFocus
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--accent)] text-sm font-semibold text-[var(--text-primary)] focus:outline-none w-44"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="p-1.5 rounded-lg bg-[var(--accent)] text-black cursor-pointer"
                    title="Save username"
                  >
                    {savingName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUsername(false)}
                    className="p-1.5 rounded-lg bg-[var(--surface)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <h2 className="text-base font-bold text-[var(--text-primary)] truncate">
                    {user.displayName}
                  </h2>
                  {!user.isGuest && (
                    <button
                      onClick={() => {
                        setUsernameInput(user.displayName);
                        setEditingUsername(true);
                      }}
                      title="Edit username"
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5 truncate">
                {user.isGuest ? (
                  'Guest Explorer (Local Storage)'
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </>
                )}
              </p>

              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                {user.isGuest ? 'Local session' : 'Cloud synced with Supabase'}
              </p>
            </div>
          </div>

          {user.isGuest ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm shrink-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          ) : (
            <button
              onClick={logout}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-red-500/10 text-xs font-medium text-[var(--text-secondary)] hover:text-red-400 border border-[var(--border-color)] transition-colors shrink-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>

        {/* Manual Sync option if local guest data still exists while signed in */}
        {!user.isGuest && hasLocalItemsToSync && (
          <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              You have local guest songs or playlists on this device ready to merge.
            </p>
            <button
              onClick={syncLocalDataToCloud}
              disabled={isSyncingToCloud}
              className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-black text-xs font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isSyncingToCloud ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Upload Local Library</span>
            </button>
          </div>
        )}

        {/* Guest Limit Progress Bar if Guest */}
        {user.isGuest && (
          <div className="mt-6 pt-4 border-t border-[var(--border-color)] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
              <span>Guest Search Usage</span>
              <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                {user.searchesCount} / {maxGuestSearches} searches
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.min(100, (user.searchesCount / maxGuestSearches) * 100)}%`
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Sign in to unlock unlimited music discovery, cloud backups, and cross-device playlist sync.
            </p>
          </div>
        )}
      </div>

      {/* Listening Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
          <Heart className="w-5 h-5 mx-auto text-red-500 mb-1.5" />
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {likedSongs.length}
          </p>
          <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] mt-0.5">
            Liked Songs
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
          <ListMusic className="w-5 h-5 mx-auto text-[var(--accent)] mb-1.5" />
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {myPlaylists.length}
          </p>
          <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] mt-0.5">
            Playlists
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
          <History className="w-5 h-5 mx-auto text-[var(--accent)] mb-1.5" />
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {history.length}
          </p>
          <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] mt-0.5">
            History
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
          <ListMusic className="w-5 h-5 mx-auto text-emerald-400 mb-1.5" />
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {queue.length}
          </p>
          <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] mt-0.5">
            Queue
          </p>
        </div>
      </div>

      {/* Application Settings & Utilities */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          Application Preferences
        </span>

        <div className="space-y-2">
          {/* Data Usage Telemetry */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Data Usage & Telemetry
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Track mobile data, Wi-Fi consumption, and quality stats
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('data-usage')}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors shrink-0 cursor-pointer"
              >
                View Usage
              </button>
            )}
          </div>

          {/* Quick theme change */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Interface Theme
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Active: <span className="capitalize text-[var(--accent)]">{theme.replace('theme-', '')}</span>
              </p>
            </div>
            <button
              onClick={onOpenTools}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] text-xs text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border-color)] transition-colors shrink-0 cursor-pointer"
            >
              Change Theme
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Desktop Shortcuts
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Quick controls: Space, Arrow keys, N, P, M
              </p>
            </div>
            <button
              onClick={onOpenShortcuts}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] text-xs text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border-color)] transition-colors shrink-0 cursor-pointer"
            >
              View Keys
            </button>
          </div>

          {/* Install PWA */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Progressive Web App
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Install Moodsonix for home screen & offline app shell
              </p>
            </div>
            <PWAInstallButton variant="compact" />
          </div>
        </div>
      </div>
    </div>
  );
};
