import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Song } from '../types/music';
import { Playlist, PlaylistSong } from '../types/playlist';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useQueue } from './QueueContext';
import { supabase } from '../lib/supabase';

const LOCAL_PLAYLISTS_KEY = 'moodsonix_local_playlists';
const LOCAL_LIKED_KEY = 'moodsonix_liked';

interface CreatePlaylistInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

interface FetchPlaylistResult {
  playlist: Playlist | null;
  status: 'found' | 'private' | 'not_found' | 'error';
  errorMessage?: string;
}

interface LocalSyncSummary {
  localLikedCount: number;
  localPlaylistCount: number;
}

interface PlaylistContextType {
  myPlaylists: Playlist[];
  myPlaylistsLoading: boolean;
  publicPlaylists: Playlist[];
  publicPlaylistsLoading: boolean;
  publicPlaylistsError: string | null;
  addToPlaylistTarget: Song | null;
  setAddToPlaylistTarget: (song: Song | null) => void;
  showSyncOffer: boolean;
  setShowSyncOffer: (show: boolean) => void;
  localSyncSummary: LocalSyncSummary;
  isSyncingToCloud: boolean;
  refreshMyPlaylists: () => Promise<void>;
  refreshPublicPlaylists: () => Promise<void>;
  createPlaylist: (input: CreatePlaylistInput) => Promise<Playlist | null>;
  updatePlaylistDetails: (
    playlistId: string,
    updates: { name?: string; description?: string }
  ) => Promise<boolean>;
  togglePlaylistPrivacy: (playlistId: string) => Promise<boolean>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, playlistSongId: string) => Promise<boolean>;
  reorderPlaylistSongs: (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => Promise<boolean>;
  fetchPlaylistById: (playlistId: string) => Promise<FetchPlaylistResult>;
  syncLocalDataToCloud: () => Promise<void>;
  dismissSyncOffer: () => void;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

function loadLocalPlaylists(): Playlist[] {
  const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalLikedSongs(): Song[] {
  const raw = localStorage.getItem(LOCAL_LIKED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRowToPlaylistSong(row: any): PlaylistSong {
  const videoId = row.video_id;
  const artist = row.artist || 'Unknown Artist';
  const title = row.title || 'Unknown Title';
  const thumbnail =
    row.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const duration = typeof row.duration === 'number' && row.duration > 0 ? row.duration : 180;

  return {
    id: row.id,
    playlistId: row.playlist_id,
    videoId,
    position: typeof row.position === 'number' ? row.position : 0,
    addedAt: row.added_at || new Date().toISOString(),
    song: {
      id: videoId,
      source: 'youtube',
      title,
      artist,
      channel: artist,
      album: null,
      thumbnail,
      duration,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      isPlayable: true
    }
  };
}

function mapRowToPlaylist(
  row: any,
  ownerMap?: Map<string, { username: string; avatar_url: string | null }>
): Playlist {
  const rawSongs = Array.isArray(row.playlist_songs) ? row.playlist_songs : [];
  const songs = rawSongs
    .map(mapRowToPlaylistSong)
    .sort((a: PlaylistSong, b: PlaylistSong) => a.position - b.position);

  const ownerInfo = ownerMap?.get(row.owner_id);

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: ownerInfo?.username || row.owner_name || 'Listener',
    ownerAvatar: ownerInfo?.avatar_url ?? null,
    name: row.name,
    description: row.description || '',
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    songs,
    coverUrl: songs[0]?.song.thumbnail || null
  };
}

async function fetchOwnersMap(ownerIds: string[]) {
  const map = new Map<string, { username: string; avatar_url: string | null }>();
  if (!supabase || ownerIds.length === 0) return map;

  const unique = Array.from(new Set(ownerIds.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', unique);

  if (Array.isArray(data)) {
    for (const p of data) {
      map.set(p.id, {
        username: p.username || 'Listener',
        avatar_url: p.avatar_url || null
      });
    }
  }
  return map;
}

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, profile, loading: authLoading } = useAuth();
  const { refreshLikedSongs } = useQueue();
  const { showToast } = useToast();

  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>(() => loadLocalPlaylists());
  const [myPlaylistsLoading, setMyPlaylistsLoading] = useState<boolean>(false);

  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [publicPlaylistsLoading, setPublicPlaylistsLoading] = useState<boolean>(false);
  const [publicPlaylistsError, setPublicPlaylistsError] = useState<string | null>(null);

  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState<Song | null>(null);

  const [showSyncOffer, setShowSyncOffer] = useState<boolean>(false);
  const [localSyncSummary, setLocalSyncSummary] = useState<LocalSyncSummary>({
    localLikedCount: 0,
    localPlaylistCount: 0
  });
  const [isSyncingToCloud, setIsSyncingToCloud] = useState<boolean>(false);

  // Persist guest playlists locally
  useEffect(() => {
    if (!authUser) {
      localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(myPlaylists));
    }
  }, [myPlaylists, authUser]);

  const refreshMyPlaylists = useCallback(async () => {
    if (!authUser || !supabase) {
      setMyPlaylists(loadLocalPlaylists());
      setMyPlaylistsLoading(false);
      return;
    }

    setMyPlaylistsLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select(
          'id, owner_id, name, description, is_public, created_at, updated_at, playlist_songs(id, playlist_id, video_id, title, artist, thumbnail, duration, position, added_at)'
        )
        .eq('owner_id', authUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const ownerName =
        profile?.username ||
        authUser.user_metadata?.username ||
        authUser.email?.split('@')[0] ||
        'Listener';

      const ownerMap = new Map<string, { username: string; avatar_url: string | null }>([
        [authUser.id, { username: ownerName, avatar_url: profile?.avatar_url || null }]
      ]);

      const mapped = (data || []).map((row: any) => mapRowToPlaylist(row, ownerMap));
      setMyPlaylists(mapped);
    } catch (err: any) {
      console.error('[Moodsonix] Failed to fetch playlists:', err);
      showToast('Failed to load your playlists', 'error');
    } finally {
      setMyPlaylistsLoading(false);
    }
  }, [authUser, profile, showToast]);

  const refreshPublicPlaylists = useCallback(async () => {
    if (!supabase) {
      setPublicPlaylists([]);
      return;
    }

    setPublicPlaylistsLoading(true);
    setPublicPlaylistsError(null);

    try {
      const { data, error } = await supabase
        .from('playlists')
        .select(
          'id, owner_id, name, description, is_public, created_at, updated_at, playlist_songs(id, playlist_id, video_id, title, artist, thumbnail, duration, position, added_at)'
        )
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .limit(60);

      if (error) throw error;

      const rows = data || [];
      const ownerIds = rows.map((r: any) => r.owner_id);
      const ownerMap = await fetchOwnersMap(ownerIds);

      const mapped = rows.map((row: any) => mapRowToPlaylist(row, ownerMap));
      setPublicPlaylists(mapped);
    } catch (err: any) {
      console.error('[Moodsonix] Failed to fetch public playlists:', err);
      setPublicPlaylistsError(err?.message || 'Unable to load public playlists right now.');
    } finally {
      setPublicPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    refreshMyPlaylists();
  }, [authLoading, refreshMyPlaylists]);

  // Offer first-login local-to-cloud sync if local data exists
  useEffect(() => {
    if (authLoading || !authUser || !supabase) return;

    const promptedKey = `moodsonix_cloud_sync_prompted_${authUser.id}`;
    if (localStorage.getItem(promptedKey) === 'true') return;

    const localLiked = loadLocalLikedSongs();
    const localPlaylists = loadLocalPlaylists();

    if (localLiked.length > 0 || localPlaylists.length > 0) {
      setLocalSyncSummary({
        localLikedCount: localLiked.length,
        localPlaylistCount: localPlaylists.length
      });
      setShowSyncOffer(true);
    } else {
      localStorage.setItem(promptedKey, 'true');
    }
  }, [authLoading, authUser]);

  const dismissSyncOffer = () => {
    if (authUser) {
      localStorage.setItem(`moodsonix_cloud_sync_prompted_${authUser.id}`, 'true');
    }
    setShowSyncOffer(false);
  };

  const syncLocalDataToCloud = async () => {
    if (!authUser || !supabase) return;

    setIsSyncingToCloud(true);
    try {
      const localLiked = loadLocalLikedSongs();
      const localPlaylists = loadLocalPlaylists();

      let uploadedLikes = 0;
      let uploadedPlaylists = 0;

      // 1. Sync liked songs without duplicates (using video_id)
      if (localLiked.length > 0) {
        const { data: existingLikes } = await supabase
          .from('liked_songs')
          .select('video_id')
          .eq('user_id', authUser.id);

        const existingIds = new Set(
          (existingLikes || []).map((r: any) => r.video_id)
        );

        const toInsert = localLiked
          .filter((s) => s.id && !existingIds.has(s.id))
          .map((s) => ({
            user_id: authUser.id,
            video_id: s.id,
            title: s.title,
            artist: s.artist,
            thumbnail: s.thumbnail
          }));

        if (toInsert.length > 0) {
          const { error: likeInsertErr } = await supabase
            .from('liked_songs')
            .insert(toInsert);
          if (likeInsertErr) throw likeInsertErr;
          uploadedLikes = toInsert.length;
        }
      }

      // 2. Sync local playlists without duplicate video_id inside playlists
      if (localPlaylists.length > 0) {
        const { data: existingCloudPlaylists } = await supabase
          .from('playlists')
          .select('id, name, playlist_songs(video_id, position)')
          .eq('owner_id', authUser.id);

        const cloudByName = new Map<string, any>();
        for (const cp of existingCloudPlaylists || []) {
          cloudByName.set(String(cp.name).trim().toLowerCase(), cp);
        }

        for (const lp of localPlaylists) {
          const normName = lp.name.trim().toLowerCase();
          const match = cloudByName.get(normName);

          let targetPlaylistId: string;
          let existingVideoIds = new Set<string>();
          let startPos = 0;

          if (match) {
            targetPlaylistId = match.id;
            const existingSongs = Array.isArray(match.playlist_songs)
              ? match.playlist_songs
              : [];
            existingVideoIds = new Set(existingSongs.map((s: any) => s.video_id));
            startPos = existingSongs.length;
          } else {
            const { data: createdPl, error: createErr } = await supabase
              .from('playlists')
              .insert({
                owner_id: authUser.id,
                name: lp.name.trim(),
                description: lp.description || '',
                is_public: Boolean(lp.isPublic)
              })
              .select('id')
              .single();

            if (createErr) throw createErr;
            targetPlaylistId = createdPl.id;
            uploadedPlaylists += 1;
          }

          // Deduplicate songs by video_id
          const seenLocal = new Set<string>();
          const songsToInsert = [];
          for (const ps of lp.songs || []) {
            const vid = ps.videoId || ps.song?.id;
            if (!vid || existingVideoIds.has(vid) || seenLocal.has(vid)) continue;
            seenLocal.add(vid);
            songsToInsert.push({
              playlist_id: targetPlaylistId,
              video_id: vid,
              title: ps.song?.title || 'Unknown Title',
              artist: ps.song?.artist || 'Unknown Artist',
              thumbnail:
                ps.song?.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              duration: Math.round(ps.song?.duration || 180),
              position: startPos++
            });
          }

          if (songsToInsert.length > 0) {
            const { error: songsErr } = await supabase
              .from('playlist_songs')
              .insert(songsToInsert);
            if (songsErr) throw songsErr;
          }
        }
      }

      localStorage.setItem(`moodsonix_cloud_sync_prompted_${authUser.id}`, 'true');
      localStorage.removeItem(LOCAL_LIKED_KEY);
      localStorage.removeItem(LOCAL_PLAYLISTS_KEY);

      await Promise.all([refreshLikedSongs(), refreshMyPlaylists(), refreshPublicPlaylists()]);
      setShowSyncOffer(false);

      showToast(
        `Synced ${uploadedLikes} liked songs and ${uploadedPlaylists} playlists to the cloud!`,
        'success'
      );
    } catch (err: any) {
      console.error('[Moodsonix] Cloud sync error:', err);
      showToast(err?.message || 'Cloud sync failed. Local data kept safe.', 'error');
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const createPlaylist = async ({
    name,
    description = '',
    isPublic = false
  }: CreatePlaylistInput): Promise<Playlist | null> => {
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Playlist name is required', 'error');
      return null;
    }

    const now = new Date().toISOString();
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const optimisticPlaylist: Playlist = {
      id: tempId,
      ownerId: authUser?.id || 'guest',
      ownerName: profile?.username || authUser?.email?.split('@')[0] || 'Guest Explorer',
      ownerAvatar: profile?.avatar_url || null,
      name: cleanName,
      description: description.trim(),
      isPublic,
      createdAt: now,
      updatedAt: now,
      songs: [],
      coverUrl: null
    };

    const previous = myPlaylists;
    setMyPlaylists([optimisticPlaylist, ...previous]);

    if (!authUser || !supabase) {
      showToast(`Created "${cleanName}"`, 'success');
      return optimisticPlaylist;
    }

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          owner_id: authUser.id,
          name: cleanName,
          description: description.trim(),
          is_public: isPublic
        })
        .select('id, owner_id, name, description, is_public, created_at, updated_at')
        .single();

      if (error) throw error;

      const realPlaylist: Playlist = {
        ...optimisticPlaylist,
        id: data.id,
        ownerId: data.owner_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setMyPlaylists((curr) =>
        curr.map((p) => (p.id === tempId ? realPlaylist : p))
      );
      showToast(`Created "${cleanName}"`, 'success');
      return realPlaylist;
    } catch (err: any) {
      console.error('[Moodsonix] Create playlist error:', err);
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to create playlist', 'error');
      return null;
    }
  };

  const updatePlaylistDetails = async (
    playlistId: string,
    updates: { name?: string; description?: string }
  ): Promise<boolean> => {
    const cleanName = updates.name?.trim();
    if (updates.name !== undefined && !cleanName) {
      showToast('Playlist name cannot be empty', 'error');
      return false;
    }

    const previous = myPlaylists;
    const now = new Date().toISOString();

    setMyPlaylists((curr) =>
      curr.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              name: cleanName !== undefined ? cleanName : p.name,
              description:
                updates.description !== undefined ? updates.description.trim() : p.description,
              updatedAt: now
            }
          : p
      )
    );

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      showToast('Playlist updated', 'success');
      return true;
    }

    try {
      const payload: Record<string, any> = { updated_at: now };
      if (cleanName !== undefined) payload.name = cleanName;
      if (updates.description !== undefined) payload.description = updates.description.trim();

      const { error } = await supabase
        .from('playlists')
        .update(payload)
        .eq('id', playlistId)
        .eq('owner_id', authUser.id);

      if (error) throw error;
      showToast('Playlist updated', 'success');
      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to update playlist', 'error');
      return false;
    }
  };

  const togglePlaylistPrivacy = async (playlistId: string): Promise<boolean> => {
    const target = myPlaylists.find((p) => p.id === playlistId);
    if (!target) return false;

    const nextPublic = !target.isPublic;
    const previous = myPlaylists;
    const now = new Date().toISOString();

    setMyPlaylists((curr) =>
      curr.map((p) =>
        p.id === playlistId ? { ...p, isPublic: nextPublic, updatedAt: now } : p
      )
    );

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      showToast(`Playlist is now ${nextPublic ? 'Public' : 'Private'}`, 'success');
      return true;
    }

    try {
      const { error } = await supabase
        .from('playlists')
        .update({ is_public: nextPublic, updated_at: now })
        .eq('id', playlistId)
        .eq('owner_id', authUser.id);

      if (error) throw error;
      showToast(`Playlist is now ${nextPublic ? 'Public' : 'Private'}`, 'success');
      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to change privacy setting', 'error');
      return false;
    }
  };

  const deletePlaylist = async (playlistId: string): Promise<boolean> => {
    const previous = myPlaylists;
    setMyPlaylists((curr) => curr.filter((p) => p.id !== playlistId));

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      showToast('Playlist deleted', 'info');
      return true;
    }

    try {
      await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId);
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('owner_id', authUser.id);

      if (error) throw error;
      showToast('Playlist deleted', 'info');
      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to delete playlist', 'error');
      return false;
    }
  };

  const addSongToPlaylist = async (playlistId: string, song: Song): Promise<boolean> => {
    const target = myPlaylists.find((p) => p.id === playlistId);
    if (!target) return false;

    if (target.songs.some((s) => s.videoId === song.id)) {
      showToast(`"${song.title}" is already in ${target.name}`, 'info');
      return true;
    }

    const previous = myPlaylists;
    const position = target.songs.length;
    const tempSongId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const newEntry: PlaylistSong = {
      id: tempSongId,
      playlistId,
      videoId: song.id,
      position,
      addedAt: now,
      song
    };

    setMyPlaylists((curr) =>
      curr.map((p) => {
        if (p.id !== playlistId) return p;
        const nextSongs = [...p.songs, newEntry];
        return {
          ...p,
          songs: nextSongs,
          coverUrl: p.coverUrl || nextSongs[0]?.song.thumbnail || null,
          updatedAt: now
        };
      })
    );

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      showToast(`Added to "${target.name}"`, 'success');
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('playlist_songs')
        .insert({
          playlist_id: playlistId,
          video_id: song.id,
          title: song.title,
          artist: song.artist,
          thumbnail: song.thumbnail,
          duration: Math.round(song.duration || 180),
          position
        })
        .select('id, playlist_id, video_id, title, artist, thumbnail, duration, position, added_at')
        .single();

      if (error) throw error;

      await supabase
        .from('playlists')
        .update({ updated_at: now })
        .eq('id', playlistId)
        .eq('owner_id', authUser.id);

      const realEntry = mapRowToPlaylistSong(data);
      setMyPlaylists((curr) =>
        curr.map((p) => {
          if (p.id !== playlistId) return p;
          const nextSongs = p.songs.map((ps) => (ps.id === tempSongId ? realEntry : ps));
          return {
            ...p,
            songs: nextSongs,
            coverUrl: nextSongs[0]?.song.thumbnail || null
          };
        })
      );

      showToast(`Added to "${target.name}"`, 'success');
      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to add song to playlist', 'error');
      return false;
    }
  };

  const removeSongFromPlaylist = async (
    playlistId: string,
    playlistSongId: string
  ): Promise<boolean> => {
    const target = myPlaylists.find((p) => p.id === playlistId);
    if (!target) return false;

    const previous = myPlaylists;
    const now = new Date().toISOString();

    const updatedSongs = target.songs
      .filter((ps) => ps.id !== playlistSongId)
      .map((ps, idx) => ({ ...ps, position: idx }));

    setMyPlaylists((curr) =>
      curr.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              songs: updatedSongs,
              coverUrl: updatedSongs[0]?.song.thumbnail || null,
              updatedAt: now
            }
          : p
      )
    );

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      showToast('Removed from playlist', 'info');
      return true;
    }

    const sb = supabase;
    try {
      const { error } = await sb
        .from('playlist_songs')
        .delete()
        .eq('id', playlistSongId)
        .eq('playlist_id', playlistId);

      if (error) throw error;

      await Promise.all([
        sb
          .from('playlists')
          .update({ updated_at: now })
          .eq('id', playlistId)
          .eq('owner_id', authUser.id),
        ...updatedSongs.map((ps) =>
          sb
            .from('playlist_songs')
            .update({ position: ps.position })
            .eq('id', ps.id)
        )
      ]);

      showToast('Removed from playlist', 'info');
      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to remove song from playlist', 'error');
      return false;
    }
  };

  const reorderPlaylistSongs = async (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<boolean> => {
    const target = myPlaylists.find((p) => p.id === playlistId);
    if (
      !target ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= target.songs.length ||
      toIndex >= target.songs.length
    ) {
      return false;
    }

    const previous = myPlaylists;
    const now = new Date().toISOString();
    const reordered = [...target.songs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const reindexed = reordered.map((ps, idx) => ({ ...ps, position: idx }));

    setMyPlaylists((curr) =>
      curr.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              songs: reindexed,
              coverUrl: reindexed[0]?.song.thumbnail || null,
              updatedAt: now
            }
          : p
      )
    );

    if (!authUser || !supabase || playlistId.startsWith('local_')) {
      return true;
    }

    const sb = supabase;
    try {
      const results = await Promise.all(
        reindexed.map((ps) =>
          sb
            .from('playlist_songs')
            .update({ position: ps.position })
            .eq('id', ps.id)
            .eq('playlist_id', playlistId)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      await sb
        .from('playlists')
        .update({ updated_at: now })
        .eq('id', playlistId)
        .eq('owner_id', authUser.id);

      return true;
    } catch (err: any) {
      setMyPlaylists(previous);
      showToast(err?.message || 'Failed to save track order', 'error');
      return false;
    }
  };

  const fetchPlaylistById = useCallback(
    async (playlistId: string): Promise<FetchPlaylistResult> => {
      // Check local playlists first if guest or local ID
      if (playlistId.startsWith('local_') || !supabase) {
        const localMatch = loadLocalPlaylists().find((p) => p.id === playlistId);
        if (localMatch) {
          return { playlist: localMatch, status: 'found' };
        }
        return { playlist: null, status: 'not_found' };
      }

      try {
        const { data, error } = await supabase
          .from('playlists')
          .select(
            'id, owner_id, name, description, is_public, created_at, updated_at, playlist_songs(id, playlist_id, video_id, title, artist, thumbnail, duration, position, added_at)'
          )
          .eq('id', playlistId)
          .maybeSingle();

        if (error) {
          return {
            playlist: null,
            status: 'error',
            errorMessage: error.message
          };
        }

        // With RLS enabled, private playlists belonging to others return null
        if (!data) {
          return { playlist: null, status: 'private' };
        }

        if (!data.is_public && data.owner_id !== authUser?.id) {
          return { playlist: null, status: 'private' };
        }

        const ownerMap = await fetchOwnersMap([data.owner_id]);
        const mapped = mapRowToPlaylist(data, ownerMap);
        return { playlist: mapped, status: 'found' };
      } catch (err: any) {
        return {
          playlist: null,
          status: 'error',
          errorMessage: err?.message || 'Unable to load playlist'
        };
      }
    },
    [authUser?.id]
  );

  return (
    <PlaylistContext.Provider
      value={{
        myPlaylists,
        myPlaylistsLoading,
        publicPlaylists,
        publicPlaylistsLoading,
        publicPlaylistsError,
        addToPlaylistTarget,
        setAddToPlaylistTarget,
        showSyncOffer,
        setShowSyncOffer,
        localSyncSummary,
        isSyncingToCloud,
        refreshMyPlaylists,
        refreshPublicPlaylists,
        createPlaylist,
        updatePlaylistDetails,
        togglePlaylistPrivacy,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        reorderPlaylistSongs,
        fetchPlaylistById,
        syncLocalDataToCloud,
        dismissSyncOffer
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylists = () => {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error('usePlaylists must be used within PlaylistProvider');
  return context;
};
