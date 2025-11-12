import { ClerkWrapper } from './components/ClerkWrapper.client';
import './globals.css';
import Navbar from './components/ui/Navbar';

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
     <body className="font-sans bg-blue-500 antialiased">  {/* font-sans = Inter from Tailwind */}
        <ClerkWrapper>
          <Navbar />
          {children}
        </ClerkWrapper>
      </body>
    </html>
  );
}