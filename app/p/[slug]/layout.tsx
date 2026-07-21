import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function CoachPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Intentionally minimal — no STRYV nav, no sidebar, no global chrome
  return <>{children}</>;
}
