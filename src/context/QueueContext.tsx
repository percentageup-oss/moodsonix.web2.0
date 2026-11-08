import React, { createContext, useContext, useState, useEffect } from 'react';
import { Song } from '../types/music';
import { FollowedArtist } from '../types/artist';

interface QueueContextType {
  queue: Song[];
  history: Song[];
  likedSongs: Song[];
  followedArtists: FollowedArtist[];
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  setQueueList: (songs: Song[]) => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  toggleFollowArtist: (artist: FollowedArtist) => void;
  isArtistFollowed: (artistIdOrName: string | number) => boolean;
  addToHistory: (song: Song) => void;
  getNextTrack: () => Song | null;
  consumeNextTrack: () => Song | null;
  getPreviousTrack: () => Song | null;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Song[]>(() => {
    const saved = localStorage.getItem('moodsonix_queue');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const [history, setHistory] = useState<Song[]>(() => {
    const saved = localStorage.getItem('moodsonix_history');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const [likedSongs, setLikedSongs] = useState<Song[]>(() => {
    const saved = localStorage.getItem('moodsonix_liked');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>(() => {
    const saved = localStorage.getItem('moodsonix_followed_artists');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('moodsonix_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('moodsonix_history', JSON.stringify(history.slice(0, 100)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('moodsonix_liked', JSON.stringify(likedSongs));
  }, [likedSongs]);

  useEffect(() => {
    localStorage.setItem('moodsonix_followed_artists', JSON.stringify(followedArtists));
  }, [followedArtists]);

  const addToQueue = (song: Song) => {
    setQueue(prev => [...prev, song]);
  };

  const playNext = (song: Song) => {
    setQueue(prev => [song, ...prev]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue(prev => {
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

  const toggleLike = (song: Song) => {
    setLikedSongs(prev => {
      const exists = prev.some(s => s.id === song.id);
      if (exists) {
        return prev.filter(s => s.id !== song.id);
      } else {
        return [song, ...prev];
      }
    });
  };

  const isLiked = (songId: string): boolean => {
    return likedSongs.some(s => s.id === songId);
  };

  const toggleFollowArtist = (artist: FollowedArtist) => {
    setFollowedArtists(prev => {
      const normId = String(artist.id).toLowerCase();
      const normName = artist.name.toLowerCase().trim();
      const exists = prev.some(
        a => String(a.id).toLowerCase() === normId || a.name.toLowerCase().trim() === normName
      );
      if (exists) {
        return prev.filter(
          a => String(a.id).toLowerCase() !== normId && a.name.toLowerCase().trim() !== normName
        );
      } else {
        return [{ ...artist, followedAt: Date.now() }, ...prev];
      }
    });
  };

  const isArtistFollowed = (artistIdOrName: string | number): boolean => {
    const target = String(artistIdOrName).toLowerCase().trim();
    return followedArtists.some(
      a => String(a.id).toLowerCase().trim() === target || a.name.toLowerCase().trim() === target
    );
  };

  const addToHistory = (song: Song) => {
    setHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 50);
    });
  };

  const getNextTrack = (): Song | null => {
    return queue.length > 0 ? queue[0] : null;
  };

  const consumeNextTrack = (): Song | null => {
    if (queue.length === 0) return null;
    const nextSong = queue[0];
    setQueue(prev => prev.slice(1));
    return nextSong;
  };

  const getPreviousTrack = (): Song | null => {
    return history.length > 1 ? history[1] : (history[0] || null);
  };

  return (
    <QueueContext.Provider
      value={{
        queue,
        history,
        likedSongs,
        followedArtists,
        addToQueue,
        playNext,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setQueueList,
        toggleLike,
        isLiked,
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
