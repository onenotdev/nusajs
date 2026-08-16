// Client hydration entry for the small independent candidate.
import { hydrate } from "preact";
import { App } from "../fixtures/app.jsx";

const island = document.querySelector("[data-island]");
if (island) {
  hydrate(<App interactive />, island.parentElement);
}
