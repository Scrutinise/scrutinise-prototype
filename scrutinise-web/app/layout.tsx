import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import Script from 'next/script';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

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
      afterSignUpUrl="/onboarding"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en">
        <body className="min-h-screen">
          {children}
          {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
                strategy="afterInteractive"
              />
              <Script id="ga4-init" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}');
                `}
              </Script>
            </>
          )}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
