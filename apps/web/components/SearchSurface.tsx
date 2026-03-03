'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useApiKey } from '../context/ApiKeyContext';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_QUERY = 500;

export default function SearchSurface() {
  const { apiKey } = useApiKey();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pasteWarning, setPasteWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileError('File exceeds the 10MB size limit.');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasteWarning(false);
    setQuery(e.target.value.slice(0, MAX_QUERY));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text');
    if (pasted.length > MAX_QUERY) {
      e.preventDefault();
      setQuery(pasted.slice(0, MAX_QUERY));
      setPasteWarning(true);
    }
  }

  async function handleSubmit() {
    const formData = new FormData();
    if (image) formData.append('image', image);
    formData.append('userQuery', query);
    await apiFetch('/api/match', { method: 'POST', body: formData }, apiKey);
  }

  const canSubmit = !!image || query.trim() !== '';

  return (
    <main>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Preview" />
        ) : (
          'Drop image here or click to upload'
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-input"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        style={{ display: 'none' }}
      />
      {fileError && <p>{fileError}</p>}
      <input
        type="text"
        placeholder="Add details like color, style, or price range to refine results"
        value={query}
        onChange={handleQueryChange}
        onPaste={handlePaste}
      />
      <span>{query.length}/500</span>
      {pasteWarning && <p>Text truncated to 500 characters</p>}
      <button type="submit" onClick={handleSubmit} disabled={!canSubmit}>
        Search
      </button>
    </main>
  );
}
