// Client hydration entry for the compatibility candidate. Note that this uses
// the React DOM API surface (`hydrateRoot`) provided by preact/compat.
import { hydrateRoot } from "preact/compat/client";
import { App } from "../fixtures/app.jsx";

const island = document.querySelector("[data-island]");
if (island) {
  hydrateRoot(island.parentElement, <App interactive />);
}
