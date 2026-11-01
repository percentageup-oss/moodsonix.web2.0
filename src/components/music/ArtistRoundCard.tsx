import React from 'react';
import { ItunesArtist } from '../../types/artist';
import { Music2 } from 'lucide-react';

interface ArtistRoundCardProps {
  artist: ItunesArtist;
  onClick: (artist: ItunesArtist) => void;
}

export const ArtistRoundCard: React.FC<ArtistRoundCardProps> = ({ artist, onClick }) => {
  // Generate a consistent vibrant background hue from artist name
  const getGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 45) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 20%) 0%, hsl(${hue2}, 80%, 10%) 100%)`;
  };

  const initial = artist.artistName ? artist.artistName.charAt(0).toUpperCase() : 'A';

  return (
    <button
      onClick={() => onClick(artist)}
      className="group flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 hover:scale-105 focus:outline-none shrink-0 w-24 sm:w-28 text-center"
      title={`View ${artist.artistName}'s profile`}
    >
      {/* Round Circular Avatar */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-b from-white/10 to-transparent group-hover:from-[var(--accent)] group-hover:to-[var(--accent)]/30 transition-all duration-300 shadow-lg">
        <div
          className="w-full h-full rounded-full flex flex-col items-center justify-center relative overflow-hidden border border-white/10 group-hover:border-[var(--accent)]/50 transition-colors"
          style={{ background: getGradient(artist.artistName) }}
        >
          {/* Subtle glow / backdrop shine */}
          <div className="absolute inset-0 bg-radial from-white/10 via-transparent to-transparent opacity-50" />
          
          <span className="text-xl sm:text-2xl font-black text-white/90 tracking-wider font-mono drop-shadow-md group-hover:text-[var(--accent)] transition-colors">
            {initial}
          </span>
          <Music2 className="w-3.5 h-3.5 text-white/40 group-hover:text-[var(--accent)]/70 transition-colors mt-0.5" />
        </div>
      </div>

      {/* Artist Name and Genre */}
      <div className="w-full">
        <p className="font-semibold text-xs text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
          {artist.artistName}
        </p>
        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 font-medium">
          {artist.primaryGenreName || 'Artist'}
        </p>
      </div>
    </button>
  );
};
