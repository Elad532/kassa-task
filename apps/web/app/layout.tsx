import type { Metadata } from 'next';
import { ApiKeyProvider } from '../context/ApiKeyContext';
import NavBar from '../components/NavBar';

export const metadata: Metadata = {
  title: 'Kassa Task Web',
  description: 'Frontend for the kassa-task monorepo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiKeyProvider>
          <NavBar />
          {children}
        </ApiKeyProvider>
      </body>
    </html>
  );
}
