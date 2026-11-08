import React, { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { ArtistNavigationContext } from '../../context/ArtistNavigationContext';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNav } from './MobileNav';
import { PlayerBar } from './PlayerBar';
import { ToolsSheet } from '../tools/ToolsSheet';
import { PlaylistImporterModal } from '../music/PlaylistImporterModal';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { ShareSongModal } from '../common/ShareSongModal';
import { NowPlayingModal } from '../music/NowPlayingModal';
import { VideoPlayerDock } from '../music/VideoPlayerDock';
import { AuthModal } from '../common/AuthModal';
import { OfflineBanner } from '../common/OfflineBanner';
import { WelcomeSplash } from '../common/WelcomeSplash';
import { Song } from '../../types/music';

// Pages
import { HomePage } from '../../pages/HomePage';
import { SearchPage } from '../../pages/SearchPage';
import { QueuePage } from '../../pages/QueuePage';
import { LikedSongsPage } from '../../pages/LikedSongsPage';
import { AccountPage } from '../../pages/AccountPage';
import { ArtistPage } from '../../pages/ArtistPage';
import { DataUsagePage } from '../../pages/DataUsagePage';
import { ItunesArtist } from '../../types/artist';

import { Sliders } from 'lucide-react';
import { cn } from '../../lib/utils';

// Helper to inspect current URL path for initial routing
function parseRouteFromUrl(): { page: string; artistParam?: string; query?: string } {
  if (typeof window === 'undefined') return { page: 'home' };
  const path = window.location.pathname;

  if (path.startsWith('/artist/')) {
    const raw = path.replace('/artist/', '');
    const decoded = decodeURIComponent(raw).trim();
    if (decoded) {
      return { page: 'artist', artistParam: decoded };
    }
  }

  if (path === '/queue') return { page: 'queue' };
  if (path === '/library' || path === '/liked') return { page: 'liked' };
  if (path === '/search') {
    const q = new URLSearchParams(window.location.search).get('q') || '';
    return { page: 'search', query: q };
  }
  if (path === '/account') return { page: 'account' };
  if (path === '/data-usage') return { page: 'data-usage' };

  return { page: 'home' };
}

export const AppShell: React.FC = () => {
  const initialRoute = parseRouteFromUrl();
  const [currentPage, setCurrentPage] = useState<string>(initialRoute.page);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>(initialRoute.query || '');
  const [selectedArtistParam, setSelectedArtistParam] = useState<string>(initialRoute.artistParam || '');
  const [selectedArtistMeta, setSelectedArtistMeta] = useState<Partial<ItunesArtist> | null>(null);

  // Modals state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isPlaylistImporterOpen, setIsPlaylistImporterOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [sharedSong, setSharedSong] = useState<Song | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Welcome splash state (first launch)
  const [showSplash, setShowSplash] = useState(() => {
    return !localStorage.getItem('moodsonix_visited');
  });

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seekTo,
    toggleMute,
    nextTrack,
    previousTrack,
    cueSong,
    isNowPlayingOpen,
    setIsNowPlayingOpen
  } = usePlayer();

  // Navigation router with URL synchronization
  const handleNavigate = useCallback((page: string, query?: string) => {
    setCurrentPage(page);
    if (page === 'search') {
      if (query) setSearchInitialQuery(query);
      const url = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
      window.history.pushState({ page: 'search', query }, '', url);
    } else if (page === 'home') {
      window.history.pushState({ page: 'home' }, '', '/');
    } else if (page === 'queue') {
      window.history.pushState({ page: 'queue' }, '', '/queue');
    } else if (page === 'liked') {
      window.history.pushState({ page: 'liked' }, '', '/library');
    } else if (page === 'account') {
      window.history.pushState({ page: 'account' }, '', '/account');
    } else if (page === 'data-usage') {
      window.history.pushState({ page: 'data-usage' }, '', '/data-usage');
    }
  }, []);

  // Global openArtist function
  const openArtist = useCallback((artistIdOrName: string | number, fallbackMeta?: Partial<ItunesArtist>) => {
    const param = String(artistIdOrName).trim();
    if (!param) return;

    // Collapse full screen player if open, keeping audio playing uninterrupted
    setIsNowPlayingOpen(false);

    setSelectedArtistParam(param);
    if (fallbackMeta) {
      setSelectedArtistMeta(fallbackMeta);
    } else {
      setSelectedArtistMeta(null);
    }
    setCurrentPage('artist');

    // Update browser history URL
    const targetUrl = `/artist/${encodeURIComponent(param)}`;
    window.history.pushState({ page: 'artist', artistParam: param }, '', targetUrl);
  }, [setIsNowPlayingOpen]);

  const closeArtist = useCallback(() => {
    window.history.back();
  }, []);

  // Listen to browser Back/Forward (popstate) buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const route = parseRouteFromUrl();
      setCurrentPage(route.page);
      if (route.page === 'artist' && route.artistParam) {
        setSelectedArtistParam(route.artistParam);
      } else if (route.page === 'search' && route.query) {
        setSearchInitialQuery(route.query);
      }
      // Keep full player collapsed on back navigation
      setIsNowPlayingOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setIsNowPlayingOpen]);

  const handleShareSong = (song: Song) => {
    setSharedSong(song);
    setIsShareOpen(true);
  };

  // Deep-link check for "?song=VIDEO_ID" on load: cue track so first play comes from a user tap
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('song');
    if (!sharedId) return;

    const fallbackSong: Song = {
      id: sharedId,
      source: 'youtube',
      title: 'Shared Track',
      artist: 'YouTube Music',
      channel: 'YouTube',
      album: null,
      thumbnail: `https://i.ytimg.com/vi/${sharedId}/hqdefault.jpg`,
      duration: 180,
      url: `https://www.youtube.com/watch?v=${sharedId}`,
      isPlayable: true
    };

    cueSong(fallbackSong);

    fetch(`/api/song/${encodeURIComponent(sharedId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((songData) => {
        if (songData && songData.id) {
          cueSong(songData);
        }
      })
      .catch(() => {});
  }, [cueSong]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTo(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(Math.min(duration, currentTime + 10));
          break;
        case 'KeyN':
          e.preventDefault();
          nextTrack();
          break;
        case 'KeyP':
          e.preventDefault();
          previousTrack();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo, currentTime, duration, nextTrack, previousTrack, toggleMute]);

  return (
    <ArtistNavigationContext.Provider value={{ openArtist, closeArtist }}>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)]">
        {/* First-Launch Welcome Splash */}
        {showSplash && <WelcomeSplash onComplete={() => setShowSplash(false)} />}

        {/* Offline Connectivity Banner */}
        <OfflineBanner />

        {/* Persistent & Reliable YouTube Audio/Video Dock */}
        <VideoPlayerDock />

        {/* Desktop Sidebar (Fixed 240px) */}
        <div className="hidden md:block shrink-0">
          <DesktopSidebar
            currentPage={currentPage === 'artist' ? 'search' : currentPage}
            onNavigate={handleNavigate}
            onOpenTools={() => setIsToolsOpen(true)}
            onOpenPlaylistImporter={() => setIsPlaylistImporterOpen(true)}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Mobile Top Bar */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border-color)] shrink-0 z-20">
            <div
              onClick={() => handleNavigate('home')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#14141F] border border-white/10 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
              </div>
              <h1 className="font-bold text-sm tracking-tight text-[var(--text-primary)]">
                Moodsonix
              </h1>
            </div>

            {/* Quick Tools Button in mobile header */}
            <button
              onClick={() => setIsToolsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Tools</span>
            </button>
          </header>

          {/* Scrollable Page Body */}
          <main
            className={cn(
              'flex-1 overflow-y-auto px-4 md:px-8 pt-4 md:pt-6 pb-28 md:pb-24',
              currentSong && 'pb-36 md:pb-28'
            )}
          >
            {currentPage === 'home' && (
              <HomePage
                onNavigate={handleNavigate}
                onOpenTools={() => setIsToolsOpen(true)}
                onOpenPlaylistImporter={() => setIsPlaylistImporterOpen(true)}
                onShareSong={handleShareSong}
              />
            )}

            {currentPage === 'search' && (
              <SearchPage
                initialQuery={searchInitialQuery}
                onShareSong={handleShareSong}
                onSelectArtist={(artist) => {
                  openArtist(artist.artistId || artist.artistName, artist);
                }}
              />
            )}

            {currentPage === 'artist' && selectedArtistParam && (
              <ArtistPage
                artistIdOrName={selectedArtistParam}
                initialArtistName={selectedArtistMeta?.artistName}
                initialGenre={selectedArtistMeta?.primaryGenreName}
                onBack={closeArtist}
                onShareSong={handleShareSong}
              />
            )}

            {currentPage === 'queue' && (
              <QueuePage
                onShareSong={handleShareSong}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === 'liked' && (
              <LikedSongsPage
                onShareSong={handleShareSong}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === 'account' && (
              <AccountPage
                onOpenTools={() => setIsToolsOpen(true)}
                onOpenShortcuts={() => setIsShortcutsOpen(true)}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === 'data-usage' && (
              <DataUsagePage onNavigate={handleNavigate} />
            )}
          </main>

          {/* Floating Desktop Tools Button (bottom right corner) */}
          <button
            onClick={() => setIsToolsOpen(true)}
            title="Productivity Tools (Focus Timer & Ambient Mixer)"
            className="hidden md:flex fixed bottom-24 right-6 z-20 items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--surface-elevated)]/90 backdrop-blur-md border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:scale-105 transition-all shadow-xl glow-accent-sm cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            <span>Tools</span>
          </button>

          {/* Persistent Bottom Player Bar */}
          <PlayerBar />

          {/* Mobile Navigation Bar */}
          <MobileNav
            currentPage={currentPage === 'artist' ? 'search' : currentPage}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Modals & Overlays */}
        <ToolsSheet
          isOpen={isToolsOpen}
          onClose={() => setIsToolsOpen(false)}
          onNavigate={handleNavigate}
        />
        
        <PlaylistImporterModal
          isOpen={isPlaylistImporterOpen}
          onClose={() => setIsPlaylistImporterOpen(false)}
        />

        <KeyboardShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />

        <ShareSongModal
          song={sharedSong}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />

        <NowPlayingModal
          isOpen={isNowPlayingOpen}
          onClose={() => setIsNowPlayingOpen(false)}
          onShare={() => {
            if (currentSong) handleShareSong(currentSong);
          }}
        />

        <AuthModal />
      </div>
    </ArtistNavigationContext.Provider>
  );
};
