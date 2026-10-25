import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "../update.sh");

const BEGIN = "# --- BEGIN game port binding (tested) ---";
const END = "# --- END game port binding (tested) ---";

function extractBindingBlock(): string {
  const source = fs.readFileSync(SCRIPT, "utf8");
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Could not find the game port binding markers in ${SCRIPT}`,
    );
  }
  return source.slice(start + BEGIN.length, end);
}

function portPublication(bindIp: string, port: string): string {
  const script =
    `GAME_BIND_IP='${bindIp}'\nGAME_PORT='${port}'\n` +
    `${extractBindingBlock()}\nprintf '%s' "$PORT_PUBLICATION"\n`;
  return execFileSync("bash", ["-c", script], { encoding: "utf8" });
}

describe("update.sh Tailscale port binding", () => {
  it("binds the game port only to the configured Tailscale address", () => {
    expect(portPublication("100.64.0.2", "8080")).toBe("100.64.0.2:8080:80");
  });

  it("uses the configured port for Nginx to reach the game container", () => {
    expect(portPublication("100.100.10.20", "18080")).toBe(
      "100.100.10.20:18080:80",
    );
  });
});
