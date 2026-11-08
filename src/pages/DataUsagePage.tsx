import React, { useState, useMemo } from 'react';
import { useDataUsage } from '../context/DataUsageContext';
import {
  DayDataUsageRecord,
  formatDataBytes,
  getLocalDateKey
} from '../services/dataUsage';
import { qualityLabel } from '../lib/streamQuality';
import { cn } from '../lib/utils';
import {
  Activity,
  Wifi,
  Smartphone,
  HelpCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Clock,
  Music,
  Check,
  AlertTriangle,
  Sliders,
  Sparkles
} from 'lucide-react';

interface DataUsagePageProps {
  onNavigate?: (page: string) => void;
}

export const DataUsagePage: React.FC<DataUsagePageProps> = ({ onNavigate }) => {
  const {
    dataUsageMap,
    todayRecord,
    yesterdayRecord,
    todayKey,
    getMonth,
    totals,
    currentBucket,
    clearHistory
  } = useDataUsage();

  // Selected month state for calendar (starts on current month)
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  // Selected day for the bottom sheet inspector
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  // Collapsible explanation section state
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  // Confirm clear history dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth(); // 0-indexed

  // Month navigation
  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Check if viewing current month or future month
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  // Month records map
  const monthData = useMemo(() => {
    return getMonth(viewYear, viewMonth);
  }, [getMonth, viewYear, viewMonth]);

  // Calendar matrix calculation (Monday-first)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // In JS, Sunday is 0. For Monday = 0: (day + 6) % 7
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const cells: {
      dayNumber: number;
      dateKey: string;
      isToday: boolean;
      isFuture: boolean;
      record: DayDataUsageRecord | null;
    }[] = [];

    // Pad leading days
    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push({
        dayNumber: 0,
        dateKey: '',
        isToday: false,
        isFuture: false,
        record: null
      });
    }

    const todayDateKey = todayKey;

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cellDate = new Date(viewYear, viewMonth, d);
      const isFuture = cellDate.getTime() > today.getTime() && dateKey !== todayDateKey;
      const isToday = dateKey === todayDateKey;
      const record = monthData[dateKey] || null;

      cells.push({
        dayNumber: d,
        dateKey,
        isToday,
        isFuture,
        record
      });
    }

    return cells;
  }, [viewYear, viewMonth, monthData, todayKey, today]);

  // Find max mobile bytes in this month for relative heat-shading
  const { maxMobileBytesInMonth, monthRecordsWithData } = useMemo(() => {
    let maxBytes = 0;
    const recordsWithData: { dateKey: string; record: DayDataUsageRecord; mobileBytes: number }[] = [];

    for (const [key, record] of Object.entries(monthData)) {
      const mobileBytes =
        record.exact?.mobile !== undefined
          ? record.exact.mobile
          : (record.mobile?.meas || 0) + (record.mobile?.est || 0);

      recordsWithData.push({ dateKey: key, record, mobileBytes });
      if (mobileBytes > maxBytes) {
        maxBytes = mobileBytes;
      }
    }

    return { maxMobileBytesInMonth: maxBytes, monthRecordsWithData: recordsWithData };
  }, [monthData]);

  // Month footer stats: total, daily average, busiest day
  const monthStats = useMemo(() => {
    if (monthRecordsWithData.length === 0) {
      return {
        hasData: false,
        totalMobileBytes: 0,
        dailyAverageMobileBytes: 0,
        busiestDay: null as { dateKey: string; bytes: number; hasEst: boolean } | null,
        hasEst: false
      };
    }

    let totalMobile = 0;
    let hasEst = false;
    let busiest: { dateKey: string; bytes: number; hasEst: boolean } | null = null;

    for (const item of monthRecordsWithData) {
      totalMobile += item.mobileBytes;
      const dayHasEst = (item.record.mobile?.est || 0) > 0;
      if (dayHasEst) hasEst = true;

      if (!busiest || item.mobileBytes > busiest.bytes) {
        busiest = {
          dateKey: item.dateKey,
          bytes: item.mobileBytes,
          hasEst: dayHasEst
        };
      }
    }

    const average = totalMobile / monthRecordsWithData.length;

    return {
      hasData: true,
      totalMobileBytes: totalMobile,
      dailyAverageMobileBytes: average,
      busiestDay: busiest,
      hasEst
    };
  }, [monthRecordsWithData]);

  // Check if unknown is the predominant bucket (triggers warning banner)
  const isPredominantlyUnknown = useMemo(() => {
    const totalAll = totals.mobile + totals.wifi + totals.unknown;
    return totals.unknown > 0 && totals.unknown > totals.mobile + totals.wifi;
  }, [totals]);

  // Check if entire storage is empty
  const isCompletelyEmpty = Object.keys(dataUsageMap).length === 0;

  // Selected day record for modal
  const selectedDayRecord = selectedDayKey ? dataUsageMap[selectedDayKey] || null : null;

  // Helper to extract card presentation
  const getCardMetrics = (record: DayDataUsageRecord | null | undefined) => {
    if (!record) {
      return {
        hasRecord: false,
        mobileDisplay: 'No data',
        wifiDisplay: 'No data',
        unknownDisplay: 'No data',
        badge: null as string | null,
        badgeType: 'none' as 'exact' | 'est' | 'meas' | 'none'
      };
    }

    const isExact = record.exact?.mobile !== undefined;
    const mobileExact = record.exact?.mobile;
    const mobileMeas = record.mobile?.meas || 0;
    const mobileEst = record.mobile?.est || 0;
    const mobileTotal = isExact && mobileExact !== undefined ? mobileExact : mobileMeas + mobileEst;

    const wifiExact = record.exact?.wifi;
    const wifiTotal = wifiExact !== undefined ? wifiExact : (record.wifi?.meas || 0) + (record.wifi?.est || 0);
    const unknownTotal = (record.unknown?.meas || 0) + (record.unknown?.est || 0);

    let badge = 'Measured';
    let badgeType: 'exact' | 'est' | 'meas' | 'none' = 'meas';

    if (isExact) {
      badge = 'Exact';
      badgeType = 'exact';
    } else if (mobileEst > 0 || (record.wifi?.est || 0) > 0 || (record.unknown?.est || 0) > 0) {
      badge = 'Estimated';
      badgeType = 'est';
    }

    const prefix = !isExact && mobileEst > 0 ? '~' : '';

    return {
      hasRecord: true,
      mobileDisplay: `${prefix}${formatDataBytes(mobileTotal)}`,
      wifiDisplay: formatDataBytes(wifiTotal),
      unknownDisplay: formatDataBytes(unknownTotal),
      badge,
      badgeType
    };
  };

  // Month card metrics aggregated for current month
  const currentMonthMetrics = useMemo(() => {
    if (monthRecordsWithData.length === 0) {
      return {
        hasRecord: false,
        mobileDisplay: 'No data',
        wifiDisplay: 'No data',
        unknownDisplay: 'No data',
        badge: null,
        badgeType: 'none' as const
      };
    }

    let mobileTotal = 0;
    let wifiTotal = 0;
    let unknownTotal = 0;
    let hasExact = false;
    let hasEst = false;

    for (const { record } of monthRecordsWithData) {
      if (record.exact?.mobile !== undefined) {
        mobileTotal += record.exact.mobile;
        hasExact = true;
      } else {
        mobileTotal += (record.mobile?.meas || 0) + (record.mobile?.est || 0);
      }

      if (record.exact?.wifi !== undefined) {
        wifiTotal += record.exact.wifi;
        hasExact = true;
      } else {
        wifiTotal += (record.wifi?.meas || 0) + (record.wifi?.est || 0);
      }

      unknownTotal += (record.unknown?.meas || 0) + (record.unknown?.est || 0);

      if ((record.mobile?.est || 0) > 0 || (record.wifi?.est || 0) > 0 || (record.unknown?.est || 0) > 0) {
        hasEst = true;
      }
    }

    const badge = hasExact ? 'Exact' : hasEst ? 'Estimated' : 'Measured';
    const badgeType = hasExact ? 'exact' : hasEst ? 'est' : 'meas';
    const prefix = !hasExact && hasEst ? '~' : '';

    return {
      hasRecord: true,
      mobileDisplay: `${prefix}${formatDataBytes(mobileTotal)}`,
      wifiDisplay: formatDataBytes(wifiTotal),
      unknownDisplay: formatDataBytes(unknownTotal),
      badge,
      badgeType
    };
  }, [monthRecordsWithData]);

  const todayCard = getCardMetrics(todayRecord);
  const yesterdayCard = getCardMetrics(yesterdayRecord);

  // Month name helper
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Format date key for display
  const formatFriendlyDate = (dateKey: string) => {
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateKey;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] font-semibold">
              // NETWORK TELEMETRY
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase',
                currentBucket === 'mobile'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : currentBucket === 'wifi'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'
              )}
            >
              Current: {currentBucket}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
            Data Usage
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Real network metrics with source verification (Exact, Measured, and Estimated).
          </p>
        </div>

        {/* Clear History Button */}
        {!isCompletelyEmpty && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border-color)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Unknown Connection Notice Banner */}
      {isPredominantlyUnknown && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-200">
          <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-amber-300">
              Browser Network Information Limitation
            </p>
            <p className="mt-0.5 text-amber-200/90">
              This browser can't tell mobile data from Wi-Fi, so usage is shown as Unknown. Install the Android app for exact mobile-data numbers.
            </p>
          </div>
        </div>
      )}

      {/* Empty State Banner (if no records exist yet) */}
      {isCompletelyEmpty && (
        <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)] shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Data counter is active
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Tracking starts from today. As you play tracks, search music, and browse lyrics, usage will be recorded live below.
            </p>
          </div>
        </div>
      )}

      {/* Three Summary Cards (Today, Yesterday, This Month) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Today Card */}
        <div className="p-4.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex flex-col justify-between relative overflow-hidden shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Today
              </span>
              {todayCard.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-mono font-medium',
                    todayCard.badgeType === 'exact'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25'
                  )}
                >
                  {todayCard.badgeType === 'est' ? '~ Estimated' : todayCard.badge}
                </span>
              )}
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {todayCard.mobileDisplay}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                Mobile data
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
            {todayCard.hasRecord ? (
              <span>
                Wi-Fi {todayCard.wifiDisplay} • Unknown {todayCard.unknownDisplay}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">No data recorded today</span>
            )}
          </div>
        </div>

        {/* Yesterday Card */}
        <div className="p-4.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex flex-col justify-between relative overflow-hidden shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Yesterday
              </span>
              {yesterdayCard.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-mono font-medium',
                    yesterdayCard.badgeType === 'exact'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25'
                  )}
                >
                  {yesterdayCard.badgeType === 'est' ? '~ Estimated' : yesterdayCard.badge}
                </span>
              )}
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {yesterdayCard.mobileDisplay}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                Mobile data
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
            {yesterdayCard.hasRecord ? (
              <span>
                Wi-Fi {yesterdayCard.wifiDisplay} • Unknown {yesterdayCard.unknownDisplay}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">No data recorded yesterday</span>
            )}
          </div>
        </div>

        {/* This Month Card */}
        <div className="p-4.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] flex flex-col justify-between relative overflow-hidden shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                This Month
              </span>
              {currentMonthMetrics.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-mono font-medium',
                    currentMonthMetrics.badgeType === 'exact'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25'
                  )}
                >
                  {currentMonthMetrics.badgeType === 'est' ? '~ Estimated' : currentMonthMetrics.badge}
                </span>
              )}
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {currentMonthMetrics.mobileDisplay}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                Mobile data
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
            {currentMonthMetrics.hasRecord ? (
              <span>
                Wi-Fi {currentMonthMetrics.wifiDisplay} • Unknown {currentMonthMetrics.unknownDisplay}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">No data recorded this month</span>
            )}
          </div>
        </div>
      </div>

      {/* Month Calendar Card */}
      <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border-color)] shadow-sm">
        {/* Calendar Navigation Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {monthName}
            </h2>
            {isCurrentMonth && (
              <span className="px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] text-[10px] font-mono text-[var(--accent)] border border-[var(--border-color)]">
                CURRENT
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border-color)] transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border-color)] transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header (Monday first) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pt-3 pb-2 text-[10px] sm:text-xs font-mono uppercase text-[var(--text-muted)]">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map((cell, idx) => {
            if (cell.dayNumber === 0) {
              return <div key={`empty-${idx}`} className="h-16 sm:h-20" />;
            }

            const hasRecord = cell.record !== null;
            const mobileBytes = hasRecord
              ? cell.record?.exact?.mobile !== undefined
                ? cell.record.exact.mobile
                : (cell.record?.mobile?.meas || 0) + (cell.record?.mobile?.est || 0)
              : 0;

            const hasEst = hasRecord && (cell.record?.mobile?.est || 0) > 0;

            // Compute relative heat intensity (0 to 1)
            const intensity =
              maxMobileBytesInMonth > 0 && mobileBytes > 0
                ? mobileBytes / maxMobileBytesInMonth
                : 0;

            // Heat background
            let heatClass = 'bg-[var(--surface-secondary)]/40 hover:bg-[var(--surface-secondary)]';
            if (hasRecord && intensity > 0) {
              if (intensity > 0.75) {
                heatClass = 'bg-[var(--accent)]/30 border-[var(--accent)]/45 text-[var(--accent)] font-semibold';
              } else if (intensity > 0.5) {
                heatClass = 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]';
              } else if (intensity > 0.25) {
                heatClass = 'bg-[var(--accent)]/12 border-[var(--accent)]/20';
              } else {
                heatClass = 'bg-[var(--accent)]/6 border-white/10';
              }
            }

            return (
              <button
                key={cell.dateKey}
                disabled={cell.isFuture}
                onClick={() => setSelectedDayKey(cell.dateKey)}
                className={cn(
                  'h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden',
                  cell.isToday
                    ? 'ring-2 ring-[var(--accent)] border-transparent'
                    : 'border-[var(--border-color)]',
                  cell.isFuture
                    ? 'opacity-25 cursor-not-allowed bg-[var(--surface-secondary)]/20'
                    : 'cursor-pointer',
                  !cell.isFuture && heatClass
                )}
              >
                {/* Day number & today marker */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      'text-xs sm:text-sm font-semibold',
                      cell.isToday ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)]'
                    )}
                  >
                    {cell.dayNumber}
                  </span>
                  {cell.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                </div>

                {/* Mobile Usage Number or dim '-' */}
                <div className="mt-auto">
                  {hasRecord ? (
                    <div className="truncate">
                      <p className="text-[10px] sm:text-xs font-mono font-medium truncate">
                        {hasEst ? '~' : ''}
                        {formatDataBytes(mobileBytes)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] opacity-40">
                      -
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Month Footer Stats */}
        <div className="mt-5 pt-4 border-t border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
            <span className="text-[10px] uppercase text-[var(--text-muted)] block">
              // MONTH TOTAL
            </span>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {monthStats.hasData
                ? `${monthStats.hasEst ? '~' : ''}${formatDataBytes(monthStats.totalMobileBytes)}`
                : 'No data'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
            <span className="text-[10px] uppercase text-[var(--text-muted)] block">
              // DAILY AVERAGE (ACTIVE DAYS)
            </span>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {monthStats.hasData
                ? `${monthStats.hasEst ? '~' : ''}${formatDataBytes(monthStats.dailyAverageMobileBytes)} / day`
                : 'No data'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
            <span className="text-[10px] uppercase text-[var(--text-muted)] block">
              // BUSIEST DAY
            </span>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {monthStats.busiestDay
                ? `${formatFriendlyDate(monthStats.busiestDay.dateKey).split(',')[0]} (${
                    monthStats.busiestDay.hasEst ? '~' : ''
                  }${formatDataBytes(monthStats.busiestDay.bytes)})`
                : 'No data'}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible "How this is measured" section */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] overflow-hidden">
        <button
          onClick={() => setIsHowItWorksOpen((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-[var(--accent)]" />
            <span>How this data is measured</span>
          </div>
          {isHowItWorksOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {isHowItWorksOpen && (
          <div className="px-5 pb-5 pt-1 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)] space-y-3 leading-relaxed">
            <p>
              Moodsonix tracks real network usage without sampling or invented metrics. Every number carries an explicit source indicator:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
                <span className="font-semibold text-emerald-400 font-mono text-[11px] block">
                  Exact (OS Stats)
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Read directly from Android's hardware traffic stats in the APK container.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
                <span className="font-semibold text-[var(--accent)] font-mono text-[11px] block">
                  Measured (Browser)
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Real byte counts received via the browser's PerformanceObserver for API calls and lyrics.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)]">
                <span className="font-semibold text-cyan-400 font-mono text-[11px] block">
                  ~ Estimated (Playback)
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Calculated from active playback duration multiplied by typical audio (128 kbps) and video quality stream bitrates.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-color)] mt-2">
              <span className="font-semibold text-[var(--text-primary)] block text-[11px]">
                What is NOT counted as measured:
              </span>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Due to web sandbox CORS boundaries, YouTube iframe media segments and third-party image thumbnails that withhold transfer headers cannot expose exact raw byte counts to web JavaScript. Their consumption is estimated from playback duration and resolution.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Day Details Bottom Sheet / Modal */}
      {selectedDayKey && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)]">
                  // DAY INSPECTION
                </span>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {formatFriendlyDate(selectedDayKey)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayKey(null)}
                className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet Body */}
            {selectedDayRecord ? (
              <div className="space-y-4 pt-4 text-xs">
                {/* Network breakdown table */}
                <div className="space-y-2">
                  <span className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                    // NETWORK SPLIT
                  </span>

                  {/* Mobile Row */}
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)]">
                    <div className="flex items-center justify-between font-semibold">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-amber-400" />
                        <span>Mobile Cellular</span>
                      </div>
                      <span className="font-mono text-sm">
                        {selectedDayRecord.mobile.est > 0 ? '~' : ''}
                        {formatDataBytes(
                          selectedDayRecord.exact?.mobile !== undefined
                            ? selectedDayRecord.exact.mobile
                            : selectedDayRecord.mobile.meas + selectedDayRecord.mobile.est
                        )}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                      <div>
                        Measured:{' '}
                        <span className="text-[var(--text-secondary)]">
                          {formatDataBytes(selectedDayRecord.mobile.meas)}
                        </span>
                      </div>
                      <div>
                        Estimated:{' '}
                        <span className="text-[var(--text-secondary)]">
                          ~{formatDataBytes(selectedDayRecord.mobile.est)}
                        </span>
                      </div>
                      {selectedDayRecord.exact?.mobile !== undefined && (
                        <div className="col-span-2 text-emerald-400">
                          Exact OS Hardware:{' '}
                          <span>{formatDataBytes(selectedDayRecord.exact.mobile)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wi-Fi Row */}
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)]">
                    <div className="flex items-center justify-between font-semibold">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-emerald-400" />
                        <span>Wi-Fi Network</span>
                      </div>
                      <span className="font-mono text-sm">
                        {selectedDayRecord.wifi.est > 0 ? '~' : ''}
                        {formatDataBytes(
                          selectedDayRecord.exact?.wifi !== undefined
                            ? selectedDayRecord.exact.wifi
                            : selectedDayRecord.wifi.meas + selectedDayRecord.wifi.est
                        )}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                      <div>
                        Measured:{' '}
                        <span className="text-[var(--text-secondary)]">
                          {formatDataBytes(selectedDayRecord.wifi.meas)}
                        </span>
                      </div>
                      <div>
                        Estimated:{' '}
                        <span className="text-[var(--text-secondary)]">
                          ~{formatDataBytes(selectedDayRecord.wifi.est)}
                        </span>
                      </div>
                      {selectedDayRecord.exact?.wifi !== undefined && (
                        <div className="col-span-2 text-emerald-400">
                          Exact OS Hardware:{' '}
                          <span>{formatDataBytes(selectedDayRecord.exact.wifi)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Unknown Row */}
                  <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)]">
                    <div className="flex items-center justify-between font-semibold">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>Unknown / Unclassified</span>
                      </div>
                      <span className="font-mono text-sm">
                        {selectedDayRecord.unknown.est > 0 ? '~' : ''}
                        {formatDataBytes(
                          selectedDayRecord.unknown.meas + selectedDayRecord.unknown.est
                        )}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                      <div>
                        Measured:{' '}
                        <span className="text-[var(--text-secondary)]">
                          {formatDataBytes(selectedDayRecord.unknown.meas)}
                        </span>
                      </div>
                      <div>
                        Estimated:{' '}
                        <span className="text-[var(--text-secondary)]">
                          ~{formatDataBytes(selectedDayRecord.unknown.est)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Playback Stats */}
                <div className="space-y-2 pt-2">
                  <span className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                    // PLAYBACK ACTIVITY
                  </span>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
                      <Clock className="w-4 h-4 mx-auto text-[var(--accent)] mb-1" />
                      <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {Math.floor((selectedDayRecord.secondsPlayed || 0) / 60)} min
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-mono mt-0.5">
                        Listened
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
                      <Music className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
                      <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {selectedDayRecord.songsPlayed || 0}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-mono mt-0.5">
                        Songs
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-center">
                      <Sliders className="w-4 h-4 mx-auto text-cyan-400 mb-1" />
                      <p className="font-mono text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">
                        {(() => {
                          const quals = selectedDayRecord.qualities || {};
                          const entries = Object.entries(quals);
                          if (entries.length === 0) return 'None';
                          entries.sort((a, b) => b[1] - a[1]);
                          const topQuality = entries[0][0];
                          return qualityLabel(topQuality);
                        })()}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-mono mt-0.5">
                        Top Quality
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                <p>No activity record exists for this day.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Clear History Dialog Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Clear Usage History?
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
              This will permanently delete all recorded daily telemetry from your device storage. It cannot be undone.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearHistory();
                  setShowClearConfirm(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-semibold text-white shadow-md transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
