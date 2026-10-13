// Fallback for /jobs. The page reads ?page=, which is only known at request time,
// so Next streams it in behind this boundary and prerenders this shell.
export default function Loading() {
  return (
    <main>
      <h1>Open Positions</h1>
      <p>Loading...</p>
    </main>
  );
}
