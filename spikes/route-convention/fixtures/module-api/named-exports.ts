// FW-004 module API candidate: named exports.
//
// Route configuration is a set of top-level named exports with literal initialisers.
// The compiler reads them from the syntax tree; nothing is executed.

export const route = {
  runtime: "server",
  rendering: "streaming",
  revalidate: 60
};

export const params = {
  slug: "string"
};

export async function loader() {
  return { title: "Hello" };
}

export default function Page() {
  return null;
}
