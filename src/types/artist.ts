import { Song } from './music';

export interface ItunesArtist {
  artistId: number | string;
  artistName: string;
  primaryGenreName?: string;
  artistLinkUrl?: string;
  artworkUrl?: string;
  avatarUrl?: string;
}

export interface ItunesSong {
  trackId: number | string;
  trackName: string;
  artistName: string;
  artistId?: number | string;
  collectionId?: number | string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackNumber?: number;
}

export interface ItunesAlbum {
  collectionId: number | string;
  collectionName: string;
  artistName: string;
  artistId?: number | string;
  artworkUrl100?: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  copyright?: string;
  isSingleOrEp?: boolean;
}

export interface FollowedArtist {
  id: string; // artistId or normalized artist name
  name: string;
  avatarUrl?: string;
  genre?: string;
  monthlyListeners?: string;
  followedAt: number;
}

export interface ArtistProfileData {
  artist: ItunesArtist;
  topArtwork: string | null;
  avatarUrl: string | null;
  monthlyListeners: string;
  bio?: string | null;
  popularSongs: ItunesSong[];
  allSongs: ItunesSong[];
  albums: ItunesAlbum[];
  singlesAndEPs: ItunesAlbum[];
  videos: Song[];
  similarArtists: ItunesArtist[];
}
