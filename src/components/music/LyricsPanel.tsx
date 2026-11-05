import React, { useEffect, useRef } from 'react';
import { Song } from '../../types/music';
import { useLyrics } from '../../hooks/useLyrics';
import { usePlayer } from '../../context/PlayerContext';
import { cn } from '../../lib/utils';
import { Music2, Loader2, Sparkles, WifiOff, RotateCcw } from 'lucide-react';

interface LyricsPanelProps {
  currentSong: Song | null;
  className?: string;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ currentSong, className }) => {
  const { currentTime, seekTo } = usePlayer();
  const { lyrics, lyricsState, retryLyrics, activeLineIndex } = useLyrics(currentSong, currentTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  // Auto-scroll active lyric line to center of lyrics panel
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const targetScroll = activeEl.offsetTop - containerHeight / 2 + activeEl.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeLineIndex]);

  if (!currentSong) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center p-6 text-[var(--text-muted)]', className)}>
        <Music2 className="w-10 h-10 mb-3 opacity-30 stroke-[1.5]" />
        <p className="text-sm font-medium">Play a song to view lyrics</p>
      </div>
    );
  }

  // State 1: loading
  if (lyricsState === 'loading') {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center p-6', className)}>
        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin mb-3" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Loading lyrics...</p>
      </div>
    );
  }

  // State 4: networkError
  if (lyricsState === 'networkError') {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center p-6', className)}>
        <WifiOff className="w-10 h-10 mb-3 text-amber-400 stroke-[1.5]" />
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Couldn't load lyrics. Check your connection.
        </p>
        <button
          onClick={retryLyrics}
          className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[var(--accent)] text-black font-semibold text-xs flex items-center gap-2 hover:bg-[var(--accent-hover)] active:scale-95 transition-all shadow-md cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // State 3: notFound
  if (lyricsState === 'notFound' || !lyrics || lyrics.notFound) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center p-6 text-[var(--text-muted)]', className)}>
        <Music2 className="w-10 h-10 mb-3 opacity-30 stroke-[1.5]" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Lyrics not available for this song</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden select-none', className)}>
      {/* Header bar / Attribution */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            {lyrics.syncedLyrics ? '// SYNCHRONIZED LYRICS' : '// PLAIN LYRICS'}
          </span>
        </div>
        {lyrics.attribution && (
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {lyrics.attribution}
          </span>
        )}
      </div>

      {/* Lyrics Scrollable Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 py-8 px-2 scroll-smooth text-center"
      >
        {lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0 ? (
          lyrics.syncedLyrics.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            const isPast = idx < activeLineIndex;

            return (
              <p
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => seekTo(line.time)}
                className={cn(
                  'cursor-pointer transition-all duration-300 py-1.5 px-3 rounded-xl leading-relaxed text-balance',
                  isActive
                    ? 'text-lg md:text-xl font-bold text-[var(--accent)] scale-105 shadow-sm'
                    : isPast
                    ? 'text-sm md:text-base font-medium text-[var(--text-secondary)] opacity-60 hover:opacity-100 hover:text-[var(--text-primary)]'
                    : 'text-sm md:text-base font-medium text-[var(--text-muted)] hover:opacity-100 hover:text-[var(--text-primary)]'
                )}
              >
                {line.text || '♪'}
              </p>
            );
          })
        ) : lyrics.plainLyrics ? (
          <div className="text-left max-w-lg mx-auto whitespace-pre-line text-sm md:text-base leading-relaxed text-[var(--text-secondary)] font-normal">
            {lyrics.plainLyrics}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No lyrics available</p>
        )}

        {(lyrics.provider === 'netease' || lyrics.provider === 'lyrics.ovh') && (
          <p className="pt-4 text-[11px] font-mono text-[var(--text-muted)] text-center">
            Source: {lyrics.provider === 'netease' ? 'Netease' : 'lyrics.ovh'}
          </p>
        )}
      </div>
    </div>
  );
};
