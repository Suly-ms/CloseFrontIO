import { describe, expect, it } from "vitest";
import {
  deriveServerHttpBase,
  deriveServerWsBase,
} from "../../src/client/ClientEnv";

// deriveServerHttpBase resolves the origin of the game server's *HTTP* API —
// the worker routes under /api (create_game, game/:id, game/:id/exists,
// game/:id/listing). It is the sibling of deriveServerWsBase: the two must
// always name the same server, because a lobby created on one host is only
// reachable over the socket on that same host.
//
// This is deliberately NOT the account/shop API (api.<audience>, see
// getApiBase) — that one is a separate service and derives from the audience.
describe("deriveServerHttpBase", () => {
  describe("web build (no injected serverHost) stays same-origin", () => {
    it("uses the document origin on https", () => {
      expect(deriveServerHttpBase(undefined, "https:", "closefront.io")).toBe(
        "https://closefront.io",
      );
    });

    it("uses the document origin on http (local dev keeps the port)", () => {
      expect(deriveServerHttpBase(undefined, "http:", "localhost:3000")).toBe(
        "http://localhost:3000",
      );
    });

    it("preserves the exact location.host (e.g. www vs apex)", () => {
      expect(
        deriveServerHttpBase(undefined, "https:", "www.closefront.io"),
      ).toBe("https://www.closefront.io");
    });

    it("treats an empty serverHost as absent (web fallback)", () => {
      expect(deriveServerHttpBase("", "https:", "closefront.io")).toBe(
        "https://closefront.io",
      );
    });
  });

  describe("explicit serverHost targets the real game server", () => {
    it("targets the packaged prod host over https", () => {
      expect(deriveServerHttpBase("closefront.io", "app:", "closefront")).toBe(
        "https://closefront.io",
      );
    });

    it("targets a branch-specific subdomain over https", () => {
      expect(
        deriveServerHttpBase("my-feature.closefront.dev", "app:", "closefront"),
      ).toBe("https://my-feature.closefront.dev");
    });

    it("never falls through to the desktop app:// origin", () => {
      // The bug this fixes: relative /api fetches resolved against
      // app://closefront, which serves local files and 404s every API route.
      expect(
        deriveServerHttpBase("closefront.io", "app:", "closefront"),
      ).not.toContain("closefront/");
    });

    it("ignores location entirely when a serverHost is configured", () => {
      expect(
        deriveServerHttpBase("closefront.io", "https:", "elsewhere.example"),
      ).toBe("https://closefront.io");
    });
  });

  // The invariant that matters once the client picks a server at runtime (the
  // planned /cluster.json lookup): whatever decides the host must move both
  // bases together, or lobbies get created on one server and played on another.
  describe("stays in lockstep with deriveServerWsBase", () => {
    it.each([
      [undefined, "https:", "closefront.io"],
      [undefined, "http:", "localhost:3000"],
      ["closefront.io", "app:", "closefront"],
      ["main.closefront.dev", "app:", "closefront"],
    ] as const)(
      "names the same host for (%s, %s, %s)",
      (serverHost, protocol, host) => {
        const http = new URL(deriveServerHttpBase(serverHost, protocol, host));
        const ws = new URL(deriveServerWsBase(serverHost, protocol, host));
        expect(http.host).toBe(ws.host);
        // ...and the same transport security, so an https page never talks to
        // a ws:// game server (mixed content) or vice versa.
        expect(http.protocol === "https:").toBe(ws.protocol === "wss:");
      },
    );
  });
});
