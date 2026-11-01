export interface ItunesArtist {
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
  artistLinkUrl?: string;
  artworkUrl?: string;
}

export interface ItunesSong {
  trackId: number;
  trackName: string;
  artistName: string;
  artistId?: number;
  collectionId?: number;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackNumber?: number;
}

export interface ItunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artistId?: number;
  artworkUrl100?: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  copyright?: string;
}

export interface ArtistProfileData {
  artist: ItunesArtist;
  topArtwork: string | null;
  popularSongs: ItunesSong[];
  allSongs: ItunesSong[];
  albums: ItunesAlbum[];
}
