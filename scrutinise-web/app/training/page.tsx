export default function Training() {
  return (
    <main className="py-16 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Training Hub</h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          Learn how to turn ideas into legislation. Videos coming soon.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-gray-100 border-2 border-dashed rounded-xl p-12 flex items-center justify-center text-gray-500 text-lg font-medium"
            >
              Video {i} — Coming Soon
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}