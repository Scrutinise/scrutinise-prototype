import './globals.css';
import Navbar from '@/components/ui/Navbar';


export const metadata = {
title: 'Scrutinise',
description: 'Master legislation. Shape the nation.',
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className="bg-black text-white min-h-screen flex flex-col">
<Navbar />
<main className="flex-1">{children}</main>
<footer className="border-t border-gray-800 py-6 flex justify-between items-center px-10 text-gray-400 text-sm">
<div>Scrutinise</div>
<div className="flex gap-4">
<div className="w-5 h-5 bg-gray-600 rounded-full"></div>
<div className="w-5 h-5 bg-gray-600 rounded-full"></div>
<div className="w-5 h-5 bg-gray-600 rounded-full"></div>
</div>
</footer>
</body>
</html>
);
}