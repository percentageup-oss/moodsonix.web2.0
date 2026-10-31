import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Song, PlaybackState, RepeatMode } from '../types/music';
import { useQueue } from './QueueContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PlayerContextType {
  currentSong: Song | null;
  playbackState: PlaybackState;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  quality: string;
  isNowPlayingOpen: boolean;
  setIsNowPlayingOpen: (open: boolean) => void;
  isVideoOpen: boolean;
  setIsVideoOpen: (open: boolean) => void;
  toggleVideo: () => void;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  setQuality: (quality: string) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  playerError: string | null;
  clearPlayerError: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queue, history, consumeNextTrack, addToHistory, getPreviousTrack } = useQueue();

  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const saved = localStorage.getItem('moodsonix_last_song');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });

  const [playbackState, setPlaybackState] = useState<PlaybackState>('unstarted');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('moodsonix_volume');
    return saved ? parseInt(saved, 10) : 80;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [quality, setQualityState] = useState<string>('auto');
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isVideoOpen, setIsVideoOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('moodsonix_video_toggle');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [playerError, setPlayerError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const isPlayerReady = useRef<boolean>(false);
  const pendingSongRef = useRef<Song | null>(null);
  const timeUpdateInterval = useRef<any>(null);

  // Visibility and pending actions refs
  const wasPlayingBeforeHidden = useRef<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Latest value refs for MediaSession action handlers and intervals
  const resumeRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const nextTrackRef = useRef<() => void>(() => {});
  const previousTrackRef = useRef<() => void>(() => {});
  const seekToRef = useRef<(seconds: number) => void>(() => {});
  const currentTimeRef = useRef<number>(currentTime);
  const durationRef = useRef<number>(duration);
  const playbackStateRef = useRef<PlaybackState>(playbackState);
  const currentSongRef = useRef<Song | null>(currentSong);
  const repeatModeRef = useRef<RepeatMode>(repeatMode);

  const isPlaying = playbackState === 'playing';

  const toggleVideo = useCallback(() => {
    setIsVideoOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('moodsonix_video_toggle', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetIsVideoOpen = useCallback((open: boolean) => {
    setIsVideoOpen(open);
    try {
      localStorage.setItem('moodsonix_video_toggle', String(open));
    } catch {}
  }, []);

  // Helper to safely update MediaSession position state
  const syncPositionState = useCallback((pos?: number, dur?: number) => {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
    const position = typeof pos === 'number' ? pos : currentTimeRef.current;
    const totalDuration = typeof dur === 'number' ? dur : durationRef.current;

    if (
      typeof totalDuration === 'number' &&
      !isNaN(totalDuration) &&
      totalDuration > 0 &&
      typeof position === 'number' &&
      !isNaN(position) &&
      position >= 0 &&
      position <= totalDuration
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: totalDuration,
          playbackRate: 1,
          position
        });
      } catch {
        // Ignore any errors from invalid states
      }
    }
  }, []);

  // Save volume preference
  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    localStorage.setItem('moodsonix_volume', clamped.toString());
    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.setVolume(clamped);
        if (clamped > 0 && isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
        }
      } catch {}
    }
  };

  const toggleMute = () => {
    if (!playerRef.current || !isPlayerReady.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
  };

  const setQuality = (q: string) => {
    setQualityState(q);
    if (playerRef.current && isPlayerReady.current) {
      try {
        if (q !== 'auto') {
          playerRef.current.setPlaybackQuality(q);
        }
      } catch {}
    }
  };

  const cycleRepeatMode = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffled(prev => !prev);
  };

  // Seek to position
  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
        currentTimeRef.current = seconds;
        syncPositionState(seconds, durationRef.current);
      } catch {}
    }
  }, [syncPositionState]);

  // Pause playback (always allowed)
  const pause = useCallback(() => {
    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.pauseVideo();
      } catch {}
    }
  }, []);

  // Play a song
  const playSong = useCallback((song: Song) => {
    setCurrentSong(song);
    currentSongRef.current = song;
    setPlayerError(null);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setDuration(song.duration || 0);
    durationRef.current = song.duration || 0;
    localStorage.setItem('moodsonix_last_song', JSON.stringify(song));
    addToHistory(song);

    // Never start playback while document is hidden; store pending action instead
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingActionRef.current = () => {
        if (playerRef.current && isPlayerReady.current) {
          try {
            playerRef.current.loadVideoById({
              videoId: song.id,
              startSeconds: 0
            });
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
            const playPromise = playerRef.current.playVideo();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch((err: any) => {
                console.warn('[Moodsonix] Autoplay blocked:', err);
                setPlaybackState('paused');
              });
            }
          } catch (err) {
            console.error('[Moodsonix] Player loadVideoById error:', err);
            setPlaybackState('paused');
          }
        } else {
          pendingSongRef.current = song;
        }
      };
      return;
    }

    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.loadVideoById({
          videoId: song.id,
          startSeconds: 0
        });
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
        const playPromise = playerRef.current.playVideo();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.warn('[Moodsonix] Autoplay blocked:', err);
            setPlaybackState('paused');
          });
        }
      } catch (err) {
        console.error('[Moodsonix] Player loadVideoById error:', err);
        setPlaybackState('paused');
      }
    } else {
      pendingSongRef.current = song;
    }
  }, [addToHistory, volume]);

  // Resume playback
  const resume = useCallback(() => {
    // If hidden, never call playVideo; store pending action instead
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingActionRef.current = () => resume();
      return;
    }

    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.unMute();
        const playPromise = playerRef.current.playVideo();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.warn('[Moodsonix] Playback blocked by autoplay policy:', err);
            setPlaybackState('paused');
          });
        }
      } catch (err) {
        console.warn('[Moodsonix] Playback error on resume:', err);
        setPlaybackState('paused');
      }
    } else if (currentSongRef.current) {
      playSong(currentSongRef.current);
    }
  }, [playSong]);

  // Next track
  const nextTrack = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingActionRef.current = () => nextTrack();
      return;
    }

    if (queue.length > 0) {
      const nextSong = consumeNextTrack();
      if (nextSong) {
        playSong(nextSong);
      }
    } else if (repeatModeRef.current === 'all' && history.length > 0) {
      const first = history[history.length - 1];
      if (first) playSong(first);
    } else {
      pause();
    }
  }, [queue, history, consumeNextTrack, playSong, pause]);

  // Previous track
  const previousTrack = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingActionRef.current = () => previousTrack();
      return;
    }

    if (currentTimeRef.current > 4) {
      seekTo(0);
    } else {
      const prev = getPreviousTrack();
      if (prev && prev.id !== currentSongRef.current?.id) {
        playSong(prev);
      } else {
        seekTo(0);
      }
    }
  }, [getPreviousTrack, playSong, seekTo]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (playbackStateRef.current === 'playing') {
      pause();
    } else {
      if (currentSongRef.current) {
        resume();
      } else if (queue.length > 0) {
        const next = consumeNextTrack();
        if (next) playSong(next);
      }
    }
  }, [pause, resume, queue, consumeNextTrack, playSong]);

  // Synchronize latest function and state refs
  useEffect(() => {
    resumeRef.current = resume;
    pauseRef.current = pause;
    nextTrackRef.current = nextTrack;
    previousTrackRef.current = previousTrack;
    seekToRef.current = seekTo;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    playbackStateRef.current = playbackState;
    currentSongRef.current = currentSong;
    repeatModeRef.current = repeatMode;
  });

  // Handle YouTube player state changes
  const handleStateChange = useCallback((event: any) => {
    const stateCode = event.data;
    // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
    if (stateCode === 1) {
      setPlaybackState('playing');
      playbackStateRef.current = 'playing';
    } else if (stateCode === 2) {
      setPlaybackState('paused');
      playbackStateRef.current = 'paused';
    } else if (stateCode === 3) {
      setPlaybackState('buffering');
      playbackStateRef.current = 'buffering';
    } else if (stateCode === 5) {
      setPlaybackState('cued');
      playbackStateRef.current = 'cued';
      if (typeof document !== 'undefined' && document.visibilityState !== 'hidden' && playerRef.current) {
        try {
          const p = playerRef.current.playVideo();
          if (p && typeof p.catch === 'function') {
            p.catch(() => setPlaybackState('paused'));
          }
        } catch {}
      }
    } else if (stateCode === 0) {
      setPlaybackState('ended');
      playbackStateRef.current = 'ended';
      if (repeatModeRef.current === 'one' && currentSongRef.current) {
        seekTo(0);
        if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
          resume();
        } else {
          pendingActionRef.current = () => resume();
        }
      } else {
        nextTrack();
      }
    }
  }, [nextTrack, resume, seekTo]);

  // Handle YouTube errors
  const handleError = useCallback((event: any) => {
    const code = event.data;
    let message = 'Playback error occurred';
    if (code === 2) message = 'Invalid video ID parameter';
    if (code === 5) message = 'HTML5 player error';
    if (code === 100) message = 'This video was not found or was removed';
    if (code === 101 || code === 150) message = 'Embedded playback disabled by video owner. Skipping...';

    console.warn(`[Moodsonix] YouTube Player Error (${code}):`, message);
    setPlayerError(message);

    // Auto-advance if track is blocked from embedded playback
    if (code === 101 || code === 150 || code === 100) {
      setTimeout(() => {
        nextTrack();
      }, 2500);
    }
  }, [nextTrack]);

  // Initialize YouTube IFrame Player
  useEffect(() => {
    let initialized = false;

    const initPlayer = () => {
      if (initialized || playerRef.current || !window.YT || !window.YT.Player) return;

      const hostEl = document.getElementById('youtube-player-iframe');
      if (!hostEl) return;

      initialized = true;
      try {
        playerRef.current = new window.YT.Player('youtube-player-iframe', {
          height: '100%',
          width: '100%',
          videoId: currentSong?.id || '',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              isPlayerReady.current = true;
              try {
                event.target.setVolume(volume);
                event.target.unMute();
              } catch {}
              console.log('[Moodsonix] YouTube IFrame Player ready.');
              if (pendingSongRef.current) {
                const pending = pendingSongRef.current;
                pendingSongRef.current = null;
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                  pendingActionRef.current = () => playSong(pending);
                } else {
                  playSong(pending);
                }
              }
            },
            onStateChange: handleStateChange,
            onError: handleError
          }
        });
      } catch (err) {
        console.error('[Moodsonix] YouTube Player initialization failed:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      // Clean up player on unmount
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
        isPlayerReady.current = false;
      }
    };
  }, [handleStateChange, handleError, playSong, volume, currentSong?.id]);

  // Synchronize playback time and call setPositionState about once per second while playing
  useEffect(() => {
    let lastPositionUpdate = 0;

    if (isPlaying) {
      timeUpdateInterval.current = setInterval(() => {
        if (playerRef.current && isPlayerReady.current) {
          try {
            const time = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            setCurrentTime(time);
            currentTimeRef.current = time;

            if (dur > 0 && dur !== durationRef.current) {
              setDuration(dur);
              durationRef.current = dur;
            }

            const now = Date.now();
            if (now - lastPositionUpdate >= 1000) {
              lastPositionUpdate = now;
              syncPositionState(time, dur > 0 ? dur : durationRef.current);
            }
          } catch {}
        }
      }, 250);
    } else {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    };
  }, [isPlaying, syncPositionState]);

  // Page visibility listener: pause when hidden, resume/run pending action when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const isCurrentlyPlaying = playbackStateRef.current === 'playing';
        wasPlayingBeforeHidden.current = isCurrentlyPlaying;
        if (isCurrentlyPlaying) {
          pauseRef.current();
        }
      } else if (document.visibilityState === 'visible') {
        if (pendingActionRef.current) {
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          wasPlayingBeforeHidden.current = false;
          try {
            action();
          } catch (err) {
            console.warn('[Moodsonix] Error running pending visibility action:', err);
            setPlaybackState('paused');
          }
        } else if (wasPlayingBeforeHidden.current) {
          wasPlayingBeforeHidden.current = false;
          try {
            resumeRef.current();
          } catch (err) {
            console.warn('[Moodsonix] Error resuming playback on visible:', err);
            setPlaybackState('paused');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 1. Media Session Action Handlers: Registered ONCE in useEffect with empty dependency array
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionMap: Array<[MediaSessionAction, (details: any) => void]> = [
      [
        'play',
        () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            pendingActionRef.current = () => resumeRef.current();
          } else {
            resumeRef.current();
          }
        }
      ],
      [
        'pause',
        () => {
          pauseRef.current();
        }
      ],
      [
        'stop',
        () => {
          pauseRef.current();
        }
      ],
      [
        'previoustrack',
        () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            pendingActionRef.current = () => previousTrackRef.current();
          } else {
            previousTrackRef.current();
          }
        }
      ],
      [
        'nexttrack',
        () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            pendingActionRef.current = () => nextTrackRef.current();
          } else {
            nextTrackRef.current();
          }
        }
      ],
      [
        'seekbackward',
        (details) => {
          const offset = details?.seekOffset || 10;
          const pos = Math.max(0, currentTimeRef.current - offset);
          seekToRef.current(pos);
        }
      ],
      [
        'seekforward',
        (details) => {
          const offset = details?.seekOffset || 10;
          const dur = durationRef.current || 0;
          const pos = dur > 0 ? Math.min(dur, currentTimeRef.current + offset) : currentTimeRef.current + offset;
          seekToRef.current(pos);
        }
      ],
      [
        'seekto',
        (details) => {
          if (details?.seekTime !== undefined && details?.seekTime !== null) {
            seekToRef.current(details.seekTime);
          }
        }
      ]
    ];

    actionMap.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        console.warn(`[Moodsonix] Action handler for ${action} not supported:`, err);
      }
    });

    return () => {
      if (!('mediaSession' in navigator)) return;
      actionMap.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      });
    };
  }, []);

  // 2. Metadata: Set navigator.mediaSession.metadata in effect depending only on currentSong
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentSong) {
      const artworkSizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'];
      const artwork = currentSong.thumbnail
        ? artworkSizes.map((sizes) => ({
            src: currentSong.thumbnail,
            sizes,
            type: 'image/jpeg'
          }))
        : [];

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Moodsonix Stream',
          artwork
        });
      } catch (err) {
        console.warn('[Moodsonix] MediaSession metadata error:', err);
      }
    } else {
      try {
        navigator.mediaSession.metadata = null;
      } catch {}
    }
  }, [currentSong]);

  // 3. Playback state: Keep navigator.mediaSession.playbackState in sync with playbackState and call syncPositionState
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      let state: MediaSessionPlaybackState = 'none';
      if (currentSong) {
        if (playbackState === 'playing') {
          state = 'playing';
        } else if (playbackState === 'paused' || playbackState === 'buffering' || playbackState === 'cued') {
          state = 'paused';
        } else {
          state = 'none';
        }
      }
      navigator.mediaSession.playbackState = state;
    } catch {}

    syncPositionState();
  }, [playbackState, currentSong, syncPositionState]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        playbackState,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffled,
        quality,
        isNowPlayingOpen,
        setIsNowPlayingOpen,
        isVideoOpen,
        setIsVideoOpen: handleSetIsVideoOpen,
        toggleVideo,
        playSong,
        togglePlay,
        pause,
        resume,
        seekTo,
        setVolume,
        toggleMute,
        setRepeatMode,
        cycleRepeatMode,
        toggleShuffle,
        setQuality,
        nextTrack,
        previousTrack,
        playerError,
        clearPlayerError: () => setPlayerError(null)
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
