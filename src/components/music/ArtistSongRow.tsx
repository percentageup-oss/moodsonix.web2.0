import React, { useState, useRef, useEffect } from 'react';
import { ItunesSong } from '../../types/artist';
import { Song } from '../../types/music';
import { upscaleArtwork, itunesSongToMoodsonixSong } from '../../services/itunesApi';
import { searchMusic } from '../../services/musicApi';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { formatTime, cn } from '../../lib/utils';
import { Play, Pause, Heart, ListPlus, Share2, MoreVertical, Disc, Loader2 } from 'lucide-react';
import { MiniVisualizer } from './MiniVisualizer';

interface ArtistSongRowProps {
  song: ItunesSong;
  index?: number;
  showIndexNumber?: boolean;
  onShare?: (song: Song) => void;
}

export const ArtistSongRow: React.FC<ArtistSongRowProps> = ({
  song,
  index,
  showIndexNumber = false,
  onShare
}) => {
  const { currentSong, isPlaying, isLoading, playSong, togglePlay } = usePlayer();
  const { addToQueue, playNext, toggleLike, isLiked } = useQueue();

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Convert to generic Moodsonix Song structure for Queue and Likes
  const moodsonixSong = itunesSongToMoodsonixSong(song);

  // Check if current playing song matches either the itunes id or title + artist
  const isCurrent =
    currentSong?.id === moodsonixSong.id ||
    (currentSong?.title?.toLowerCase() === song.trackName.toLowerCase() &&
      currentSong?.artist?.toLowerCase().includes(song.artistName.toLowerCase()));

  const isSongPlaying = isCurrent && isPlaying;
  const liked = isLiked(moodsonixSong.id) || (currentSong && isCurrent ? isLiked(currentSong.id) : false);

  // Tap handler: immediately play song so isLoading is set before any fetch or player call
  const handlePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (isCurrent) {
      togglePlay();
      return;
    }

    playSong(moodsonixSong);
  };

  // Long-press handling for mobile (500ms hold)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      // Trigger long-press context menu
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowMenu(true);
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (diffX > 10 || diffY > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const artworkSrc = upscaleArtwork(song.artworkUrl100) || song.artworkUrl100;
  const durationSec = song.trackTimeMillis ? Math.round(song.trackTimeMillis / 1000) : 180;

  return (
    <div
      onClick={handlePlay}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      className={cn(
        'group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent select-none',
        isCurrent
          ? 'bg-[var(--surface-elevated)] border-[var(--border-color)] text-[var(--accent)] shadow-sm'
          : 'hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]'
      )}
    >
      {/* Left: Index / Number & Artwork */}
      <div className="flex items-center gap-3 min-w-0">
        {showIndexNumber && typeof index === 'number' && (
          <div className="w-5 text-center text-xs font-mono font-bold text-[var(--text-muted)] group-hover:hidden">
            {isCurrent ? (
              isLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin mx-auto" />
              ) : (
                <MiniVisualizer isPlaying={isPlaying} />
              )
            ) : (
              index + 1
            )}
          </div>
        )}

        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[var(--surface)] border border-[var(--border-color)]">
          {artworkSrc ? (
            <img
              src={artworkSrc}
              alt={song.trackName}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-xs text-[var(--accent)]">
              {song.trackName.charAt(0)}
            </div>
          )}

          <div
            className={cn(
              'absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity',
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {isCurrent && isLoading ? (
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
            ) : isSongPlaying ? (
              <Pause className="w-5 h-5 text-[var(--accent)] fill-[var(--accent)]" />
            ) : (
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Title and Album */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium text-sm truncate',
              isCurrent ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'
            )}
          >
            {song.trackName}
          </p>
          <p className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1.5 mt-0.5">
            <span>{song.artistName}</span>
            {song.collectionName && (
              <>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="text-[var(--text-muted)] truncate">{song.collectionName}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right Controls: Duration, Like, Menu */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Like Button */}
        <button
          onClick={() => toggleLike(moodsonixSong)}
          title={liked ? 'Unlike' : 'Like'}
          className={cn(
            'p-2 rounded-lg transition-colors hover:bg-[var(--surface-elevated)]',
            liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
        </button>

        {/* Duration */}
        <span className="text-xs font-mono text-[var(--text-muted)] w-11 text-right hidden sm:inline-block">
          {formatTime(durationSec)}
        </span>

        {/* 3-Dots Button */}
        <div className="relative">
          <button
            onClick={() => {
              setMenuPosition(null);
              setShowMenu(!showMenu);
            }}
            title="Options"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Context / Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div
                className={cn(
                  'rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md w-48',
                  menuPosition ? 'fixed' : 'absolute right-0 top-full mt-1'
                )}
                style={
                  menuPosition
                    ? {
                        top: Math.min(window.innerHeight - 180, menuPosition.y),
                        left: Math.min(window.innerWidth - 200, Math.max(10, menuPosition.x - 100))
                      }
                    : undefined
                }
              >
                <div className="px-3 py-1.5 border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)] font-mono truncate">
                  {song.trackName}
                </div>

                <button
                  onClick={() => {
                    addToQueue(moodsonixSong);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <ListPlus className="w-4 h-4 text-[var(--accent)]" />
                  <span>Add to Queue</span>
                </button>

                <button
                  onClick={() => {
                    playNext(moodsonixSong);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <Disc className="w-4 h-4 text-[var(--accent)]" />
                  <span>Play Next</span>
                </button>

                <button
                  onClick={() => {
                    toggleLike(moodsonixSong);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <Heart className={cn('w-4 h-4', liked ? 'text-red-500 fill-current' : 'text-[var(--text-secondary)]')} />
                  <span>{liked ? 'Remove from Liked' : 'Like Track'}</span>
                </button>

                {onShare && (
                  <button
                    onClick={() => {
                      onShare(moodsonixSong);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span>Share Song</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
