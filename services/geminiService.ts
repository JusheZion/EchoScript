/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { invoke } from '@tauri-apps/api/core';
import { tempDir, join } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';
import { AudioSource, TranscriptionResponse } from '../types';

const extensionFromMimeType = (mimeType: string): string => {
  const ext = mimeType.split('/')[1]?.split(';')[0];
  return ext || 'webm';
};

// AudioRecorder produces an in-memory Blob (no filesystem path); write it to a
// temp file once so the Rust side only ever deals with real paths, never IPC bytes.
const resolveAudioPath = async (source: AudioSource): Promise<string> => {
  if (source.kind === 'path') {
    return source.path;
  }

  const bytes = new Uint8Array(await source.blob.arrayBuffer());
  const fileName = `echoscript-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFromMimeType(source.mimeType)}`;
  const filePath = await join(await tempDir(), fileName);
  await writeFile(filePath, bytes);
  return filePath;
};

export const transcribeAudio = async (source: AudioSource): Promise<TranscriptionResponse> => {
  const path = await resolveAudioPath(source);
  return invoke<TranscriptionResponse>('transcribe_audio', {
    path,
    mimeType: source.mimeType,
  });
};
