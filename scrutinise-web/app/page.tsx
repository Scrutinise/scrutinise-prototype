import Hero from './components/Hero';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-amber-600 mb-8">The 7 Stages to Better Law</h1>
          <div className="overflow-x-auto">
            <table className="mx-auto border border-gray-300 text-center">
  <tbody>
    <tr>
      {[1,2,3,4,5,6,7].map(i => (
        <td key={i} className="border p-6 bg-amber-50 text-amber-900 font-bold text-lg">
          {i}<br />
          {['IDEA','REFINE','LINK','AMEND','EVIDENCE','ASSEMBLE','PROMOTE'][i-1]}
        </td>
      ))}
    </tr>
  </tbody>
</table>
          </div>
        </div>
      </section>
    </main>
  );
}