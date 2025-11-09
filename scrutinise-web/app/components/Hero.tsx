import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
              Scrutiny is Power
            </h1>
            <h2 className="text-2xl sm:text-3xl font-semibold text-primary">
              Master legislation. Shape the nation
            </h2>
            <p className="text-lg text-gray-600">
              Turn any idea into Parliament-ready law in 5 stages. You can either create your own starting with an idea and evolving it through to formal legislation ready to be voted on in Parliament (click "Create" below to start on this path) or you can vote on or amend other people's ideas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/general">
                <button className="px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-light">
                  Create
                </button>
              </Link>
              <Link href="/general">
                <button className="px-8 py-3 border border-primary text-primary font-medium rounded-lg hover:bg-primary hover:text-white">
                  Vote
                </button>
              </Link>
            </div>
          </div>
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
            <video
              src="/woman-in-library-by-candlelight.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}