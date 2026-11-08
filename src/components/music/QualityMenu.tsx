import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { cn } from '../../lib/utils';
import { Check, Settings, Info } from 'lucide-react';
import { qualityLabel } from '../../lib/streamQuality';

interface QualityMenuProps {
  className?: string;
  onClose?: () => void;
}

const QUALITY_OPTIONS = [
  { id: 'auto', label: 'Auto (Recommended)', hint: 'Light on mobile data, normal on Wi-Fi', estData: 'Dynamic' },
  { id: 'tiny', label: 'Data Saver (144p)', hint: 'Lowest data usage', estData: 'Lowest' },
  { id: 'small', label: 'Low (240p)', hint: 'Light stream', estData: 'Low' },
  { id: 'medium', label: 'Normal (360p)', hint: 'Standard video quality', estData: 'Medium' },
  { id: 'large', label: 'High (480p)', hint: 'Clearer video', estData: 'High' },
  { id: 'hd720', label: 'HD (720p)', hint: 'High data use', estData: 'Very High' },
  { id: 'hd1080', label: 'Full HD (1080p)', hint: 'Highest data use', estData: 'Maximum' }
];

export const QualityMenu: React.FC<QualityMenuProps> = ({ className, onClose }) => {
  const { quality, setQuality, effectiveQuality, isVideoOpen } = usePlayer();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className={cn('w-72 p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl backdrop-blur-xl', className)}>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[var(--text-primary)]">
            // STREAM QUALITY
          </span>
        </div>
        <button
          onClick={() => setShowDisclaimer(!showDisclaimer)}
          title="Streaming note"
          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {showDisclaimer && (
        <div className="p-2 mb-2.5 rounded-lg bg-[var(--surface)] text-[11px] text-[var(--text-secondary)] leading-relaxed border border-[var(--border-color)]">
          YouTube no longer lets apps pick a quality directly, so Moodsonix sets it by sizing the player. YouTube makes the final call and the audio bitrate is always chosen by YouTube. Quality mainly affects the video, so with the video preview off the smallest video is used to save data.
        </div>
      )}

      <p className="px-1 pb-2 text-[11px] text-[var(--text-secondary)] leading-snug">
        {isVideoOpen
          ? `Requesting ${qualityLabel(effectiveQuality)} video`
          : `Video preview is off, so ${qualityLabel(effectiveQuality)} (lowest) is used to save data`}
      </p>

      <div className="space-y-1">
        {QUALITY_OPTIONS.map((opt) => {
          const isSelected = quality === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => {
                setQuality(opt.id);
                if (onClose) onClose();
              }}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors text-xs',
                isSelected
                  ? 'bg-[var(--surface-secondary)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.hint}</p>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)] ml-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
