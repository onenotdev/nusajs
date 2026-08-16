// Client hydration entry for the React-compatible candidate.
import { hydrateRoot } from "react-dom/client";
import { App } from "../fixtures/app.jsx";

const island = document.querySelector("[data-island]");
if (island) {
  hydrateRoot(island.parentElement, <App interactive />);
}
