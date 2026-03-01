import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kassa Task Web",
  description: "Frontend for the kassa-task monorepo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
