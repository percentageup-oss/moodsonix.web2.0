import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { cn } from '../../lib/utils';
import { getRenderSize } from '../../lib/streamQuality';
import {
  Image as ImageIcon,
  Maximize2,
  X,
  Radio,
  ChevronDown
} from 'lucide-react';
import { MiniVisualizer } from './MiniVisualizer';

interface SlotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const VideoPlayerDock: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    isVideoOpen,
    setIsVideoOpen,
    toggleVideo,
    isNowPlayingOpen,
    setIsNowPlayingOpen,
    effectiveQuality,
    videoSlotElement,
    isVideoMotionActive
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [slotRect, setSlotRect] = useState<SlotRect | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const isDirectAudio = Boolean(currentSong && (currentSong.source === 'audio' || currentSong.audioUrl));
  const isEmbeddedInAlbumArt = Boolean(
    currentSong && isVideoOpen && isNowPlayingOpen && videoSlotElement && !isDirectAudio
  );
  // Only show the floating mini popup when the full-screen player is closed and video mode is on
  const isFloatingPopup = Boolean(
    currentSong && isVideoOpen && !isNowPlayingOpen && !isDirectAudio
  );

  // Measure the album art slot synchronously so the single persistent YouTube iframe overlays it seamlessly
  useLayoutEffect(() => {
    if (!isEmbeddedInAlbumArt || !videoSlotElement) {
      setSlotRect(null);
      return;
    }

    const updateRect = () => {
      if (isVideoMotionActive) return;
      const r = videoSlotElement.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSlotRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height
        });
      }
    };

    updateRect();

    const ro = new ResizeObserver(updateRect);
    ro.observe(videoSlotElement);
    ro.observe(document.documentElement);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isEmbeddedInAlbumArt, videoSlotElement, isVideoMotionActive]);

  // Follow the album art slot at 60fps via transform during swipe-down drag and snap/close animations
  useEffect(() => {
    const dockEl = dockRef.current;
    if (!dockEl) return;

    if (!isEmbeddedInAlbumArt || !isVideoMotionActive || !videoSlotElement || !slotRect) {
      dockEl.style.transform = '';
      dockEl.style.transformOrigin = '';
      return;
    }

    let rafId = 0;
    const syncFrame = () => {
      const r = videoSlotElement.getBoundingClientRect();
      const dx = r.left - slotRect.left;
      const dy = r.top - slotRect.top;
      const sx = slotRect.width > 0 ? r.width / slotRect.width : 1;
      const sy = slotRect.height > 0 ? r.height / slotRect.height : 1;
      dockEl.style.transformOrigin = 'top left';
      dockEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      rafId = requestAnimationFrame(syncFrame);
    };

    rafId = requestAnimationFrame(syncFrame);
    return () => {
      cancelAnimationFrame(rafId);
      dockEl.style.transform = '';
      dockEl.style.transformOrigin = '';
    };
  }, [isEmbeddedInAlbumArt, isVideoMotionActive, videoSlotElement, slotRect]);

  const isVisible = Boolean((isEmbeddedInAlbumArt && slotRect) || isFloatingPopup);

  // YouTube picks the stream resolution from the size the player is laid out at, so the player is
  // always laid out at the size of the chosen quality and then scaled to fit the container.
  // When embedded inside the square album art, use Math.max (object-fit: cover) so the 16:9 video
  // fills the rounded square without stretching or black letterbox bars.
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
      const scale = isEmbeddedInAlbumArt
        ? Math.max(boxW / render.w, boxH / render.h)
        : Math.min(boxW / render.w, boxH / render.h);
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
  }, [render.w, render.h, isVisible, isExpanded, isEmbeddedInAlbumArt, slotRect]);

  const embeddedStyle: React.CSSProperties | undefined =
    isEmbeddedInAlbumArt && slotRect
      ? {
          top: slotRect.top,
          left: slotRect.left,
          width: slotRect.width,
          height: slotRect.height,
          willChange: isVideoMotionActive ? 'transform' : undefined
        }
      : undefined;

  return (
    <div
      ref={dockRef}
      style={embeddedStyle}
      className={cn(
        'select-none',
        // When not visible: keep completely mounted so YouTube player & audio are never destroyed!
        // Offscreen with 1px dimensions and opacity 0 (NEVER display:none)
        !isVisible
          ? 'fixed -left-[9999px] -top-[9999px] w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden z-[-1]'
          : isEmbeddedInAlbumArt
          ? 'fixed rounded-3xl overflow-hidden shadow-2xl bg-black border border-[var(--border-color)] z-[45] group pointer-events-none'
          // When floating and expanded: larger floating video player
          : isExpanded
          ? 'fixed bottom-24 right-4 md:right-8 w-72 h-44 sm:w-80 sm:h-48 md:w-96 md:h-56 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-black flex flex-col glow-accent-sm z-40'
          // When floating and not expanded: floating video preview dock
          : 'fixed bottom-20 md:bottom-24 right-4 w-52 h-32 md:w-60 md:h-36 rounded-2xl border border-[var(--border-color)] bg-black/95 shadow-xl overflow-hidden group z-40'
      )}
    >
      {/* Header bar when floating and expanded */}
      {isFloatingPopup && isExpanded && (
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

      {/* Floating mini-dock overlay controls on hover when floating and not expanded */}
      {isFloatingPopup && !isExpanded && (
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
      <div
        ref={boxRef}
        className="w-full h-full flex-1 relative bg-black min-h-0 overflow-hidden pointer-events-none"
      >
        <div
          style={{
            width: render.w,
            height: render.h,
            transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
            transformOrigin: 'top left'
          }}
        >
          <div id="youtube-player-iframe" className="w-full h-full pointer-events-none" />
        </div>
      </div>

      {/* Photo View toggle & MiniVisualizer overlay when docked inside the full-screen album art */}
      {isEmbeddedInAlbumArt && slotRect && (
        <>
          <button
            type="button"
            onClick={toggleVideo}
            className="pointer-events-auto absolute top-3 right-3 z-20 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] cursor-pointer"
            title="Switch to photo view"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo View</span>
          </button>
          <div className="absolute bottom-3 right-3 z-20 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md pointer-events-none">
            <MiniVisualizer isPlaying={isPlaying} barCount={5} />
          </div>
        </>
      )}

      {/* Docked bottom audio status badge when floating and not expanded */}
      {isFloatingPopup && !isExpanded && (
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
