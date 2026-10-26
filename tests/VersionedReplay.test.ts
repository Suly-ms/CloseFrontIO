import {
  findVersionedShell,
  isReplayShellHost,
  versionedReplayUrl,
} from "../src/client/VersionedReplay";

describe("versionedReplayUrl", () => {
  test("builds the canonical replay URL from the audience and game id", () => {
    expect(versionedReplayUrl("closefront.io", "abcd1234")).toBe(
      "https://replay.closefront.io/abcd1234",
    );
    expect(versionedReplayUrl("closefront.dev", "abcd1234")).toBe(
      "https://replay.closefront.dev/abcd1234",
    );
  });

  test("returns null in dev (localhost or empty audience)", () => {
    expect(versionedReplayUrl("localhost", "abcd1234")).toBeNull();
    expect(versionedReplayUrl("", "abcd1234")).toBeNull();
  });
});

describe("isReplayShellHost", () => {
  test("matches the hostname of a generated replay URL (loop guard)", () => {
    const url = versionedReplayUrl("closefront.io", "abcd1234");
    expect(url).not.toBeNull();
    expect(isReplayShellHost(new URL(url!).hostname)).toBe(true);
  });

  test.each([
    "closefront.io",
    "main.closefront.dev",
    "localhost",
    "cdn.ofedge.dev",
  ])("does not match ordinary app hosts (%s)", (hostname) => {
    expect(isReplayShellHost(hostname)).toBe(false);
  });
});

describe("findVersionedShell", () => {
  const html = () =>
    new Response("", { headers: { "content-type": "text/html" } });

  test("the shell's URL once the probe finds it served", async () => {
    const fetchFn = vi.fn(async () => html());
    expect(
      await findVersionedShell(
        "closefront.io",
        "abcd1234",
        "closefront.io",
        fetchFn,
      ),
    ).toBe("https://replay.closefront.io/abcd1234");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://replay.closefront.io/abcd1234",
      { method: "HEAD" },
    );
  });

  test("no shell: missing, not a page, or unreachable", async () => {
    for (const fetchFn of [
      async () => new Response("", { status: 404 }),
      async () =>
        new Response("", { headers: { "content-type": "application/json" } }),
      async (): Promise<Response> => {
        throw new TypeError("offline");
      },
    ]) {
      expect(
        await findVersionedShell(
          "closefront.io",
          "abcd1234",
          "closefront.io",
          fetchFn,
        ),
      ).toBeNull();
    }
  });

  test("not probed in dev, or from a shell (it would loop)", async () => {
    const fetchFn = vi.fn(async () => html());
    expect(
      await findVersionedShell("localhost", "abcd1234", "localhost", fetchFn),
    ).toBeNull();
    expect(
      await findVersionedShell(
        "closefront.io",
        "abcd1234",
        "replay.closefront.io",
        fetchFn,
      ),
    ).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
