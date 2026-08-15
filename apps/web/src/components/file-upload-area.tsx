'use client';

import {
  CloudArrowUpIn,
  FileText,
  TriangleExclamation,
} from '@gravity-ui/icons';
import { Button, ProgressBar, Spinner } from '@heroui/react';
import { useRef, useState } from 'react';

export const UPLOAD_ACCEPT =
  '.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.wav,.m4a,.mp4,.webm';

interface FileUploadAreaProps {
  isUploading: boolean;
  uploadProgress: number | null;
  uploadError: string | null;
  onUploadFiles: (files: File[]) => void;
}

export function FileUploadArea({
  isUploading,
  uploadProgress,
  uploadError,
  onUploadFiles,
}: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file) {
      return;
    }
    setSelectedFile(file);
    onUploadFiles(files);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    handleFiles(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (isUploading) {
      return;
    }
    handleFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      data-testid="file-upload-area"
      className={`flex flex-col gap-3 rounded-xl border-2 border-dashed border-border/60 bg-content1/40 p-4 transition-colors sm:p-5 ${
        isDragOver && !isUploading ? 'border-accent bg-accent/5' : ''
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isUploading) {
          setIsDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={UPLOAD_ACCEPT}
        onChange={handleInputChange}
      />

      <div className="flex flex-col items-center gap-2 text-center">
        <CloudArrowUpIn className="size-8 text-accent" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">
          Перетащите файл сюда или выберите его кнопкой ниже
        </p>
        <p className="text-xs text-muted">
          PDF, документы Office, аудио или видео до 50 МБ
        </p>
        <Button
          isPending={isUploading}
          isDisabled={isUploading}
          onPress={() => inputRef.current?.click()}
        >
          {({ isPending: loading }) => (
            <>
              {loading ? (
                <Spinner color="current" size="sm" aria-hidden="true" />
              ) : (
                <CloudArrowUpIn className="size-4" />
              )}
              {loading ? 'Загрузка…' : 'Загрузить файл'}
            </>
          )}
        </Button>
        {selectedFile ? (
          <span className="inline-flex max-w-full items-center gap-2 text-xs text-muted">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{selectedFile.name}</span>
          </span>
        ) : null}
      </div>

      {isUploading && uploadProgress !== null ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Загрузка «{selectedFile?.name}»</span>
            <span role="status">{uploadProgress}%</span>
          </div>
          <ProgressBar
            value={uploadProgress}
            color="accent"
            size="sm"
            aria-label="Прогресс загрузки файла"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      ) : null}

      {uploadError ? (
        <p
          role="alert"
          className="flex items-center justify-center gap-2 text-center text-sm text-danger"
        >
          <TriangleExclamation className="size-4 shrink-0" />
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}
