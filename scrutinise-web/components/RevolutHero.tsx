import Link from 'next/link'

export default function RevolutHero() {
  return (
    <section className="hero-section">
      <div className="hero-inner">
        {/* TEXT SIDE (left) */}
        <div className="hero-text">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight">
            Master legislation. Shape the nation
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-300">
            Turn any idea into Parliament-ready law in 5 stages...
          </p>

          {/* CTA buttons */}
          <div className="hero-cta-row">
            <button className="hero-cta-primary">Get started</button>
            <button className="hero-cta-secondary">Vote</button>
          </div>

          {/* Prototype link */}
          <div className="mt-4 flex items-center gap-3">
            <Link href="/prototype" className="hero-cta-secondary" style={{ padding: '0.6rem 1.8rem', fontSize: '0.9rem' }}>
              Explore the Prototype &#8594;
            </Link>
            <span className="text-xs text-gray-500">Interactive prototype — no account needed</span>
          </div>

          {/* Five Steps block */}
          <div className="hero-steps">
            <p className="hero-steps-heading">The Five Steps:</p>

            <p className="hero-step">
              <strong>Create</strong>
              <br />
              Define your idea with AI guidance
            </p>

            <p className="hero-step">
              <strong>Draft</strong>
              <br />
              Build out your idea with a few friends
            </p>

            <p className="hero-step">
              <strong>Develop</strong>
              <br />
              Add research, develop, private scrutiny, first 25 votes
            </p>

            <p className="hero-step">
              <strong>Campaign</strong>
              <br />
              Public & professional scrutiny, campaign for votes
            </p>

            <p className="hero-step">
              <strong>Parliament</strong>
              <br />
              Government Agenda and Parliamentary scrutiny
            </p>
          </div>
        </div>

        {/* VIDEO SIDE (right) */}
        <div className="hero-video">
          <video
            src="/woman-in-library-by-candlelight.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="video-mask-left"
          />
        </div>
      </div>
    </section>
  );
}
