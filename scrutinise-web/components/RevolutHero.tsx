export default function RevolutHero() {
  return (
    <section className="pt-12 pb-20 bg-gradient-to-b from-black via-black to-neutral-950">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* TEXT SIDE (left) */}
          <div className="flex-1 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight">
              Master legislation. Shape the nation
            </h1>

            <p className="text-lg sm:text-xl text-gray-300">
              Turn any idea into Parliament-ready law in 5 stages...
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              {/* Solid white button */}
              <button className="inline-flex items-center rounded-full bg-white text-black px-8 py-3 text-sm font-semibold shadow-sm hover:bg-gray-100 transition">
                Get started
              </button>

              {/* Outline / black button */}
              <button className="inline-flex items-center rounded-full border border-white px-8 py-3 text-sm font-semibold text-white bg-black hover:bg-white hover:text-black transition">
                Vote
              </button>
            </div>
          </div>

          {/* VIDEO SIDE (right) */}
          <div className="flex-1 w-full">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/60 aspect-[4/3]">
              <video
                src="/woman-in-library-by-candlelight.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover video-mask-left"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
