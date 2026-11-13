import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-28 md:bottom-24 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-2xl backdrop-blur-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200',
            toast.type === 'error' &&
              'bg-red-950/95 border-red-500/40 text-red-100',
            toast.type === 'success' &&
              'bg-[var(--surface-elevated)]/95 border-[var(--accent)]/40 text-[var(--text-primary)]',
            toast.type === 'info' &&
              'bg-[var(--surface-elevated)]/95 border-[var(--border-color)] text-[var(--text-primary)]'
          )}
        >
          {toast.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          {toast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
          )}
          {toast.type === 'info' && (
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
          )}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
