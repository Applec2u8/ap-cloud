import React, { useRef, useState, useCallback } from 'react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

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

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${disabled ? '' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label="File drop zone"
      id="file-dropzone"
    >
      <input
        ref={inputRef}
        type="file"
        className="dropzone__input"
        onChange={onInputChange}
        disabled={disabled}
        id="file-input"
      />

      {selectedFile ? (
        <>
          <span className="dropzone__icon">📦</span>
          <div className="dropzone__title">File selected</div>
          <div className="dropzone__file-info">
            <span>📄</span>
            <strong>{selectedFile.name}</strong>
            <span style={{ color: 'var(--text-muted)' }}>({formatSize(selectedFile.size)})</span>
          </div>
          {!disabled && (
            <div className="dropzone__subtitle" style={{ marginTop: 12 }}>
              Click or drop another file to replace
            </div>
          )}
        </>
      ) : (
        <>
          <span className="dropzone__icon">☁️</span>
          <div className="dropzone__title">Drop your file here</div>
          <div className="dropzone__subtitle">
            Drag & drop or <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>click to browse</span>
            <br />
            <span style={{ fontSize: '0.8rem', marginTop: 4, display: 'block' }}>
              Supports .exe, .msi, .zip, .pkg and all other file types
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default DropZone;
