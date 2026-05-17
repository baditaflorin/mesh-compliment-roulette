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

    await expect(b.locator(".compli-card")).toContainText("you rock bob");
    await expect(a.locator(".compli-card")).toContainText("thanks alice");
  } finally {
    await cleanup();
  }
});
