import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Song } from '../types/music';
import { FollowedArtist } from '../types/artist';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { supabase } from '../lib/supabase';

interface QueueContextType {
  queue: Song[];
  history: Song[];
  likedSongs: Song[];
  likedLoading: boolean;
  followedArtists: FollowedArtist[];
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  setQueueList: (songs: Song[]) => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  refreshLikedSongs: () => Promise<void>;
  toggleFollowArtist: (artist: FollowedArtist) => void;
  isArtistFollowed: (artistIdOrName: string | number) => boolean;
  addToHistory: (song: Song) => void;
  getNextTrack: () => Song | null;
  consumeNextTrack: () => Song | null;
  getPreviousTrack: () => Song | null;
}

const LOCAL_LIKED_KEY = 'moodsonix_liked';

function loadLocalLiked(): Song[] {
  const saved = localStorage.getItem(LOCAL_LIKED_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {}
  }
  return [];
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [queue, setQueue] = useState<Song[]>(() => {
    const saved = localStorage.getItem('moodsonix_queue');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [history, setHistory] = useState<Song[]>(() => {
    const saved = localStorage.getItem('moodsonix_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [likedSongs, setLikedSongs] = useState<Song[]>(() => loadLocalLiked());
  const [likedLoading, setLikedLoading] = useState<boolean>(false);

  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>(() => {
    const saved = localStorage.getItem('moodsonix_followed_artists');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('moodsonix_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('moodsonix_history', JSON.stringify(history.slice(0, 100)));
  }, [history]);

  // Only persist likedSongs to localStorage when in guest mode
  useEffect(() => {
    if (!authUser) {
      localStorage.setItem(LOCAL_LIKED_KEY, JSON.stringify(likedSongs));
    }
  }, [likedSongs, authUser]);

  useEffect(() => {
    localStorage.setItem('moodsonix_followed_artists', JSON.stringify(followedArtists));
  }, [followedArtists]);

  const refreshLikedSongs = useCallback(async () => {
    if (!authUser || !supabase) {
      setLikedSongs(loadLocalLiked());
      setLikedLoading(false);
      return;
    }

    setLikedLoading(true);
    try {
      const { data, error } = await supabase
        .from('liked_songs')
        .select('user_id, video_id, title, artist, thumbnail, liked_at')
        .eq('user_id', authUser.id)
        .order('liked_at', { ascending: false });

      if (error) {
        throw error;
      }

      const mapped: Song[] = (data || []).map((row: any) => ({
        id: row.video_id,
        source: 'youtube',
        title: row.title || 'Unknown Title',
        artist: row.artist || 'Unknown Artist',
        channel: row.artist || 'YouTube',
        album: null,
        thumbnail:
          row.thumbnail ||
          `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
        duration: 180,
        url: `https://www.youtube.com/watch?v=${row.video_id}`,
        isPlayable: true
      }));

      setLikedSongs(mapped);
    } catch (err: any) {
      console.error('[Moodsonix] Failed to load cloud liked songs:', err);
      showToast('Failed to load liked songs from cloud', 'error');
    } finally {
      setLikedLoading(false);
    }
  }, [authUser, showToast]);

  useEffect(() => {
    if (authLoading) return;
    refreshLikedSongs();
  }, [authLoading, refreshLikedSongs]);

  const addToQueue = (song: Song) => {
    setQueue((prev) => [...prev, song]);
  };

  const playNext = (song: Song) => {
    setQueue((prev) => [song, ...prev]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const setQueueList = (songs: Song[]) => {
    setQueue(songs);
  };

  const toggleLike = async (song: Song) => {
    const previous = likedSongs;
    const exists = previous.some((s) => s.id === song.id);
    const optimistic = exists
      ? previous.filter((s) => s.id !== song.id)
      : [song, ...previous];

    // Optimistic UI update
    setLikedSongs(optimistic);

    if (!authUser || !supabase) {
      return;
    }

    try {
      if (exists) {
        const { error } = await supabase
          .from('liked_songs')
          .delete()
          .eq('user_id', authUser.id)
          .eq('video_id', song.id);

        if (error) throw error;
      } else {
        const payload = {
          user_id: authUser.id,
          video_id: song.id,
          title: song.title,
          artist: song.artist,
          thumbnail: song.thumbnail
        };

        const { error } = await supabase
          .from('liked_songs')
          .upsert(payload, { onConflict: 'user_id,video_id' });

        if (error) {
          // Fallback if unique constraint differs
          const { data: existingRow } = await supabase
            .from('liked_songs')
            .select('video_id')
            .eq('user_id', authUser.id)
            .eq('video_id', song.id)
            .maybeSingle();

          if (!existingRow) {
            const { error: insertErr } = await supabase
              .from('liked_songs')
              .insert(payload);
            if (insertErr) throw insertErr;
          }
        }
      }
    } catch (err: any) {
      console.error('[Moodsonix] Liked song sync failed:', err);
      // Rollback optimistic update
      setLikedSongs(previous);
      showToast(
        err?.message
          ? `Could not save liked song: ${err.message}`
          : 'Could not sync liked song. Change reverted.',
        'error'
      );
    }
  };

  const isLiked = (songId: string): boolean => {
    return likedSongs.some((s) => s.id === songId);
  };

  const toggleFollowArtist = (artist: FollowedArtist) => {
    setFollowedArtists((prev) => {
      const normId = String(artist.id).toLowerCase();
      const normName = artist.name.toLowerCase().trim();
      const exists = prev.some(
        (a) =>
          String(a.id).toLowerCase() === normId ||
          a.name.toLowerCase().trim() === normName
      );
      if (exists) {
        return prev.filter(
          (a) =>
            String(a.id).toLowerCase() !== normId &&
            a.name.toLowerCase().trim() !== normName
        );
      } else {
        return [{ ...artist, followedAt: Date.now() }, ...prev];
      }
    });
  };

  const isArtistFollowed = (artistIdOrName: string | number): boolean => {
    const target = String(artistIdOrName).toLowerCase().trim();
    return followedArtists.some(
      (a) =>
        String(a.id).toLowerCase().trim() === target ||
        a.name.toLowerCase().trim() === target
    );
  };

  const addToHistory = (song: Song) => {
    setHistory((prev) => {
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 50);
    });
  };

  const getNextTrack = (): Song | null => {
    return queue.length > 0 ? queue[0] : null;
  };

  const consumeNextTrack = (): Song | null => {
    if (queue.length === 0) return null;
    const nextSong = queue[0];
    setQueue((prev) => prev.slice(1));
    return nextSong;
  };

  const getPreviousTrack = (): Song | null => {
    return history.length > 1 ? history[1] : history[0] || null;
  };

  return (
    <QueueContext.Provider
      value={{
        queue,
        history,
        likedSongs,
        likedLoading,
        followedArtists,
        addToQueue,
        playNext,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setQueueList,
        toggleLike,
        isLiked,
        refreshLikedSongs,
        toggleFollowArtist,
        isArtistFollowed,
        addToHistory,
        getNextTrack,
        consumeNextTrack,
        getPreviousTrack
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) throw new Error('useQueue must be used within QueueProvider');
  return context;
};
