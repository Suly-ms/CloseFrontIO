import fs from "fs";
import type { LitElement } from "lit";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { DesktopNavBar } from "../../src/client/components/DesktopNavBar";
import { MobileNavBar } from "../../src/client/components/MobileNavBar";
import { PlayPage } from "../../src/client/components/PlayPage";

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
  });
}

async function mount<T extends LitElement>(element: T): Promise<T> {
  document.body.appendChild(element);
  await element.updateComplete;
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("Removed top-level pages", () => {
  it("omits Store, Inventory, Leaderboard, and Clans from both nav bars", async () => {
    const desktop = await mount(new DesktopNavBar());
    const mobile = await mount(new MobileNavBar());
    for (const page of [
      "page-item-store",
      "page-inventory",
      "page-leaderboard",
      "page-clan",
    ]) {
      expect(desktop.querySelector(`[data-page="${page}"]`)).toBeNull();
      expect(mobile.querySelector(`[data-page="${page}"]`)).toBeNull();
    }
  });

  it("removes cosmetic and flag selectors from the play page", async () => {
    const play = await mount(new PlayPage());
    expect(play.querySelector("cosmetics-input")).toBeNull();
    expect(play.querySelector("flag-input")).toBeNull();
    expect(play.querySelector("username-input")).toBeTruthy();
  });

  it("does not register the removed pages as URL-routed pages", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/client/Main.ts"),
      "utf8",
    );
    for (const route of ["store", "inventory", "leaderboard", "clan"]) {
      expect(source).not.toContain(`modalRouter.register("${route}"`);
    }
  });
});
