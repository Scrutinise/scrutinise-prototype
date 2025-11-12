import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* REMOVE LOGO — DELETE THIS */}
          {/* <Link href="/" className="flex items-center space-x-3">
            <img src="/Scrutinise-Logo-Negative.png" alt="Scrutinise" width={40} height={40} />
            <span className="text-xl font-semibold text-gray-900">Scrutinise</span>
          </Link> */}

          {/* NEW MENU */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-primary transition">
              Home
            </Link>
            <Link href="/create" className="text-sm font-medium text-gray-600 hover:text-primary transition">
              Create
            </Link>
            <Link href="/vote" className="text-sm font-medium text-gray-600 hover:text-primary transition">
              Vote
            </Link>
            <Link href="/about" className="text-sm font-medium text-gray-600 hover:text-primary transition">
              About
            </Link>
          </div>

          <button className="md:hidden p-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu w-6 h-6" aria-hidden="true">
              <path d="M4 5h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 19h16"></path>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}