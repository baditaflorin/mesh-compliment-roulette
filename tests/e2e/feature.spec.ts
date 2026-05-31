import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("write + seal + reveal round-trips between peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(700);

    await a.getByRole("button", { name: "start round", exact: true }).click();
    await b.waitForTimeout(400);

    await a.getByPlaceholder("say something kind…").fill("you rock bob");
    await a.getByRole("button", { name: "seal", exact: true }).click();
    await b.getByPlaceholder("say something kind…").fill("thanks alice");
    await b.getByRole("button", { name: "seal", exact: true }).click();
    await b.waitForTimeout(400);

    await a.getByRole("button", { name: "reveal all", exact: true }).click();
    await b.waitForTimeout(1200); // auto-reveal on phase change

    // Cross-peer text round-trip: A's sealed compliment surfaces on B and
    // vice-versa (each peer reads on the OPPOSITE peer from the author).
    await expect(b.locator(".compli-card")).toContainText("you rock bob");
    await expect(a.locator(".compli-card")).toContainText("thanks alice");

    // Fair-RNG PAIRWISE routing (not broadcast): each peer sees exactly one
    // card, and the two cards are addressed to DIFFERENT recipients — A's card
    // to A, B's card to B. A broadcast bug (everyone sees every compliment) or
    // a single-recipient bug (both cards addressed to the same peer) fails here.
    await expect(a.locator(".compli-card")).toHaveCount(1);
    await expect(b.locator(".compli-card")).toHaveCount(1);
    const aCardTo = await a.locator(".compli-card").first().getAttribute("data-to");
    const bCardTo = await b.locator(".compli-card").first().getAttribute("data-to");
    expect(aCardTo).toBeTruthy();
    expect(bCardTo).toBeTruthy();
    expect(bCardTo).not.toBe(aCardTo);

    // Anonymity — "revealed WITHOUT author labels". The compliment B reads was
    // authored by alice; B's card must NOT surface the author's display name.
    await expect(b.locator(".compli-card").first()).not.toContainText("alice");
    await expect(a.locator(".compli-card").first()).not.toContainText("bob");
  } finally {
    await cleanup();
  }
});
