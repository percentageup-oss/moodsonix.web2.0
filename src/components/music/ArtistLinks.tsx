import React from 'react';
import { useArtistNavigation } from '../../context/ArtistNavigationContext';
import { splitArtistNames } from '../../lib/artistUtils';
import { cn } from '../../lib/utils';

interface ArtistLinksProps {
  artist: string;
  className?: string;
  linkClassName?: string;
  separatorClassName?: string;
}

export const ArtistLinks: React.FC<ArtistLinksProps> = ({
  artist,
  className,
  linkClassName,
  separatorClassName
}) => {
  const { openArtist } = useArtistNavigation();
  const parts = splitArtistNames(artist);

  if (!artist || parts.length === 0) {
    return <span className={className}>{artist || 'Unknown Artist'}</span>;
  }

  return (
    <span className={cn('inline', className)}>
      {parts.map((part, index) => {
        if (part.type === 'separator') {
          return (
            <span
              key={`sep-${index}`}
              className={cn('text-[var(--text-muted)] select-none', separatorClassName)}
            >
              {part.text}
            </span>
          );
        }

        return (
          <span
            key={`art-${index}-${part.text}`}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              openArtist(part.text);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                openArtist(part.text);
              }
            }}
            className={cn(
              'cursor-pointer hover:underline hover:text-[var(--accent)] active:text-[var(--accent-hover)] transition-colors select-none',
              linkClassName
            )}
            title={`View ${part.text}'s profile`}
          >
            {part.text}
          </span>
        );
      })}
    </span>
  );
};
