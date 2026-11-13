import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ProfileRecord } from '../types/playlist';
import { useToast } from './ToastContext';

interface AuthResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  session: Session | null;
  authUser: User | null;
  profile: ProfileRecord | null;
  loading: boolean;
  isGuest: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<{ error?: string }>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_DISMISSED_KEY = 'moodsonix_guest_mode';

function deriveUsername(user: User): string {
  const meta = user.user_metadata || {};
  return (
    meta.username ||
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split('@')[0] : 'Listener')
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Never block shared playlist URLs with an auth gate on first load
    if (window.location.pathname.startsWith('/playlist/')) return false;
    // Show auth screen on first visit unless user already chose "Continue as guest"
    return localStorage.getItem(GUEST_DISMISSED_KEY) !== 'true';
  });

  const ensureProfile = useCallback(async (user: User) => {
    if (!supabase) return;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!fetchError && existing) {
        setProfile(existing as ProfileRecord);
        return;
      }

      const fallbackUsername = deriveUsername(user);
      const avatarUrl = user.user_metadata?.avatar_url || null;

      const { data: created, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            username: fallbackUsername,
            avatar_url: avatarUrl
          },
          { onConflict: 'id' }
        )
        .select('id, username, avatar_url, created_at')
        .maybeSingle();

      if (!upsertError && created) {
        setProfile(created as ProfileRecord);
      } else {
        setProfile({
          id: user.id,
          username: fallbackUsername,
          avatar_url: avatarUrl,
          created_at: new Date().toISOString()
        });
      }
    } catch {
      setProfile({
        id: user.id,
        username: deriveUsername(user),
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: new Date().toISOString()
      });
    }
  }, []);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn('[Moodsonix Auth] getSession error:', error.message);
      }
      const currentSession = data?.session ?? null;
      setSession(currentSession);
      setAuthUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        setShowAuthModal(false);
        ensureProfile(currentSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setShowAuthModal(false);
        ensureProfile(nextSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [ensureProfile]);

  const signUpWithEmail = async (
    email: string,
    password: string,
    username: string
  ): Promise<AuthResult> => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Check environment variables.' };
    }

    const cleanName = username.trim() || email.split('@')[0] || 'Listener';
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username: cleanName,
          display_name: cleanName
        }
      }
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user && data.session) {
      await ensureProfile(data.user);
      setShowAuthModal(false);
      showToast(`Welcome to Moodsonix, ${cleanName}!`, 'success');
      return {};
    }

    if (data.user && !data.session) {
      return { needsEmailConfirmation: true };
    }

    return {};
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Check environment variables.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      await ensureProfile(data.user);
      setShowAuthModal(false);
      showToast('Signed in successfully', 'success');
    }

    return {};
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Check environment variables.' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      return { error: error.message };
    }
    return {};
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast('Could not sign out cleanly: ' + error.message, 'error');
        return;
      }
    }
    setSession(null);
    setAuthUser(null);
    setProfile(null);
    localStorage.setItem(GUEST_DISMISSED_KEY, 'true');
    showToast('Signed out. Switched to local guest mode.', 'info');
  };

  const updateUsername = async (newUsername: string): Promise<{ error?: string }> => {
    const clean = newUsername.trim();
    if (!clean) return { error: 'Username cannot be empty' };
    if (!supabase || !authUser) return { error: 'Must be signed in' };

    const previous = profile;
    setProfile((prev) =>
      prev
        ? { ...prev, username: clean }
        : {
            id: authUser.id,
            username: clean,
            avatar_url: null,
            created_at: new Date().toISOString()
          }
    );

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: authUser.id, username: clean }, { onConflict: 'id' });

    if (error) {
      setProfile(previous);
      showToast('Failed to update username', 'error');
      return { error: error.message };
    }

    await supabase.auth.updateUser({
      data: { username: clean, display_name: clean }
    });

    showToast('Username updated', 'success');
    return {};
  };

  const continueAsGuest = () => {
    localStorage.setItem(GUEST_DISMISSED_KEY, 'true');
    setShowAuthModal(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        authUser,
        profile,
        loading,
        isGuest: !authUser,
        showAuthModal,
        setShowAuthModal,
        authMode,
        setAuthMode,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        updateUsername,
        continueAsGuest
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
