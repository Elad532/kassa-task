'use client';

import Link from 'next/link';
import { useApiKey } from '../context/ApiKeyContext';

export default function NavBar() {
  const { apiKey, setApiKey } = useApiKey();

  return (
    <nav>
      <Link href="/">End User</Link>
      <Link href="/admin">Admin</Link>
      <input
        type="password"
        placeholder="Gemini API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
    </nav>
  );
}
