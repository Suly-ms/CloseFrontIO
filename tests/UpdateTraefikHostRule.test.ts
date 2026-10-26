import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "../update.sh");

const BEGIN = "# --- BEGIN traefik host rule (tested) ---";
const END = "# --- END traefik host rule (tested) ---";

function extractRuleBlock(): string {
  const source = fs.readFileSync(SCRIPT, "utf8");
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Could not find the Traefik host rule markers in ${SCRIPT}`,
    );
  }
  return source.slice(start + BEGIN.length, end);
}

function hostRuleFor(
  subdomain: string,
  domain: string,
  gameDomain?: string,
  gameHost?: string,
): string {
  const assignment =
    (gameDomain === undefined ? "" : `GAME_DOMAIN='${gameDomain}'\n`) +
    (gameHost === undefined ? "" : `GAME_HOST='${gameHost}'\n`);
  const script =
    `SUBDOMAIN='${subdomain}'\nDOMAIN='${domain}'\n${assignment}` +
    `${extractRuleBlock()}\nprintf '%s' "$TRAEFIK_HOST_RULE"\n`;
  return execFileSync("bash", ["-c", script], { encoding: "utf8" });
}

describe("update.sh legacy Traefik host rule", () => {
  it("emits a single host when GAME_DOMAIN is absent", () => {
    expect(hostRuleFor("main", "closefront.dev")).toBe(
      "Host(`main.closefront.dev`)",
    );
  });

  it("matches both page and game hosts when GAME_DOMAIN is set", () => {
    expect(hostRuleFor("main", "closefront.dev", "server.closefront.dev")).toBe(
      "Host(`main.closefront.dev`) || Host(`main.server.closefront.dev`)",
    );
  });

  it("accepts a machine-scoped game host", () => {
    expect(
      hostRuleFor(
        "blue",
        "closefront.dev",
        "server.closefront.dev",
        "blue.staging2.server.closefront.dev",
      ),
    ).toBe("Host(`blue.staging2.server.closefront.dev`)");
  });
});
