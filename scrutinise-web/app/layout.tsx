import './globals.css';
import Navbar from '../components/ui/Navbar';

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
      <body className="bg-black text-white min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 py-6">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 flex items-center justify-between text-sm text-gray-400">
            <span className="font-medium">Scrutinise</span>
            <div className="flex gap-4">
              <div className="w-5 h-5 rounded-full bg-gray-600/60" />
              <div className="w-5 h-5 rounded-full bg-gray-600/60" />
              <div className="w-5 h-5 rounded-full bg-gray-600/60" />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
