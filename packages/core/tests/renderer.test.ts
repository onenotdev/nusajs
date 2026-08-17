import { describe, expect, it } from "vitest";
import { defineRenderer } from "../src/index.js";

describe("renderer contract", () => {
  it("freezes a renderer descriptor and copies its capabilities", () => {
    const deliveries = new Set(["buffered"] as const);
    const render = async () => ({
      delivery: "buffered" as const,
      body: "<!doctype html>",
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      close: () => undefined
    });
    const renderer = defineRenderer({ id: "preact", deliveries, render });
    deliveries.add("buffered");

    expect(renderer).toEqual({ id: "preact", deliveries: new Set(["buffered"]), render });
    expect(Object.isFrozen(renderer)).toBe(true);
    expect(renderer.deliveries).not.toBe(deliveries);
  });

  it.each([
    "Preact",
    "with space",
    "",
    `a${"b".repeat(64)}`
  ])("rejects invalid renderer ID %s", (id) => {
    expect(() =>
      defineRenderer({
        id,
        deliveries: new Set(["buffered"]),
        render: async () => Promise.reject()
      })
    ).toThrow(/NUSA-CONFIG-0001/);
  });

  it("rejects empty and unsupported delivery declarations", () => {
    const render = async () => Promise.reject();
    expect(() => defineRenderer({ id: "test", deliveries: new Set(), render })).toThrow(
      /non-empty Set/
    );
    expect(() =>
      defineRenderer({ id: "test", deliveries: new Set(["invalid"]), render } as never)
    ).toThrow(/unsupported delivery/);
  });
});
