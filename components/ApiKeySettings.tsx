/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KeyRound, X } from 'lucide-react';
import Button from './Button';

interface ApiKeySettingsProps {
  mode: 'onboarding' | 'manage';
  onClose?: () => void;
  onSaved: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ mode, onClose, onSaved }) => {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await invoke('set_gemini_api_key', { key: key.trim() });
      setKey('');
      onSaved();
      onClose?.();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save API key.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke('clear_gemini_api_key');
      onSaved();
      onClose?.();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to clear API key.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <KeyRound size={18} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {mode === 'onboarding' ? 'Add your Gemini API key' : 'Manage API key'}
            </h2>
          </div>
          {mode === 'manage' && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Your key is stored in the macOS Keychain and never leaves your device except to call Gemini directly.
          Get one at{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-700 dark:hover:text-slate-300"
          >
            aistudio.google.com/apikey
          </a>.
        </p>

        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your Gemini API key"
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-4">
          {mode === 'manage' && (
            <Button onClick={handleClear} variant="secondary" isLoading={saving} disabled={saving}>
              Clear key
            </Button>
          )}
          <Button onClick={handleSave} isLoading={saving} disabled={saving || !key.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
