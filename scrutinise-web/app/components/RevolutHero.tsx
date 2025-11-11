export default function RevolutHero() {
  return (
    <section className="relative h-screen overflow-hidden bg-[#0A0A0A]">
      <div className="absolute !right-0 top-0 h-full w-1/2">
        <video
          src="/woman-in-library-by-candlelight.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-transparent" />
      </div>
      <div className="relative h-full flex items-center">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full">
          <div className="max-w-xl text-white">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Scrutiny is Power
            </h1>
            <p className="mt-6 text-xl md:text-2xl font-medium">
              Master legislation. Shape the nation.
            </p>
            <p className="mt-8 text-lg leading-relaxed">
              Turn any idea into Parliament-ready law in 5 stages...
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button className="px-8 py-4 bg-white text-[#6D28D9] font-semibold rounded-lg hover:bg-gray-100 transition">
                Create
              </button>
              <button className="px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-[#6D28D9] transition">
                Vote
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}