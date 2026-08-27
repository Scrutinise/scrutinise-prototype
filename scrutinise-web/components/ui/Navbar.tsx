'use client';

import Link from 'next/link';

const links = [
  // 25-F §9 — creation entry; the door behind /ideas/new is a PlatformConfig row.
  //
  // ⚠ 25-J §2 — "MY IDEAS", NOT "CREATE". The page behind this is no longer a form to fill
  // once; it is where a user lives. A nav item named for an action sends someone who wants
  // to find yesterday's work looking somewhere else.
  //
  // ⚠ AND THIS IS THE NAV LABEL, NOT THE STAGE. `STAGE_1` is still called Create
  // (Create/Draft/Develop/Campaign/Legislate — docs/CLAUDE.md §4, "use exactly, never
  // substitute"). Renaming the stage would break the vocabulary the whole product shares.
  { label: 'My ideas', href: '/ideas/new' },
  { label: 'Browse', href: '/prototype/browse' },
  { label: 'Training', href: '/training' },
  { label: 'About', href: '/about' },
];

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
            {links.map((link) => (
              <Link key={link.label} href={link.href} className="navbar-center-link">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* RIGHT — Auth pills */}
<div className="navbar-auth">
  <Link href="/sign-in" className="nav-pill-auth-primary">
    Log in
  </Link>
  <Link href="/sign-up" className="nav-pill-auth-secondary">
    Sign up
  </Link>
</div>
      </nav>
    </header>
  );
}
