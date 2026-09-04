import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="progress-wrapper">
      <div className="progress-label">
        <span>{label ?? 'Uploading...'}</span>
        <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{clamped.toFixed(0)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;
