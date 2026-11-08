import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { cn } from '../../lib/utils';
import { getRenderSize } from '../../lib/streamQuality';
import {
  Tv,
  Maximize2,
  X,
  Radio,
  ChevronDown
} from 'lucide-react';

export const VideoPlayerDock: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    isVideoOpen,
    setIsVideoOpen,
    setIsNowPlayingOpen,
    effectiveQuality
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);

  // Video preview is visible only when a song is loaded AND video toggle is on
  const isVisible = Boolean(currentSong && isVideoOpen);

  // YouTube picks the stream resolution from the size the player is laid out at, so the player is
  // always laid out at the size of the chosen quality and then scaled down with CSS to fit the dock.
  const boxRef = useRef<HTMLDivElement>(null);
  const render = getRenderSize(effectiveQuality);
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const boxW = el.clientWidth;
      const boxH = el.clientHeight;
      if (!boxW || !boxH) return;
      const scale = Math.min(boxW / render.w, boxH / render.h);
      setFit({
        scale,
        x: (boxW - render.w * scale) / 2,
        y: (boxH - render.h * scale) / 2
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [render.w, render.h, isVisible, isExpanded]);

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out select-none',
        // When not visible: keep completely mounted so YouTube player & audio are never destroyed!
        // Offscreen with 1px dimensions and opacity 0 (NEVER display:none)
        !isVisible
          ? 'fixed -left-[9999px] -top-[9999px] w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden z-[-1]'
          // When visible and expanded: larger floating video player
          : isExpanded
          ? 'fixed bottom-24 right-4 md:right-8 w-72 h-44 sm:w-80 sm:h-48 md:w-96 md:h-56 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-black flex flex-col glow-accent-sm z-40'
          // When visible and not expanded: floating video preview dock
          : 'fixed bottom-20 md:bottom-24 right-4 w-52 h-32 md:w-60 md:h-36 rounded-2xl border border-[var(--border-color)] bg-black/95 shadow-xl overflow-hidden group z-40'
      )}
    >
      {/* Header bar when visible and expanded */}
      {isVisible && isExpanded && (
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
            {/* Collapse back to floating preview dock */}
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Minimize to preview dock"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {/* Close / Hide video */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Hide video preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating mini-dock overlay controls on hover when visible and not expanded */}
      {isVisible && !isExpanded && (
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded-md bg-black/75 backdrop-blur-md text-white/80 hover:text-white transition-colors"
            title="Expand video window"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsVideoOpen(false)}
            className="p-1 rounded-md bg-black/75 backdrop-blur-md text-white/80 hover:text-white transition-colors"
            title="Hide video preview"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Actual YouTube Iframe Anchor: permanently mounted in the DOM */}
      <div ref={boxRef} className="w-full h-full flex-1 relative bg-black min-h-0 overflow-hidden">
        <div
          style={{
            width: render.w,
            height: render.h,
            transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
            transformOrigin: 'top left'
          }}
        >
          <div id="youtube-player-iframe" className="w-full h-full" />
        </div>
      </div>

      {/* Docked bottom audio status badge when visible and not expanded */}
      {isVisible && !isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          className="absolute bottom-0 inset-x-0 px-2.5 py-1 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex items-center justify-between cursor-pointer group-hover:from-black transition-colors"
        >
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isPlaying ? 'bg-[var(--accent)] animate-ping' : 'bg-zinc-500'
              )}
            />
            <p className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
              {isPlaying ? 'Live Audio Stream' : 'Stream Paused'}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="text-[9px] font-semibold text-[var(--accent)] hover:underline ml-2 shrink-0 cursor-pointer"
          >
            Expand
          </button>
        </div>
      )}
    </div>
  );
};
