import Link from "next/link";

const coreBeliefs = [
  {
    title: "Growth requires patience",
    body: "Great plans, like great gardens, take seasons. We plant today and harvest when the world is ready to be harvested.",
  },
  {
    title: "Everything is connected",
    body: "A single root can topple a fortress. We value the quiet work beneath the surface as much as the spectacle above it.",
  },
  {
    title: "Prune without remorse",
    body: "What no longer serves the vision is cut away. This applies to underperforming schemes and, occasionally, to heroes.",
  },
  {
    title: "Every minion can bloom",
    body: "We hire for ambition and train for the rest. Today's henchperson is tomorrow's mastermind.",
  },
];

export default function Home() {
  return (
    <main>
      <h1>The Garden</h1>

      <section>
        <h2>Our Mission</h2>
        <p>
          To cultivate a new world order, one carefully tended scheme at a time,
          and to give the ambitious, the overlooked, and the gloriously
          unscrupulous a place to flourish.
        </p>
      </section>

      <section>
        <h2>Core Beliefs</h2>
        <ul className="card-list">
          {coreBeliefs.map((belief) => (
            <li key={belief.title}>
              <h3>{belief.title}</h3>
              <p>{belief.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Join Us</h2>
        <p>
          <Link href="/jobs" className="button">
            Browse open positions
          </Link>
        </p>
      </section>
    </main>
  );
}
