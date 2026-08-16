// Server entry for the compatibility candidate: React-shaped authoring API on
// the small runtime.
import { renderToString } from "preact-render-to-string";
import { App } from "../fixtures/app.jsx";

export function render(interactive) {
  return renderToString(<App interactive={interactive} />);
}
