// Shared, renderer-agnostic fixture. Both candidates compile this exact file.
// The only thing that changes per candidate is where JSX and hooks come from,
// which is why this file is the DX evidence: portable source is portable.

import { useState } from "runtime-hooks";

const FEATURES = ["nested layouts", "streaming", "islands", "typed params", "server functions"];

export function Counter({ label }) {
  const [count, setCount] = useState(0);

  return (
    <button type="button" data-testid="counter" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  );
}

// A single hostile string exercised in text, attribute, and URL position. Both
// candidates must escape it. This is evidence for SEC-XSS-001 and SEC-XSS-003,
// not a sanitizer test: neither renderer claims to sanitize arbitrary HTML.
export const HOSTILE = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;

export function Hostile() {
  return (
    <section data-testid="hostile" title={HOSTILE}>
      <p>{HOSTILE}</p>
      <a href={`/search?q=${encodeURIComponent(HOSTILE)}`}>link</a>
    </section>
  );
}

export function App({ interactive }) {
  return (
    <main>
      <h1>Renderer evaluation</h1>
      <p>
        This tree is intentionally ordinary: text, attributes, a list, and one conditional
        interactive leaf. It is representative of a documentation or marketing page with a single
        island.
      </p>
      <ul>
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {interactive ? (
        <div data-island="counter">
          <Counter label="Clicks" />
        </div>
      ) : (
        <p data-testid="static">No interactivity on this page.</p>
      )}
      <Hostile />
    </main>
  );
}
