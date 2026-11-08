import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePlayer } from './PlayerContext';
import {
  DayDataUsageRecord,
  DataUsageStorage,
  ConnectionBucket,
  STREAM_BITRATES,
  getLocalDateKey,
  loadDataUsage,
  subscribeDataUsage,
  recordPlaybackProgress,
  recordSongPlay,
  clearDataUsageHistory,
  setupPerformanceObserver,
  getCurrentBucket
} from '../services/dataUsage';

interface DataUsageContextType {
  dataUsageMap: DataUsageStorage;
  todayKey: string;
  todayRecord: DayDataUsageRecord | null;
  yesterdayRecord: DayDataUsageRecord | null;
  thisMonthRecords: { dateKey: string; record: DayDataUsageRecord }[];
  getDay: (dateKey: string) => DayDataUsageRecord | null;
  getMonth: (year: number, monthIndex0: number) => Record<string, DayDataUsageRecord>;
  totals: {
    mobile: number;
    wifi: number;
    unknown: number;
    hasExact: boolean;
    hasEst: boolean;
  };
  currentBucket: ConnectionBucket;
  clearHistory: () => void;
}

const DataUsageContext = createContext<DataUsageContextType | undefined>(undefined);

export const DataUsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentSong, playbackState, effectiveQuality } = usePlayer();
  const [dataUsageMap, setDataUsageMap] = useState<DataUsageStorage>(() => loadDataUsage());
  const [currentBucket, setCurrentBucket] = useState<ConnectionBucket>(() => getCurrentBucket());

  const lastTickRef = useRef<number>(Date.now());
  const lastPlayedSongIdRef = useRef<string | null>(null);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = subscribeDataUsage(() => {
      setDataUsageMap({ ...loadDataUsage() });
    });
    return unsubscribe;
  }, []);

  // Update bucket when connection changes
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const conn = (navigator as any).connection;
    const updateBucket = () => setCurrentBucket(getCurrentBucket());
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', updateBucket);
      return () => conn.removeEventListener('change', updateBucket);
    }
  }, []);

  // PerformanceObserver for measured network resources
  useEffect(() => {
    const cleanup = setupPerformanceObserver();
    return () => {
      cleanup?.();
    };
  }, []);

  // Track songs played count (only on new song start)
  useEffect(() => {
    if (playbackState === 'playing' && currentSong?.id) {
      if (lastPlayedSongIdRef.current !== currentSong.id) {
        lastPlayedSongIdRef.current = currentSong.id;
        recordSongPlay();
      }
    }
  }, [playbackState, currentSong?.id]);

  // Estimate playback network consumption while playing
  useEffect(() => {
    lastTickRef.current = Date.now();
    if (playbackState !== 'playing') {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const rawDelta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      // Cap delta at 5 s so phone sleep or long tab freeze is not falsely accumulated
      const elapsedSeconds = Math.min(Math.max(0, rawDelta), 5);
      if (elapsedSeconds <= 0) return;

      const isDirectAudio = Boolean(currentSong && (currentSong.source === 'audio' || currentSong.audioUrl));
      const audioKbps = STREAM_BITRATES.audioKbps;

      const qualityKey = effectiveQuality in STREAM_BITRATES.videoKbps
        ? (effectiveQuality as keyof typeof STREAM_BITRATES.videoKbps)
        : 'tiny';

      const videoKbps = isDirectAudio ? 0 : STREAM_BITRATES.videoKbps[qualityKey];

      recordPlaybackProgress(
        elapsedSeconds,
        audioKbps,
        videoKbps,
        isDirectAudio ? 'audio' : qualityKey
      );
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [playbackState, currentSong, effectiveQuality]);

  const todayKey = getLocalDateKey();

  const todayRecord = useMemo(() => {
    return dataUsageMap[todayKey] || null;
  }, [dataUsageMap, todayKey]);

  const yesterdayRecord = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterday);
    return dataUsageMap[yesterdayKey] || null;
  }, [dataUsageMap]);

  const getDay = useCallback(
    (dateKey: string): DayDataUsageRecord | null => {
      return dataUsageMap[dateKey] || null;
    },
    [dataUsageMap]
  );

  const getMonth = useCallback(
    (year: number, monthIndex0: number): Record<string, DayDataUsageRecord> => {
      const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
      const res: Record<string, DayDataUsageRecord> = {};
      for (const [key, record] of Object.entries(dataUsageMap)) {
        if (key.startsWith(prefix)) {
          res[key] = record;
        }
      }
      return res;
    },
    [dataUsageMap]
  );

  const thisMonthRecords = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const list: { dateKey: string; record: DayDataUsageRecord }[] = [];
    for (const [key, record] of Object.entries(dataUsageMap)) {
      if (key.startsWith(prefix)) {
        list.push({ dateKey: key, record });
      }
    }
    return list;
  }, [dataUsageMap]);

  const totals = useMemo(() => {
    let mobile = 0;
    let wifi = 0;
    let unknown = 0;
    let hasExact = false;
    let hasEst = false;

    for (const record of Object.values(dataUsageMap)) {
      if (record.exact?.mobile !== undefined) {
        mobile += record.exact.mobile;
        hasExact = true;
      } else {
        mobile += (record.mobile.est || 0) + (record.mobile.meas || 0);
      }

      if (record.exact?.wifi !== undefined) {
        wifi += record.exact.wifi;
        hasExact = true;
      } else {
        wifi += (record.wifi.est || 0) + (record.wifi.meas || 0);
      }

      unknown += (record.unknown.est || 0) + (record.unknown.meas || 0);

      if (record.mobile.est > 0 || record.wifi.est > 0 || record.unknown.est > 0) {
        hasEst = true;
      }
    }

    return { mobile, wifi, unknown, hasExact, hasEst };
  }, [dataUsageMap]);

  const clearHistory = useCallback(() => {
    clearDataUsageHistory();
    setDataUsageMap({});
  }, []);

  return (
    <DataUsageContext.Provider
      value={{
        dataUsageMap,
        todayKey,
        todayRecord,
        yesterdayRecord,
        thisMonthRecords,
        getDay,
        getMonth,
        totals,
        currentBucket,
        clearHistory
      }}
    >
      {children}
    </DataUsageContext.Provider>
  );
};

export const useDataUsage = () => {
  const context = useContext(DataUsageContext);
  if (!context) {
    throw new Error('useDataUsage must be used within a DataUsageProvider');
  }
  return context;
};
