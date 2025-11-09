import Hero from './components/Hero';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-amber-600 mb-8">The 7 Stages to Better Law</h1>
          <div className="overflow-x-auto">
            <table className="mx-auto border border-gray-300 text-lg">
              <tbody>
                <tr>
                  <td className="border p-4 bg-amber-50 font-semibold">1<br/>IDEA</td>
                  <td className="border p-4 bg-amber-50 font-semibold">2<br/>REFINE</td>
                  <td className="border p-4 bg-amber-50 font-semibold">3<br/>LINK</td>
                  <td className="border p-4 bg-amber-50 font-semibold">4<br/>AMEND</td>
                  <td className="border p-4 bg-amber-50 font-semibold">5<br/>EVIDENCE</td>
                  <td className="border p-4 bg-amber-50 font-semibold">6<br/>ASSEMBLE</td>
                  <td className="border p-4 bg-amber-50 font-semibold">7<br/>PROMOTE</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}