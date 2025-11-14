'use client';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 lg:px-8 py-3 text-white">
        {/* Logo */}
        <div className="text-lg font-semibold tracking-tight">
          Scrutinise
        </div>

        {/* Center nav links */}
        <div className="flex items-center gap-6 text-sm">
          {['Create', 'Vote', 'Training', 'Research', 'About'].map((item) => (
            <button
              key={item}
              className="bg-transparent border-0 px-0 py-0 text-gray-300 hover:text-white transition-colors"
            >
              {item}
            </button>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3 text-sm">
          <button className="px-4 py-1.5 rounded-full border border-white/30 text-gray-100 hover:border-white hover:bg-white/5 transition">
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
