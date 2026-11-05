import { useState, useEffect, useRef, useCallback } from 'react';
import { Song, LyricsData } from '../types/music';
import { fetchLyricsWithStatus } from '../services/musicApi';

export type LyricsState = 'loading' | 'success' | 'notFound' | 'networkError';

export function useLyrics(currentSong: Song | null, currentTime: number) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lyricsState, setLyricsState] = useState<LyricsState>('loading');
  const activeSongId = useRef<string | null>(null);
  const currentControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingRetries = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const executeFetch = useCallback((song: Song, resetRetries: boolean) => {
    // 6. Use an AbortController to cancel the old request when user skips songs
    if (currentControllerRef.current) {
      currentControllerRef.current.abort();
      currentControllerRef.current = null;
    }
    clearPendingRetries();

    if (resetRetries) {
      retryCountRef.current = 0;
    }

    const controller = new AbortController();
    currentControllerRef.current = controller;
    activeSongId.current = song.id;

    // Return to loading state immediately
    setLyricsState('loading');
    if (resetRetries) {
      setLyrics(null);
    }

    const attemptFetch = async () => {
      try {
        const result = await fetchLyricsWithStatus(song, controller.signal);
        if (controller.signal.aborted || activeSongId.current !== song.id) {
          return;
        }

        if (result.status === 'success' && result.data) {
          setLyrics(result.data);
          setLyricsState('success');
        } else if (result.status === 'notFound') {
          setLyrics(null);
          setLyricsState('notFound');
        } else {
          // Network error!
          // 3. Auto-retry up to 2 times (after 2 seconds, then 4 seconds) before showing Retry button
          if (retryCountRef.current === 0) {
            retryCountRef.current = 1;
            retryTimerRef.current = setTimeout(() => {
              if (!controller.signal.aborted && activeSongId.current === song.id) {
                attemptFetch();
              }
            }, 2000);
          } else if (retryCountRef.current === 1) {
            retryCountRef.current = 2;
            retryTimerRef.current = setTimeout(() => {
              if (!controller.signal.aborted && activeSongId.current === song.id) {
                attemptFetch();
              }
            }, 4000);
          } else {
            // Auto-retries exhausted: show Retry button
            setLyrics(null);
            setLyricsState('networkError');
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted || activeSongId.current !== song.id) {
          return;
        }
        // Thrown error treated as network error
        if (retryCountRef.current === 0) {
          retryCountRef.current = 1;
          retryTimerRef.current = setTimeout(() => {
            if (!controller.signal.aborted && activeSongId.current === song.id) {
              attemptFetch();
            }
          }, 2000);
        } else if (retryCountRef.current === 1) {
          retryCountRef.current = 2;
          retryTimerRef.current = setTimeout(() => {
            if (!controller.signal.aborted && activeSongId.current === song.id) {
              attemptFetch();
            }
          }, 4000);
        } else {
          setLyrics(null);
          setLyricsState('networkError');
        }
      }
    };

    attemptFetch();
  }, []);

  // When song changes
  useEffect(() => {
    if (!currentSong) {
      setLyrics(null);
      setLyricsState('notFound');
      if (currentControllerRef.current) {
        currentControllerRef.current.abort();
        currentControllerRef.current = null;
      }
      clearPendingRetries();
      return;
    }

    executeFetch(currentSong, true);

    return () => {
      if (currentControllerRef.current) {
        currentControllerRef.current.abort();
        currentControllerRef.current = null;
      }
      clearPendingRetries();
    };
  }, [currentSong?.id, executeFetch]);

  // 2. The Retry button reruns the same lyrics fetch for current song and returns to loading state
  const retryLyrics = useCallback(() => {
    if (currentSong) {
      executeFetch(currentSong, true);
    }
  }, [currentSong, executeFetch]);

  // 4. When window online event fires and lyrics are in networkError state, retry automatically
  useEffect(() => {
    const handleOnline = () => {
      if (lyricsState === 'networkError' && currentSong) {
        executeFetch(currentSong, true);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [lyricsState, currentSong, executeFetch]);

  // Calculate current active line index for synced lyrics
  let activeLineIndex = -1;
  if (lyrics?.syncedLyrics && lyrics.syncedLyrics.length > 0) {
    for (let i = 0; i < lyrics.syncedLyrics.length; i++) {
      if (currentTime >= lyrics.syncedLyrics[i].time - 0.2) {
        activeLineIndex = i;
      } else {
        break;
      }
    }
  }

  return {
    lyrics,
    lyricsState,
    isLoading: lyricsState === 'loading',
    error: lyricsState === 'networkError' ? "Couldn't load lyrics. Check your connection." : null,
    retryLyrics,
    activeLineIndex
  };
}
