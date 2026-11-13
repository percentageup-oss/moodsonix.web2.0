import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { usePlaylists } from '../../context/PlaylistContext';
import { cn } from '../../lib/utils';
import { Home, Globe, Search, Heart, User } from 'lucide-react';

interface MobileNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPage, onNavigate }) => {
  const { likedSongs, followedArtists } = useQueue();
  const { myPlaylists } = usePlaylists();

  const totalLibraryCount =
    likedSongs.length + myPlaylists.length + followedArtists.length;

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Globe },
    { id: 'search', label: 'Search', icon: Search },
    {
      id: 'liked',
      label: 'Library',
      icon: Heart,
      badge: totalLibraryCount > 0 ? totalLibraryCount : undefined
    },
    { id: 'account', label: 'Account', icon: User }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)]/95 backdrop-blur-xl border-t border-[var(--border-color)] px-2 py-1.5 flex items-center justify-around safe-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative cursor-pointer',
              isActive
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 px-1 min-w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-black font-mono text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
