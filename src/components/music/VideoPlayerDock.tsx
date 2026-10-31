import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { cn } from '../../lib/utils';
import {
  Tv,
  Minimize2,
  Maximize2,
  Volume2,
  X,
  Radio,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const VideoPlayerDock: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    isVideoOpen,
    setIsVideoOpen,
    toggleVideo,
    setIsNowPlayingOpen
  } = usePlayer();

  const [isCompactDocked, setIsCompactDocked] = useState(false);

  // If there is no song loaded yet, keep the iframe mounted but neatly tucked
  const hasSong = Boolean(currentSong);

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out z-40 select-none',
        // Expanded video player
        isVideoOpen
          ? 'fixed bottom-24 right-4 md:right-8 w-72 h-44 sm:w-80 sm:h-48 md:w-96 md:h-56 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-black flex flex-col glow-accent-sm'
          // Compact docked audio mode
          : isCompactDocked
          ? 'fixed bottom-20 md:bottom-24 right-4 w-44 h-24 rounded-xl border border-[var(--border-color)] bg-[#0A0A0F]/95 shadow-xl overflow-hidden'
          : 'fixed bottom-20 md:bottom-24 right-4 w-52 h-32 md:w-60 md:h-36 rounded-2xl border border-[var(--border-color)] bg-black/95 shadow-xl overflow-hidden group',
        !hasSong && 'opacity-0 pointer-events-none'
      )}
    >
      {/* Header bar when expanded */}
      {isVideoOpen ? (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-elevated)]/90 backdrop-blur-md border-b border-white/10 shrink-0 z-10 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <Radio className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse shrink-0" />
            <span className="truncate font-medium text-[11px] text-[var(--text-primary)]">
              {currentSong?.title || 'YouTube Stream'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Open full Now Playing */}
            <button
              onClick={() => setIsNowPlayingOpen(true)}
              className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Open full screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {/* Minimize to dock */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Minimize video"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Floating mini-dock overlay controls on hover */
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsCompactDocked(!isCompactDocked)}
            className="p-1 rounded-md bg-black/70 backdrop-blur-md text-white/80 hover:text-white"
            title={isCompactDocked ? 'Expand dock' : 'Minimize dock'}
          >
            {isCompactDocked ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={toggleVideo}
            className="p-1 rounded-md bg-[var(--accent)] text-black font-medium text-[10px] flex items-center gap-1 shadow-md hover:scale-105 transition-all"
            title="Expand video window"
          >
            <Tv className="w-3 h-3" />
            <span className="hidden sm:inline">Video</span>
          </button>
        </div>
      )}

      {/* Actual YouTube Iframe Anchor */}
      <div className="w-full flex-1 relative bg-black min-h-[90px]">
        <div id="youtube-player-iframe" className="w-full h-full" />
      </div>

      {/* Docked bottom audio status badge when not expanded */}
      {!isVideoOpen && !isCompactDocked && (
        <div
          onClick={toggleVideo}
          className="absolute bottom-0 inset-x-0 px-2.5 py-1 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex items-center justify-between cursor-pointer group-hover:from-black"
        >
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', isPlaying ? 'bg-[var(--accent)] animate-ping' : 'bg-zinc-500')} />
            <p className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
              {isPlaying ? 'Live Audio Stream' : 'Stream Paused'}
            </p>
          </div>
          <span className="text-[9px] font-semibold text-[var(--accent)] group-hover:underline">
            Expand
          </span>
        </div>
      )}
    </div>
  );
};
