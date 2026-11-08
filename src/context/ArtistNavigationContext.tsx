import React, { createContext, useContext } from 'react';
import { ItunesArtist } from '../types/artist';

interface ArtistNavigationContextType {
  openArtist: (artistIdOrName: string | number, fallbackMeta?: Partial<ItunesArtist>) => void;
  closeArtist: () => void;
}

export const ArtistNavigationContext = createContext<ArtistNavigationContextType | undefined>(undefined);

export const useArtistNavigation = (): ArtistNavigationContextType => {
  const context = useContext(ArtistNavigationContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      openArtist: (artistIdOrName: string | number) => {
        const param = String(artistIdOrName).trim();
        if (param) {
          window.history.pushState({ page: 'artist', artistParam: param }, '', `/artist/${encodeURIComponent(param)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      closeArtist: () => {
        window.history.back();
      }
    };
  }
  return context;
};
