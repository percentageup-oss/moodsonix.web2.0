import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePlayer } from '../../context/PlayerContext';
import { WifiOff, Loader2 } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { isLoading, currentSong } = usePlayer();

  if (isOnline) return null;

  const isSongWaiting = isLoading && Boolean(currentSong);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[var(--surface-elevated)]/95 border border-[var(--border-color)] backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-xl animate-in slide-in-from-top duration-300 select-none">
      {isSongWaiting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin shrink-0" />
          <span className="text-[var(--accent)]">Waiting for connection...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>You are offline</span>
        </>
      )}
    </div>
  );
};

