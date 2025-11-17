'use client';

import Link from 'next/link';

const links = ['Create', 'Vote', 'Training', 'Research', 'About'];

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 w-full z-30 bg-transparent">
      <nav className="navbar-shell max-w-7xl mx-auto flex items-center justify-between">
        {/* LEFT — Scrutinise “logo” */}
        <div className="navbar-logo text-white">
          Scrutinise
        </div>

        {/* CENTER — Menu links */}
        <div className="navbar-center flex-1 flex justify-start">
          <div className="navbar-center-links">
            {links.map((label) => (
              <Link key={label} href="/" className="navbar-center-link">
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* RIGHT — Auth pills */}
        <div className="navbar-auth">
          <span className="nav-pill-auth-primary">Log in</span>
          <span className="nav-pill-auth-secondary">Sign up</span>
        </div>
      </nav>
    </header>
  );
}
