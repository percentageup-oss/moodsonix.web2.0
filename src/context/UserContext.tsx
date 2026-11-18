import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types/music';
import { useAuth } from './AuthContext';

interface UserContextType {
  user: UserProfile;
  logout: () => void;
  incrementSearchCount: () => boolean; // returns false if limit hit
  isLimitReached: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  maxGuestSearches: number;
  updateDisplayName: (name: string) => Promise<{ error?: string }>;
}

const GUEST_SEARCH_LIMIT = 25;
const GUEST_SEARCHES_KEY = 'moodsonix_guest_searches';
const GUEST_ID_KEY = 'moodsonix_guest_id';
const GUEST_NAME_KEY = 'moodsonix_guest_name';

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, profile, isGuest, signOut, showAuthModal, setShowAuthModal, updateUsername } = useAuth();

  const [guestId] = useState<string>(() => {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const next = 'guest_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(GUEST_ID_KEY, next);
    return next;
  });

  const [guestName, setGuestName] = useState<string>(() => {
    const saved = localStorage.getItem(GUEST_NAME_KEY);
    return saved && saved.trim() ? saved.trim() : 'Guest Explorer';
  });

  const [guestSearches, setGuestSearches] = useState<number>(() => {
    const raw = localStorage.getItem(GUEST_SEARCHES_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  useEffect(() => {
    localStorage.setItem(GUEST_SEARCHES_KEY, String(guestSearches));
  }, [guestSearches]);

  const user: UserProfile = useMemo(() => {
    if (authUser && !isGuest) {
      const displayName =
        profile?.username ||
        authUser.user_metadata?.username ||
        authUser.user_metadata?.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        (authUser.email ? authUser.email.split('@')[0] : 'Listener');

      return {
        id: authUser.id,
        displayName,
        email: authUser.email || '',
        avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url,
        isGuest: false,
        searchesCount: 0
      };
    }

    return {
      id: guestId,
      displayName: guestName || 'Guest Explorer',
      email: '',
      isGuest: true,
      searchesCount: guestSearches
    };
  }, [authUser, profile, isGuest, guestId, guestName, guestSearches]);

  const isLimitReached = user.isGuest && guestSearches >= GUEST_SEARCH_LIMIT;

  const incrementSearchCount = (): boolean => {
    if (!user.isGuest) return true;
    if (guestSearches >= GUEST_SEARCH_LIMIT) {
      setShowAuthModal(true);
      return false;
    }
    setGuestSearches((prev) => prev + 1);
    return true;
  };

  const updateDisplayName = async (name: string): Promise<{ error?: string }> => {
    const clean = name.trim();
    if (!clean) return { error: 'Name cannot be empty' };
    if (authUser && !isGuest) {
      return updateUsername(clean);
    }
    localStorage.setItem(GUEST_NAME_KEY, clean);
    setGuestName(clean);
    return {};
  };

  const logout = () => {
    signOut();
  };

  return (
    <UserContext.Provider
      value={{
        user,
        logout,
        incrementSearchCount,
        isLimitReached,
        showAuthModal,
        setShowAuthModal,
        maxGuestSearches: GUEST_SEARCH_LIMIT,
        updateDisplayName
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
