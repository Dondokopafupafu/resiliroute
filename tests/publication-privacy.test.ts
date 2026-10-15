import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const scanner = resolve("scripts/check-public-files.mjs");
const anonymous = ["12345+fixture", "users.noreply.github.com"].join("@");
const personal = ["private-fixture", "invalid.test"].join("@");

function fixture(run: (directory: string, git: (args: string[]) => string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "resiliroute-privacy-"));
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe" });
  try {
    git(["init", "--initial-branch=main"]);
    git(["config", "user.name", "Privacy test"]);
    git(["config", "user.email", anonymous]);
    git(["config", "commit.gpgsign", "false"]);
    writeFileSync(join(directory, "README.md"), "Synthetic network.\n");
    git(["add", "."]);
    git(["commit", "-m", "Fixture baseline"]);
    run(directory, git);
  } finally {
    const absolute = resolve(directory);
    const allowed = resolve(tmpdir()) + sep;
    if (
      !absolute.startsWith(allowed) ||
      !absolute.split(sep).at(-1)?.startsWith("resiliroute-privacy-")
    ) {
      throw new Error("Refusing cleanup outside the fixture directory.");
    }
    rmSync(absolute, { recursive: true, force: true });
  }
}

function check(directory: string, args = ["--staged", "--history"]) {
  const result = spawnSync(process.execPath, [scanner, ...args], {
    cwd: directory,
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

// These checks launch several Git processes and scan complete fixture histories.
// Windows process startup can exceed Vitest's 5-second default under suite load.
describe("Publication privacy safeguards", { timeout: 15000 }, () => {
  it("accepts anonymous history and empty environment templates", () =>
    fixture((directory, git) => {
      writeFileSync(join(directory, ".env.example"), "OPENAI_API_KEY=\n");
      git(["add", "."]);
      expect(check(directory).status).toBe(0);
      expect(check(directory, ["--ref", "HEAD", "--history"]).status).toBe(0);
    }));

  it("blocks private files and sensitive values without printing those values", () =>
    fixture((directory, git) => {
      const token = "sk-" + "a".repeat(35);
      const profile = ["C:", "Users", "private-fixture", "Documents"].join("\\");
      writeFileSync(join(directory, "JUDGING.md"), "Internal preparation.\n");
      writeFileSync(join(directory, ".env.example"), `OPENAI_API_KEY=${token}\n`);
      writeFileSync(join(directory, "notes.txt"), `${personal}\n${profile}\n`);
      git(["add", "."]);
      const result = check(directory);
      expect(result.status).toBe(1);
      expect(result.output).toContain("Private or generated file path");
      expect(result.output).toContain("Personal email address");
      expect(result.output).toContain("Local user-profile path");
      for (const value of [token, personal, profile]) expect(result.output).not.toContain(value);
    }));

  it("checks both author and committer, including older commits", () =>
    fixture((directory, git) => {
      git(["config", "user.email", personal]);
      writeFileSync(join(directory, "README.md"), "Second fixture commit.\n");
      git(["add", "."]);
      git(["commit", "-m", "Fixture metadata"]);
      git(["config", "user.email", anonymous]);
      git(["commit", "--allow-empty", "-m", "Anonymous tip"]);
      const result = check(directory);
      expect(result.status).toBe(1);
      expect(result.output).toContain("Non-anonymous author email");
      expect(result.output).toContain("Non-anonymous committer email");
      expect(result.output).not.toContain(personal);
    }));

  it("detects a credential even after its file has been removed from the tip", () =>
    fixture((directory, git) => {
      const token = "sk-" + "b".repeat(35);
      writeFileSync(join(directory, "deleted.txt"), token);
      git(["add", "."]);
      git(["commit", "-m", "Fixture historical content"]);
      git(["rm", "deleted.txt"]);
      git(["commit", "-m", "Remove fixture file"]);
      const result = check(directory, ["--ref", "HEAD", "--history"]);
      expect(result.status).toBe(1);
      expect(result.output).toContain("OpenAI key");
      expect(result.output).not.toContain(token);
    }));

  it("checks commit messages without printing their sensitive content", () =>
    fixture((directory, git) => {
      const token = "sk-" + "c".repeat(35);
      git(["commit", "--allow-empty", "-m", `Fixture message ${token} ${personal}`]);
      const result = check(directory, ["--ref", "HEAD", "--history"]);
      expect(result.status).toBe(1);
      expect(result.output).toContain("commit metadata");
      expect(result.output).toContain("OpenAI key");
      expect(result.output).toContain("Personal email address");
      expect(result.output).not.toContain(token);
      expect(result.output).not.toContain(personal);
    }));
});
