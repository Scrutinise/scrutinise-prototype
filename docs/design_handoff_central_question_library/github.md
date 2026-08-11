repo: Scrutinise/scrutinise-prototype
branch: Main
path: scrutinise-web

## Last sync
date: 2026-08-09T09:28:49Z

### Updated in this project
- Built the Central question library prototype on the repo's real tokens (DM Sans, navy `oklch(0.45 0.12 250)`, hairline borders, `max-w-6xl` stage).
- Upgrade direction applied per brief: cards at 12px radius, teal promoted from animation-only to live-state accent, tabular figures on all counts.
- Chrome rebuilt from `components/PublicNav.tsx`: real link set (Create, Browse, Support, About, Central), teal initials avatar, Sign out button, hamburger under md.
- Community items (Questions / Board / Training / Leaderboard) added as sub-tabs beneath the real header.

## Screen map
| Project screen | Repo files it was built from |
| --- | --- |
| All screens (tokens, type, buttons, cards) | `scrutinise-web/app/globals.css`, `scrutinise-web/tailwind.config.js`, `scrutinise-web/components/ui/button.tsx`, `scrutinise-web/components/ui/card.tsx` |
| Signed-in header (nav links, avatar, sign out, mobile menu) | `scrutinise-web/components/PublicNav.tsx`, `scrutinise-web/app/dashboard/page.tsx` |
| Central chrome, sub-tabs, page shell | `scrutinise-web/app/communities/[id]/CommunityDashboardClient.tsx`, `scrutinise-web/app/communities/[id]/page.tsx` |
| Vote controls, signed counts, period selects | `scrutinise-web/app/communities/[id]/Leaderboards.tsx` |
| Empty states, request/invite copy patterns | `scrutinise-web/app/communities/[id]/BulletinBoard.tsx` |
