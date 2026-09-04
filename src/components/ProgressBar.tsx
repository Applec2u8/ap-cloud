import React from 'react';
import ReactDOM from 'react-dom';
import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return ReactDOM.createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-blue-300/30 bg-card p-4 shadow-2xl backdrop-blur-xl animate-fade-in">
      <div className="mb-2.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          {label ?? 'Uploading...'}
        </span>
        <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
          {clamped.toFixed(0)}%
        </span>
      </div>
      <Progress value={clamped} />
    </div>,
    document.body
  );
};

export default ProgressBar;
