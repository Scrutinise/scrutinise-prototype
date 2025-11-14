import { ClerkWrapper } from './components/ClerkWrapper.client';
import Navbar from './components/ui/Navbar';
import RevolutHero from './components/RevolutHero';

export default function HomePage() {
  return (
    <ClerkWrapper>
      <Navbar />
      <RevolutHero />
    </ClerkWrapper>
  );
}