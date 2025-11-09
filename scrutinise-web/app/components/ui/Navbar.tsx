'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Create', href: '/general' },
  { name: 'Vote', href: '/general' },
  { name: 'Training', href: '/general' },
  { name: 'Research', href: '/general' },
  { name: 'About', href: '/about' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/Scrutinise-Logo-Negative.png"
              alt="Scrutinise"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="text-xl font-semibold text-gray-900">Scrutinise</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-primary transition"
              >
                {item.name}
              </Link>
            ))}
            <Link href="/general" className="text-sm font-medium text-primary">
              Login / Sign up
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/general"
              className="block px-4 py-3 text-sm font-medium text-primary"
              onClick={() => setMobileOpen(false)}
            >
              Login / Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}