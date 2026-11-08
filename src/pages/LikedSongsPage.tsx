import React, { useState } from 'react';
import { useQueue } from '../context/QueueContext';
import { usePlayer } from '../context/PlayerContext';
import { useArtistNavigation } from '../context/ArtistNavigationContext';
import { Song } from '../types/music';
import { FollowedArtist } from '../types/artist';
import { SongRow } from '../components/music/SongRow';
import {
  Heart,
  Play,
  Shuffle,
  Search,
  Users,
  Music2,
  UserCheck,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LikedSongsPageProps {
  onShareSong: (song: Song) => void;
  onNavigate: (page: string) => void;
}

export const LikedSongsPage: React.FC<LikedSongsPageProps> = ({ onShareSong, onNavigate }) => {
  const { likedSongs, followedArtists, toggleFollowArtist, setQueueList } = useQueue();
  const { playSong } = usePlayer();
  const { openArtist } = useArtistNavigation();

  const [activeTab, setActiveTab] = useState<'tracks' | 'artists'>('tracks');
  const [filterQuery, setFilterQuery] = useState('');

  const filteredSongs = likedSongs.filter((song) => {
    const q = filterQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q)
    );
  });

  const filteredArtists = followedArtists.filter((artist) => {
    const q = filterQuery.toLowerCase();
    return (
      artist.name.toLowerCase().includes(q) ||
      (artist.genre && artist.genre.toLowerCase().includes(q))
    );
  });

  const handlePlayAll = () => {
    if (likedSongs.length === 0) return;
    const [first, ...rest] = likedSongs;
    setQueueList(rest);
    playSong(first);
  };

  const handleShuffleAll = () => {
    if (likedSongs.length === 0) return;
    const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
    const [first, ...rest] = shuffled;
    setQueueList(rest);
    playSong(first);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-4xl">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-red-950/40 via-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border-color)]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-red-400 font-semibold">
              // YOUR LIBRARY
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
              Favorites & Artists
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'} • {followedArtists.length} followed {followedArtists.length === 1 ? 'artist' : 'artists'}
            </p>
          </div>
        </div>

        {/* Action Buttons for Liked Songs */}
        {activeTab === 'tracks' && likedSongs.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePlayAll}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play All</span>
            </button>
            <button
              onClick={handleShuffleAll}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-color)] font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-[var(--accent)]" />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Library Tabs: Liked Songs vs Followed Artists */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('tracks')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'tracks'
                ? 'bg-[var(--accent)] text-black shadow-md'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', activeTab === 'tracks' ? 'fill-black' : '')} />
            <span>Liked Songs ({likedSongs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('artists')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'artists'
                ? 'bg-[var(--accent)] text-black shadow-md'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Followed Artists ({followedArtists.length})</span>
          </button>
        </div>

        {/* Filter Input */}
        {((activeTab === 'tracks' && likedSongs.length > 3) || (activeTab === 'artists' && followedArtists.length > 3)) && (
          <div className="relative max-w-xs w-full hidden sm:block">
            <Search className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={`Search in ${activeTab === 'tracks' ? 'songs' : 'artists'}...`}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </div>

      {/* TAB 1: LIKED SONGS */}
      {activeTab === 'tracks' && (
        <div className="space-y-4">
          {likedSongs.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)] space-y-3">
              <Heart className="w-12 h-12 mx-auto opacity-20 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">No liked songs yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Tap the heart icon on any song while listening or browsing to save it to your favorites.
              </p>
              <button
                onClick={() => onNavigate('search')}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors inline-block mt-2 cursor-pointer"
              >
                Discover Music
              </button>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <p className="text-xs">No favorites matching "{filterQuery}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSongs.map((song, idx) => (
                <SongRow key={song.id} song={song} index={idx} onShare={onShareSong} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FOLLOWED ARTISTS */}
      {activeTab === 'artists' && (
        <div className="space-y-4">
          {followedArtists.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)] space-y-3">
              <Users className="w-12 h-12 mx-auto opacity-20 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">No followed artists yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Tap any artist name in the player or search results and press "Follow" to keep up with their latest tracks and albums.
              </p>
              <button
                onClick={() => onNavigate('search')}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors inline-block mt-2 cursor-pointer"
              >
                Find Artists
              </button>
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <p className="text-xs">No artists matching "{filterQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredArtists.map((artist) => {
                const initial = artist.name ? artist.name.charAt(0).toUpperCase() : 'A';

                return (
                  <div
                    key={artist.id}
                    className="group relative flex flex-col items-center p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-secondary)] transition-all cursor-pointer shadow-sm text-center"
                    onClick={() => openArtist(artist.name)}
                  >
                    {/* Round Avatar */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-[var(--accent)] transition-all shadow-md bg-[var(--surface-elevated)]">
                      {artist.avatarUrl ? (
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900 text-[var(--accent)] font-mono font-bold text-2xl">
                          {initial}
                        </div>
                      )}
                    </div>

                    {/* Name & Genre */}
                    <p className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate w-full">
                      {artist.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 w-full">
                      {artist.genre || artist.monthlyListeners || 'Artist'}
                    </p>

                    {/* Unfollow button */}
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleFollowArtist(artist)}
                        title="Unfollow artist"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--accent)]/30 hover:border-red-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Following</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
