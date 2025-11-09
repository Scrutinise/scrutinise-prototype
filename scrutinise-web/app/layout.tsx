import { ClerkWrapper } from './components/ClerkWrapper.client';
import './globals.css';
import { Inter } from 'next/font/google';
import Navbar from './components/ui/Navbar';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en" className={inter.className}>
      <body className="bg-white">
        <ClerkWrapper>
          <Navbar />
          {children}
        </ClerkWrapper>
      </body>
    </html>
  );
}