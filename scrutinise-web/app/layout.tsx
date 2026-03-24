import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Scrutinise — From Idea to Legislation',
    template: '%s — Scrutinise',
  },
  description:
    'A not-for-profit platform helping citizens develop policy ideas into Parliament-ready legislation.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'),
  openGraph: {
    siteName: 'Scrutinise',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en">
        <body className="min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
