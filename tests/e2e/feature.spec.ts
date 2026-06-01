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

    // Wait for both names to propagate across the mesh: the start button only
    // enables once each peer sees ≥2 named peers (web-first, no fixed sleep).
    const aStart = a.getByRole("button", { name: "start round", exact: true });
    await expect(aStart).toBeEnabled();
    await expect(b.getByRole("button", { name: "start round", exact: true })).toBeEnabled();

    await aStart.click();

    // The phase transition to "writing" syncs to B; its target banner appears.
    await expect(a.getByText(/write something kind for/i)).toBeVisible();
    await expect(b.getByText(/write something kind for/i)).toBeVisible();

    await a.getByPlaceholder("say something kind…").fill("you rock bob");
    await a.getByRole("button", { name: "seal", exact: true }).click();
    await b.getByPlaceholder("say something kind…").fill("thanks alice");
    await b.getByRole("button", { name: "seal", exact: true }).click();

    // Both seals land in the shared doc — each peer should see "2 of 2 sealed"
    // before anyone reveals (cross-peer commit count, no fixed sleep).
    await expect(a.getByText(/2 of 2 sealed/)).toBeVisible();
    await expect(b.getByText(/2 of 2 sealed/)).toBeVisible();

    await a.getByRole("button", { name: "reveal all", exact: true }).click();
    // Reveal is auto-triggered on the phase transition; web-first assertions
    // below poll until the revealed cards land on each opposite peer.

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
