// Server entry for the small independent candidate.
import { renderToString } from "preact-render-to-string";
import { App } from "../fixtures/app.jsx";

export function render(interactive) {
  return renderToString(<App interactive={interactive} />);
}
