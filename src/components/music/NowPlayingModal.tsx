import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { usePlaylists } from '../../context/PlaylistContext';
import { formatTime, cn } from '../../lib/utils';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  ListMusic,
  FileText,
  Sliders,
  Tv,
  Image as ImageIcon,
  Loader2,
  FolderPlus
} from 'lucide-react';
import { LyricsPanel } from './LyricsPanel';
import { QualityMenu } from './QualityMenu';
import { MiniVisualizer } from './MiniVisualizer';
import { SongRow } from './SongRow';
import { ArtistLinks } from './ArtistLinks';

interface NowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
}

interface TouchSample {
  y: number;
  t: number;
}

const DRAG_SLOP_PX = 6;
const DISMISS_SCREEN_RATIO = 0.25;
const DISMISS_VELOCITY_PX_MS = 0.5;
const SNAP_BACK_MS = 250;
const CLOSE_ANIM_MS = 240;

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({ isOpen, onClose, onShare }) => {
  const {
    currentSong,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    togglePlay,
    seekTo,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    nextTrack,
    previousTrack,
    isVideoOpen,
    toggleVideo,
    setVideoSlotElement,
    setIsVideoMotionActive
  } = usePlayer();

  const { queue, toggleLike, isLiked } = useQueue();
  const { setAddToPlaylistTarget } = usePlaylists();
  const [activeTab, setActiveTab] = useState<'track' | 'lyrics' | 'queue'>('track');
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const albumArtRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gestureRef = useRef<{
    eligible: boolean;
    active: boolean;
    fromScrollContainer: boolean;
    startX: number;
    startY: number;
    startTime: number;
    baseOffsetY: number;
    currentDragY: number;
    samples: TouchSample[];
  }>({
    eligible: false,
    active: false,
    fromScrollContainer: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    baseOffsetY: 0,
    currentDragY: 0,
    samples: []
  });

  const isTrackTabVisible = isOpen && Boolean(currentSong) && activeTab === 'track';

  useEffect(() => {
    if (isTrackTabVisible && albumArtRef.current) {
      setVideoSlotElement(albumArtRef.current);
      return () => setVideoSlotElement(null);
    }
    setVideoSlotElement(null);
    return undefined;
  }, [isTrackTabVisible, setVideoSlotElement]);

  const clearAnimTimer = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  // Reset transform & backdrop opacity cleanly whenever the modal opens or closes
  useEffect(() => {
    clearAnimTimer();
    gestureRef.current.eligible = false;
    gestureRef.current.active = false;
    gestureRef.current.currentDragY = 0;
    setIsVideoMotionActive(false);

    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = '';
      backdropRef.current.style.opacity = '';
    }

    return () => {
      clearAnimTimer();
      setIsVideoMotionActive(false);
    };
  }, [isOpen, clearAnimTimer, setIsVideoMotionActive]);

  const applyDragVisuals = useCallback((dragY: number) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    const viewportH = Math.max(window.innerHeight || 800, 1);
    const clampedY = Math.max(0, dragY);
    const progress = Math.min(1, clampedY / viewportH);
    const scale = 1 - progress * 0.05; // Scales down smoothly to 0.95 at full drag

    if (sheet) {
      sheet.style.transition = 'none';
      sheet.style.transform = `translate3d(0, ${clampedY}px, 0) scale(${scale})`;
    }
    if (backdrop) {
      backdrop.style.transition = 'none';
      backdrop.style.opacity = String(Math.max(0.15, 1 - progress * 0.85));
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Never start swipe-down on interactive controls (seek bar, volume slider, buttons, links)
      if (target.closest('button, a, input, select, textarea, [role="slider"], [data-no-drag]')) {
        gestureRef.current.eligible = false;
        return;
      }

      const dragHandle = target.closest('[data-drag-handle]');
      const scrollContainer = target.closest('[data-scroll-container="true"]') as HTMLElement | null;

      let canStart = false;
      let fromScrollContainer = false;

      if (dragHandle) {
        canStart = true;
      } else if (scrollContainer) {
        // On Lyrics or Queue scrollable lists, only allow swipe-down when scrolled to the very top
        if (scrollContainer.scrollTop <= 0) {
          canStart = true;
          fromScrollContainer = true;
        }
      }

      if (!canStart) {
        gestureRef.current.eligible = false;
        return;
      }

      // If user interrupts a snap-back animation, preserve current Y offset smoothly
      let baseOffsetY = 0;
      if (animTimerRef.current && sheetRef.current) {
        clearAnimTimer();
        const computed = window.getComputedStyle(sheetRef.current).transform;
        if (computed && computed !== 'none') {
          const match = computed.match(/matrix\(([^)]+)\)/);
          if (match) {
            const parts = match[1].split(',').map((v) => parseFloat(v.trim()));
            if (parts.length >= 6 && Number.isFinite(parts[5])) {
              baseOffsetY = Math.max(0, parts[5]);
            }
          }
        }
        sheetRef.current.style.transition = 'none';
        if (backdropRef.current) backdropRef.current.style.transition = 'none';
      }

      const touch = e.touches[0];
      const now = performance.now();
      gestureRef.current = {
        eligible: true,
        active: baseOffsetY > 0,
        fromScrollContainer,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now,
        baseOffsetY,
        currentDragY: baseOffsetY,
        samples: [{ y: touch.clientY, t: now }]
      };
    },
    [clearAnimTimer]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g.eligible || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;

      if (!g.active) {
        // If user is swiping UP (to scroll down a list or dismiss nothing), release gesture immediately
        if (dy < -DRAG_SLOP_PX) {
          g.eligible = false;
          return;
        }

        // Wait for minimal vertical drag slop before locking the gesture
        if (Math.abs(dy) < DRAG_SLOP_PX) {
          return;
        }

        // Reject horizontal swipes
        if (Math.abs(dx) > Math.abs(dy)) {
          g.eligible = false;
          return;
        }

        if (dy > 0) {
          g.active = true;
          g.startY = touch.clientY;
          setIsVideoMotionActive(true);
        } else {
          g.eligible = false;
          return;
        }
      }

      const rawDragY = g.baseOffsetY + (touch.clientY - g.startY);
      const clampedY = Math.max(0, rawDragY);
      g.currentDragY = clampedY;

      const now = performance.now();
      g.samples.push({ y: touch.clientY, t: now });
      if (g.samples.length > 6) {
        g.samples.shift();
      }

      applyDragVisuals(clampedY);
    },
    [applyDragVisuals, setIsVideoMotionActive]
  );

  const finishDrag = useCallback(() => {
    const g = gestureRef.current;
    const wasActive = g.active;
    g.eligible = false;
    g.active = false;

    if (!wasActive) return;

    const now = performance.now();
    const recent = g.samples.filter((s) => now - s.t <= 100);
    const refSample = recent[0] ?? g.samples[0] ?? { y: g.startY, t: g.startTime };
    const latestSample = g.samples[g.samples.length - 1] ?? refSample;
    const dt = Math.max(1, latestSample.t - refSample.t);
    const velocity = (latestSample.y - refSample.y) / dt; // px/ms

    const viewportH = Math.max(window.innerHeight || 800, 1);
    const shouldClose =
      g.currentDragY > viewportH * DISMISS_SCREEN_RATIO ||
      (g.currentDragY > 12 && velocity > DISMISS_VELOCITY_PX_MS);

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (shouldClose) {
      if (sheet) {
        sheet.style.transition = `transform ${CLOSE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        sheet.style.transform = `translate3d(0, ${viewportH}px, 0) scale(0.95)`;
      }
      if (backdrop) {
        backdrop.style.transition = `opacity ${CLOSE_ANIM_MS}ms ease-out`;
        backdrop.style.opacity = '0';
      }
      animTimerRef.current = setTimeout(() => {
        animTimerRef.current = null;
        setIsVideoMotionActive(false);
        onClose();
      }, CLOSE_ANIM_MS);
    } else {
      if (sheet) {
        sheet.style.transition = `transform ${SNAP_BACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        sheet.style.transform = 'translate3d(0, 0, 0) scale(1)';
      }
      if (backdrop) {
        backdrop.style.transition = `opacity ${SNAP_BACK_MS}ms ease-out`;
        backdrop.style.opacity = '1';
      }
      animTimerRef.current = setTimeout(() => {
        animTimerRef.current = null;
        if (sheetRef.current) {
          sheetRef.current.style.transition = '';
          sheetRef.current.style.transform = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
          backdropRef.current.style.opacity = '';
        }
        setIsVideoMotionActive(false);
      }, SNAP_BACK_MS);
    }
  }, [onClose, setIsVideoMotionActive]);

  if (!isOpen || !currentSong) return null;

  const liked = isLiked(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isDirectAudio = Boolean(currentSong.source === 'audio' || currentSong.audioUrl);
  const showEmbeddedVideo = isVideoOpen && !isDirectAudio;

  return (
    <div
      className="fixed inset-0 z-[42] text-[var(--text-primary)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishDrag}
      onTouchCancel={finishDrag}
    >
      {/* Independent Backdrop Layer (fades smoothly during swipe-down) */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-[var(--bg)]/98 backdrop-blur-2xl will-change-[opacity]"
      />

      {/* Sliding / Scaling Player Sheet */}
      <div
        ref={sheetRef}
        className="relative flex flex-col w-full h-[100dvh] max-h-[100dvh] will-change-transform origin-center"
      >
        {/* Top Header Bar (Drag Handle) */}
        <div
          data-drag-handle="header"
          style={{ touchAction: 'none' }}
          className="flex flex-col border-b border-[var(--border-color)] shrink-0 select-none"
        >
          {/* Subtle drag indicator pill on mobile */}
          <div className="flex justify-center pt-2 pb-0.5 md:hidden pointer-events-none">
            <span className="w-9 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between px-6 py-3 md:py-4">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Minimize player"
            >
              <ChevronDown className="w-6 h-6" />
            </button>

            {/* Tab switch */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
              <button
                onClick={() => setActiveTab('track')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeTab === 'track'
                    ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                Track
              </button>
              <button
                onClick={() => setActiveTab('lyrics')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                  activeTab === 'lyrics'
                    ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Lyrics</span>
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                  activeTab === 'queue'
                    ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Queue ({queue.length})</span>
              </button>
            </div>

            {/* Share Button */}
            <button
              onClick={onShare}
              className="p-2 -mr-2 rounded-full hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Share song"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Tab Content */}
        <div
          className={cn(
            'flex-1 min-h-0 px-4 py-3 md:p-8 flex flex-col max-w-4xl mx-auto w-full',
            activeTab === 'track' ? 'overflow-y-auto' : 'overflow-hidden justify-center'
          )}
        >
          {activeTab === 'track' && (
            <div className="my-auto flex flex-col items-center justify-center max-w-md mx-auto w-full">
              {/* Top Area + Big Artwork / Embedded Video Container (Drag Handle) */}
              <div
                data-drag-handle="top-area"
                style={{ touchAction: 'none' }}
                className="w-full flex justify-center mb-4 sm:mb-7 shrink-0"
              >
                <div
                  ref={albumArtRef}
                  data-drag-handle="album-art"
                  style={{ touchAction: 'none' }}
                  className="relative w-[min(16rem,34dvh,72vw)] sm:w-[min(20rem,38dvh,72vw)] aspect-square rounded-3xl overflow-hidden shadow-2xl bg-[var(--surface-secondary)] border border-[var(--border-color)] group"
                >
                  <img
                    src={currentSong.thumbnail}
                    alt={currentSong.title}
                    draggable={false}
                    className={cn(
                      'w-full h-full object-cover transition-opacity duration-200',
                      showEmbeddedVideo && 'opacity-0'
                    )}
                  />
                  {!showEmbeddedVideo && (
                    <>
                      <button
                        onClick={toggleVideo}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all bg-black/70 text-white hover:bg-[var(--accent)] hover:text-black cursor-pointer"
                        title="Switch to video view"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>Video View</span>
                      </button>
                      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md pointer-events-none">
                        <MiniVisualizer isPlaying={isPlaying} barCount={5} />
                      </div>
                    </>
                  )}
                  {isDirectAudio && isVideoOpen && (
                    <button
                      onClick={toggleVideo}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all bg-[var(--accent)] text-black cursor-pointer"
                      title="Switch to photo view"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Photo View</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Song Meta, Video Toggle, Add to Playlist & Like */}
              <div className="flex items-center justify-between w-full mb-3 sm:mb-5 gap-2">
                <div className="min-w-0 flex-1 pr-1">
                  <h2 className="text-lg sm:text-2xl font-bold truncate tracking-tight text-[var(--text-primary)]">
                    {currentSong.title}
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] truncate mt-0.5">
                    <ArtistLinks artist={currentSong.artist} className="text-sm sm:text-base text-[var(--text-secondary)] truncate block" />
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={toggleVideo}
                    aria-pressed={isVideoOpen}
                    aria-label={isVideoOpen ? 'Switch to photo view' : 'Switch to video view'}
                    title={isVideoOpen ? 'Switch to photo view' : 'Switch to video view'}
                    className={cn(
                      'min-w-[44px] min-h-[44px] px-3 py-2 rounded-full border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
                      isVideoOpen
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-sm'
                        : 'bg-transparent text-[var(--accent)] border-[var(--accent)]/60 hover:bg-[var(--accent)]/15'
                    )}
                  >
                    <Tv className="w-4 h-4 shrink-0" />
                    <span>Video</span>
                  </button>
                  <button
                    onClick={() => setAddToPlaylistTarget(currentSong)}
                    title="Add to playlist"
                    aria-label="Add to playlist"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => toggleLike(currentSong)}
                    aria-label={liked ? 'Remove from liked songs' : 'Like song'}
                    className={cn(
                      'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer',
                      liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Heart className={cn('w-6 h-6', liked && 'fill-current')} />
                  </button>
                </div>
              </div>

              {/* Seek Bar */}
              <div className="w-full space-y-1.5 mb-3 sm:mb-5">
                <div className="relative flex items-center group cursor-pointer py-2">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[var(--surface-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    style={{
                      background: `linear-gradient(to right, var(--accent) ${progressPercent}%, var(--surface-elevated) ${progressPercent}%)`
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-[var(--text-muted)]">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between w-full mb-3 sm:mb-5">
                {/* Shuffle */}
                <button
                  onClick={toggleShuffle}
                  className={cn(
                    'p-2.5 rounded-full hover:bg-[var(--surface-elevated)] transition-colors',
                    isShuffled ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  )}
                  title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                {/* Prev */}
                <button
                  onClick={previousTrack}
                  className="p-3 rounded-full text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
                  title="Previous track"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                {/* Play / Pause with Accent Glow */}
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all glow-accent"
                  title={isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
                  aria-label={isLoading ? 'Loading song' : isPlaying ? 'Pause song' : 'Play song'}
                >
                  {isLoading ? (
                    <Loader2 className="w-7 h-7 animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-1" />
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={nextTrack}
                  className="p-3 rounded-full text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
                  title="Next track"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>

                {/* Repeat */}
                <button
                  onClick={cycleRepeatMode}
                  className={cn(
                    'p-2.5 rounded-full hover:bg-[var(--surface-elevated)] transition-colors',
                    repeatMode !== 'off' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  )}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>
              </div>

              {/* Volume & Quality Bottom Bar */}
              <div className="flex items-center justify-between w-full pt-3 sm:pt-4 border-t border-[var(--border-color)]">
                {/* Volume Slider */}
                <div className="flex items-center gap-2 max-w-[160px] w-full">
                  <button
                    onClick={toggleMute}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-[var(--surface-elevated)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                </div>

                {/* Quality Menu Opener */}
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Quality</span>
                  </button>

                  {showQualityMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowQualityMenu(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 z-50">
                        <QualityMenu onClose={() => setShowQualityMenu(false)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="h-full max-w-2xl mx-auto w-full">
              <LyricsPanel currentSong={currentSong} />
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
              <div
                data-drag-handle="queue-header"
                style={{ touchAction: 'none' }}
                className="pb-3 border-b border-[var(--border-color)] mb-4"
              >
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  // UP NEXT ({queue.length} TRACKS)
                </span>
              </div>
              <div
                data-scroll-container="true"
                className="flex-1 overflow-y-auto overscroll-y-contain space-y-1 pr-1"
              >
                {queue.length === 0 ? (
                  <div className="py-16 text-center text-[var(--text-muted)]">
                    <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Your queue is empty</p>
                    <p className="text-xs mt-1">Search songs or explore mood playlists to add tracks</p>
                  </div>
                ) : (
                  queue.map((song, idx) => (
                    <SongRow key={`${song.id}-${idx}`} song={song} index={idx} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
