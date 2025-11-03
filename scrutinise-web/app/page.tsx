import { HomeClient } from './components/HomeClient';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex justify-between items-center p-6 bg-black/80 backdrop-blur">
        <h1 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>Scrutinise</h1>
        <HomeClient />
      </nav>

      <div className="flex flex-col items-center justify-center h-screen text-center px-6">
        <h1 className="text-6xl md:text-8xl font-bold mb-4" style={{ color: '#D4AF37' }}>Scrutinise</h1>
        <p className="text-xl md:text-2xl mb-8 text-gray-300">Master legislation. Shape the nation.</p>
        <HomeClient />
      </div>

      <div className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12" style={{ color: '#D4AF37' }}>The 7 Stages to Better Law</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          {['Idea', 'Refine', 'Link', 'Amend', 'Evidence', 'Assemble', 'Promote'].map((s, i) => (
            <div key={i} className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center">
              <div className="text-3xl font-bold" style={{ color: '#D4AF37' }}>{i + 1}</div>
              <div className="mt-2 text-sm uppercase tracking-wider">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}