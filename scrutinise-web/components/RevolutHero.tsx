export default function RevolutHero() {
  return (
    <section className="pt-10 pb-20">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
          {/* Text side */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
              Master legislation. Shape the nation
            </h1>

            <p className="text-lg sm:text-xl text-gray-300">
              Turn any idea into Parliament-ready law in 5 stages...
            </p>

            <div className="flex flex-wrap gap-3 pt-4">
              <button className="inline-flex items-center rounded-full bg-white text-black px-6 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-100 transition">
                Get started
              </button>
              <button className="inline-flex items-center rounded-full border border-white/25 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition">
                Vote
              </button>
            </div>
          </div>

          {/* Video side */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 aspect-[4/3]">
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
