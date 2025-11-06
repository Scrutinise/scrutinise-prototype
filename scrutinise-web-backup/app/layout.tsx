import { ClerkWrapper } from './components/ClerkWrapper.client';
import './globals.css';

export const metadata = {
  title: 'Scrutinise',
  description: 'Master legislation. Shape the nation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkWrapper>{children}</ClerkWrapper>
      </body>
    </html>
  );
}