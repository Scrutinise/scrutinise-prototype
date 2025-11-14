export default function RevolutHero() {
  return (
    <section className="pt-16 pb-24 bg-gradient-to-b from-black via-black to-neutral-950">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row items-center md:items-stretch gap-12">
          {/* TEXT SIDE (left) */}
          <div className="md:w-1/2 space-y-6 text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight">
              Master legislation. Shape the nation
            </h1>

            <p className="text-lg sm:text-xl text-gray-300">
              Turn any idea into Parliament-ready law in 5 stages...
            </p>

            <div className="flex flex-wrap gap-4 pt-4 justify-center md:justify-start">
              {/* Solid white button – bigger */}
              <button className="inline-flex items-center rounded-full bg-white text-black px-10 py-3.5 text-base font-semibold shadow-md hover:bg-gray-100 transition">
                Get started
              </button>

              {/* Black with white outline – bigger, alternating style */}
              <button className="inline-flex items-center rounded-full bg-black border border-white px-10 py-3.5 text-base font-semibold text-white hover:bg-white hover:text-black transition">
                Vote
              </button>
            </div>
          </div>

          {/* VIDEO SIDE (right) */}
          <div className="md:w-1/2 w-full">
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
