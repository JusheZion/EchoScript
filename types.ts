/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum Emotion {
  Happy = 'Happy',
  Sad = 'Sad',
  Angry = 'Angry',
  Neutral = 'Neutral'
}

export interface TranscriptionSegment {
  speaker: string;
  timestamp: string;
  content: string;
  language: string;
  language_code?: string;
  translation?: string;
  emotion?: Emotion;
}

export interface TranscriptionResponse {
  summary: string;
  segments: TranscriptionSegment[];
}

export type AppStatus = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export type AudioSource =
  | { kind: 'path'; path: string; name: string; mimeType: string }
  | { kind: 'blob'; blob: Blob; name: string; mimeType: string };
