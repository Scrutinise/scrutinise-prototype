import Link from 'next/link';

export default function General() {
  return (
    <main className="py-24 px-4 text-center">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-gray-900">We haven&apos;t built this page yet</h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          This is a prototype — we&apos;re working hard to build it out. <br />
          We hope you like what we&apos;re doing, and that you&apos;ll sign up and help us build it in any small way you can.
        </p>
        <video
          src="/woman-in-library-by-candlelight.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full max-w-2xl mx-auto rounded-xl shadow-lg"
        />
        <Link href="/">
          <button className="px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition">
            Back to Home
          </button>
        </Link>
      </div>
    </main>
  );
}