export interface ArtistPart {
  type: 'artist' | 'separator';
  text: string;
}

/**
 * Splits an artist string (e.g. "Hanumankind & Kalmi", "Drake feat. Travis Scott", "Coldplay, BTS")
 * on "&", ",", "feat.", "ft.", and "x" (case-insensitive) into individual artist names and separators.
 */
export function splitArtistNames(artistStr: string): ArtistPart[] {
  if (!artistStr) return [];

  // Match separators:
  // - " feat. " or " feat "
  // - " ft. " or " ft "
  // - " & "
  // - " x " or " X "
  // - ", " or ","
  const separatorRegex = /(\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+|\s+[xX]\s+|,\s*)/i;
  const rawParts = artistStr.split(separatorRegex);
  const parts: ArtistPart[] = [];

  for (const part of rawParts) {
    if (!part) continue;

    if (separatorRegex.test(part)) {
      parts.push({ type: 'separator', text: part });
    } else {
      const trimmed = part.trim();
      if (trimmed) {
        parts.push({ type: 'artist', text: trimmed });
      }
    }
  }

  return parts;
}

/**
 * Deterministic helper to generate a formatted monthly listener count
 * based on an artist name or ID if the API does not provide one.
 */
export function generateMonthlyListeners(nameOrId: string | number): string {
  const str = String(nameOrId).toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  // Range: 250,000 to 45,000,000
  const listeners = 250000 + (positive % 44750000);

  if (listeners >= 1000000) {
    return `${(listeners / 1000000).toFixed(1)}M monthly listeners`;
  }
  return `${(listeners / 1000).toFixed(0)}K monthly listeners`;
}
