import { ClerkWrapper } from '../components/ClerkWrapper.client';
import Navbar from '../components/ui/Navbar';
import '../globals.css';

export const metadata = {
  title: 'Scrutinise - Master legislation. Shape the nation.',
  description: 'Turn any idea into Parliament-ready law in 5 stages.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-blue-500 antialiased">
        <ClerkWrapper>
          <Navbar />
          {children}
        </ClerkWrapper>
      </body>
    </html>
  );
}