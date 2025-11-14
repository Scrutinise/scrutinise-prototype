import './globals.css';

export const metadata = {
  title: 'Scrutinise - Master legislation. Shape the nation.',
  description: 'Turn any idea into Parliament-ready law in 5 stages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}