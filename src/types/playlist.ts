import { Song } from './music';

export interface ProfileRecord {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface PlaylistSong {
  id: string;
  playlistId: string;
  videoId: string;
  position: number;
  addedAt: string;
  song: Song;
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName?: string;
  ownerAvatar?: string | null;
  name: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  songs: PlaylistSong[];
  coverUrl?: string | null;
}
