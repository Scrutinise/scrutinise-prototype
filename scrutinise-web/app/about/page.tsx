export default function About() {
  const paragraphs = [
    `The core objective of "Scrutinise" is to improve the quality and implementation of legislation for a better country, improve the skill and experience of MPs so they can implement the changes they became MPs for and to improve the quality of debate amongst the wider public by giving people an opportunity to swap frustrations for actions as they contribute to proper scrutiny and improvement in quality of legislation as it is developed.`,

    `Alongside providing the tools and the training to improve the quality of legislation we will also campaign for the recognition by the leaders of our political parties and our country of the value of good legislation effectively implemented and efficiently executed. Those who burnish the reputation of parties and Government by delivering high quality legislation that achieves its end with minimal social, economic and political cost should be rewarded and incentivised as much as if not more than those taking on roles in the executive. When the right incentives are there we will be blessed with the best people on the job and the laws we deserve.`,

    `By shifting MPs’ focus towards legislation - both creation and scrutiny - this platform also gives MPs the tools to promote the work they are doing for their constituents and countrymen, restoring trust in politicians, making it publicly rewarding, and giving both those MOs and their voters a real stake in the Government without being a minister.`,

    `MPs and Councillors can build up sector expertise in a visible and provable way. By involving the electorate we switch their energy from anger to action. We build a wider appreciation and gratitude for the hard work done by ministers and a deeper appreciation for the problems and the depths of the issues from other parties – less slogans, more slog.`,

    `It should always be remembered that all legislation has a cost. It is incumbent on all legislators to attempt as best as possible to evaluate that cost and minimise it. It is easy to legislate for one good only for the cost of that legislation to be greater than the good it obtained. More legislation is not a good in itself, we must aim for better quality legislation as well as better outcomes for the country.`
  ];

  return (
    <main className="py-16 px-4">
      <article className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-900">About Scrutinise</h1>
        <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i} className="first-letter:text-2xl first-letter:font-bold first-letter:text-primary">
              {p}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}