/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, FileAudio, X } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { AudioSource } from '../types';

interface FileUploaderProps {
  onFileSelected: (audioSource: AudioSource) => void;
  disabled?: boolean;
}

const AUDIO_VIDEO_EXTENSIONS = [
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'weba', 'webm',
  'mp4', 'mov', 'avi', 'mkv', '3gp',
];

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  weba: 'audio/webm',
  webm: 'audio/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
};

const guessMimeType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] || 'application/octet-stream';
};

const baseName = (path: string): string => path.split(/[/\\]/).pop() || path;

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelected, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningInTauri = isTauri();

  const processBlob = (file: File) => {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      alert("Please upload a valid audio/video file.");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert("File size exceeds 500MB limit.");
      return;
    }

    setFileName(file.name);
    onFileSelected({ kind: 'blob', blob: file, name: file.name, mimeType: file.type });
  };

  const processPath = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (!AUDIO_VIDEO_EXTENSIONS.includes(ext)) {
      alert("Please upload a valid audio/video file.");
      return;
    }

    const name = baseName(path);
    setFileName(name);
    onFileSelected({ kind: 'path', path, name, mimeType: guessMimeType(path) });
  };

  // Native drag-and-drop: Tauri v2 intercepts OS-level file drops before they
  // reach the DOM, so the HTML5 dataTransfer handlers never fire in-app.
  useEffect(() => {
    if (!runningInTauri) return;

    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (disabled) return;
        if (event.payload.type === 'over') {
          setDragActive(true);
        } else if (event.payload.type === 'drop') {
          setDragActive(false);
          const path = event.payload.paths[0];
          if (path) processPath(path);
        } else {
          setDragActive(false);
        }
      })
      .then((fn) => { unlisten = fn; });

    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningInTauri, disabled]);

  const openNativeDialog = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Audio/Video', extensions: AUDIO_VIDEO_EXTENSIONS }],
    });
    if (typeof selected === 'string') {
      processPath(selected);
    }
  }, []);

  const handleActivate = () => {
    if (disabled) return;
    if (runningInTauri) {
      openNativeDialog();
    } else {
      inputRef.current?.click();
    }
  };

  // Browser fallback (plain `vite dev`, no Tauri runtime) for fast UI iteration.
  const handleDrag = (e: React.DragEvent) => {
    if (runningInTauri) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (runningInTauri) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processBlob(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processBlob(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <div className="w-full">
      {!runningInTauri && (
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="audio/*,video/*"
          onChange={handleChange}
          disabled={disabled}
        />
      )}

      {!fileName ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload audio file"
          className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition-all outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 ${
            dragActive
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
        >
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-full mb-4">
            <UploadCloud size={32} />
          </div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-1">
            Click to upload or drag & drop
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            MP3, WAV, M4A, WEBM (Max 500MB)
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex items-center justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileAudio size={24} />
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-md">{fileName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ready to transcribe</p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={disabled}
            aria-label="Remove file"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
