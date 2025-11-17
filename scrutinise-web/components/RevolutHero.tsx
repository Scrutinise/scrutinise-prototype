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

          {/* Five Steps block */}
          <div className="hero-steps">
            <p className="hero-steps-heading">The Five Steps:</p>

            <p className="hero-step">
              <strong>Stage 1</strong>
              <br />
              Choose: CREATE (a new piece of legislation) or VOTE on legislation
              created by others.
            </p>

            <p className="hero-step">
              <strong>Stage 2</strong>
              <br />
              Choose your area and outline your goal. Research existing
              legislation and put your idea in motion.
            </p>

            <p className="hero-step">
              <strong>Stage 3</strong>
              <br />
              Build support and refine. Get feedback, votes and amendments.
            </p>

            <p className="hero-step">
              <strong>Stage 4</strong>
              <br />
              Evolve your idea with professional support from lawyers and
              parliamentary draftsmen.
            </p>

            <p className="hero-step">
              <strong>Stage 5</strong>
              <br />
              Build support and votes for your final legislation.
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
