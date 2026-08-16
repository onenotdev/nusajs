// Server entry for the React-compatible candidate.
import { renderToString } from "react-dom/server";
import { App } from "../fixtures/app.jsx";

export function render(interactive) {
  return renderToString(<App interactive={interactive} />);
}
