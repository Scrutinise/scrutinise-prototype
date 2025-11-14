'use client';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 lg:px-8 py-3">
        {/* Logo */}
        <div className="text-lg font-semibold tracking-tight">
          Scrutinise
        </div>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <button className="hover:text-white transition-colors">Create</button>
          <button className="hover:text-white transition-colors">Vote</button>
          <button className="hover:text-white transition-colors">Training</button>
          <button className="hover:text-white transition-colors">Research</button>
          <button className="hover:text-white transition-colors">About</button>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3 text-sm">
          <button className="px-4 py-1.5 rounded-full border border-white/20 text-gray-100 hover:border-white hover:bg-white/5 transition">
            Log in
          </button>
          <button className="px-4 py-1.5 rounded-full bg-white text-black font-medium hover:bg-gray-100 transition">
            Sign up
          </button>
        </div>
      </nav>
    </header>
  );
}
