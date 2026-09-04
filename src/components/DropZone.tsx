import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const DropZone: React.FC<DropZoneProps> = ({ onFileSelected, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition-all duration-200',
        isDragging && 'border-blue-500 bg-blue-500/5 scale-[1.01] shadow-[0_0_0_4px_rgba(37,99,235,0.1)]',
        !disabled && !isDragging && 'hover:border-blue-400 hover:bg-blue-500/[0.03] cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label="File drop zone"
      id="file-dropzone"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
        id="file-input"
      />

      {selectedFile ? (
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl drop-shadow-[0_0_16px_rgba(37,99,235,0.5)]">📦</div>
          <div className="font-semibold text-foreground">File selected</div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
            <span>📄</span>
            <strong className="max-w-[240px] truncate">{selectedFile.name}</strong>
            <span className="text-muted-foreground">({formatSize(selectedFile.size)})</span>
          </div>
          {!disabled && (
            <p className="text-xs text-muted-foreground">Click or drop another file to replace</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <UploadCloud
            className={cn(
              'h-10 w-10 transition-colors duration-200',
              isDragging ? 'text-blue-500' : 'text-muted-foreground'
            )}
          />
          <div>
            <p className="font-semibold text-foreground">Drop your file here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag &amp; drop or{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">click to browse</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Supports .exe, .msi, .zip, .pkg and all other file types
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropZone;
