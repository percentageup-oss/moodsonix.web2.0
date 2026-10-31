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
  const [isVideoOpen, setIsVideoOpen] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const isPlayerReady = useRef<boolean>(false);
  const pendingSongRef = useRef<Song | null>(null);
  const timeUpdateInterval = useRef<any>(null);

  const isPlaying = playbackState === 'playing';

  const toggleVideo = () => {
    setIsVideoOpen(prev => !prev);
  };

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

  // Play a song
  const playSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setPlayerError(null);
    setCurrentTime(0);
    setDuration(song.duration || 0);
    localStorage.setItem('moodsonix_last_song', JSON.stringify(song));
    addToHistory(song);

    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.loadVideoById({
          videoId: song.id,
          startSeconds: 0
        });
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
        playerRef.current.playVideo();
      } catch (err) {
        console.error('[Moodsonix] Player loadVideoById error:', err);
      }
    } else {
      pendingSongRef.current = song;
    }
  }, [addToHistory, volume]);

  const pause = () => {
    if (playerRef.current && isPlayerReady.current) {
      try { playerRef.current.pauseVideo(); } catch {}
    }
  };

  const resume = () => {
    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.playVideo();
      } catch {}
    } else if (currentSong) {
      playSong(currentSong);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      if (currentSong) {
        resume();
      } else if (queue.length > 0) {
        const next = consumeNextTrack();
        if (next) playSong(next);
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current && isPlayerReady.current) {
      try {
        playerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
      } catch {}
    }
  };

  const nextTrack = useCallback(() => {
    if (queue.length > 0) {
      const nextSong = consumeNextTrack();
      if (nextSong) {
        playSong(nextSong);
      }
    } else if (repeatMode === 'all' && history.length > 0) {
      // Loop to beginning of listening history
      const first = history[history.length - 1];
      if (first) playSong(first);
    } else {
      pause();
    }
  }, [queue, repeatMode, history, consumeNextTrack, playSong]);

  const previousTrack = useCallback(() => {
    if (currentTime > 4) {
      // If played > 4s, restart song
      seekTo(0);
    } else {
      const prev = getPreviousTrack();
      if (prev && prev.id !== currentSong?.id) {
        playSong(prev);
      } else {
        seekTo(0);
      }
    }
  }, [currentTime, getPreviousTrack, currentSong, playSong]);

  // Handle YouTube player state changes
  const handleStateChange = useCallback((event: any) => {
    const stateCode = event.data;
    // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
    if (stateCode === 1) {
      setPlaybackState('playing');
    } else if (stateCode === 2) {
      setPlaybackState('paused');
    } else if (stateCode === 3) {
      setPlaybackState('buffering');
    } else if (stateCode === 5) {
      setPlaybackState('cued');
    } else if (stateCode === 0) {
      setPlaybackState('ended');
      if (repeatMode === 'one' && currentSong) {
        seekTo(0);
        resume();
      } else {
        nextTrack();
      }
    }
  }, [repeatMode, currentSong, nextTrack]);

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
                playSong(pending);
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
  }, [handleStateChange, handleError]);

  // Synchronize playback time
  useEffect(() => {
    if (isPlaying) {
      timeUpdateInterval.current = setInterval(() => {
        if (playerRef.current && isPlayerReady.current) {
          try {
            const time = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            setCurrentTime(time);
            if (dur > 0 && dur !== duration) {
              setDuration(dur);
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
      }
    };
  }, [isPlaying, duration]);

  // MediaSession API Integration
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Moodsonix Stream',
          artwork: [
            { src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => resume());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
        navigator.mediaSession.setActionHandler('seekbackward', () => seekTo(Math.max(0, currentTime - 10)));
        navigator.mediaSession.setActionHandler('seekforward', () => seekTo(Math.min(duration, currentTime + 10)));
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            seekTo(details.seekTime);
          }
        });
      } catch (err) {
        console.warn('[Moodsonix] MediaSession error:', err);
      }
    }
  }, [currentSong, currentTime, duration, nextTrack, previousTrack]);

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
        setIsVideoOpen,
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
