import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Scan publication candidates without ever printing credential values.
// This complements .gitignore and GitHub secret scanning; it is not a guarantee
// that every possible credential format can be recognized.
const staged = process.argv.includes("--staged");
const history = process.argv.includes("--history");
const refIndex = process.argv.indexOf("--ref");
const requestedRef = refIndex < 0 ? null : process.argv[refIndex + 1];
if (refIndex >= 0 && (!requestedRef || requestedRef.startsWith("-"))) {
  throw new Error("--ref requires a commit or branch.");
}
const git = (args, binary = false) =>
  execFileSync("git", args, {
    encoding: binary ? undefined : "utf8",
    maxBuffer: 110 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const target = git(["rev-parse", "--verify", `${requestedRef ?? "HEAD"}^{commit}`]).trim();
const treeFiles = (ref) =>
  git(["ls-tree", "-r", "-z", ref])
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, path] = entry.split("\t");
      const [, type, oid] = metadata.split(" ");
      if (type !== "blob") throw new Error("Submodules need a separate publication review.");
      return { path, oid };
    });
const files = requestedRef
  ? treeFiles(target)
  : git(
      staged
        ? ["ls-files", "--cached", "-z"]
        : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    )
      .split("\0")
      .filter(Boolean)
      .map((path) => ({ path, oid: null }));

const patterns = [
  ["OpenAI key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ["GitHub token", /\b(?:gh[opusr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["Private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ["Credential in URL", /https?:\/\/[^\s/:]+:[^\s/@]+@/g],
  ["Local user-profile path", /[A-Z]:[\\/]+Users[\\/]+[^\s\\/]+/gi],
  [
    "Hardcoded credential",
    /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_+/=-]{20,}["']/gi,
  ],
];
const privatePath =
  /(?:^|\/)(?:JUDGING\.md|\.env(?:\..*)?|\.envrc|\.npmrc|\.netrc|\.pypirc|\.git-credentials|id_rsa.*|id_ed25519.*|credentials[^/]*\.json|[^/]*\.credentials\.json|service-account[^/]*\.json)$|\.(?:pem|key|p12|pfx|jks|keystore)$|(?:^|\/)(?:private|\.aws|\.ssh|\.codex|\.claude|__pycache__|node_modules|\.next)\//i;
const anonymousEmail = /^[A-Za-z0-9+_.-]+@users\.noreply\.github\.com$/i;
const emailPattern = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const exampleEmail = /@(?:example\.(?:com|org|net)|[^@]+\.example)$/i;
const findings = [];
let bytes = 0;
const seen = new Set();
function scanText(value, location) {
  for (const [rule, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      findings.push({ ...location, rule, line: value.slice(0, match.index).split("\n").length });
    }
  }
  for (const match of value.matchAll(emailPattern)) {
    if (!anonymousEmail.test(match[0]) && !exampleEmail.test(match[0])) {
      findings.push({
        ...location,
        rule: "Personal email address",
        line: value.slice(0, match.index).split("\n").length,
      });
    }
  }
}
const commits = history ? git(["rev-list", target]).trim().split("\n").filter(Boolean) : [];
for (const commit of commits) {
  const [author, committer] = git(["show", "-s", "--format=%ae%n%ce", commit]).trim().split("\n");
  for (const [role, email] of [
    ["author", author],
    ["committer", committer],
  ]) {
    if (!anonymousEmail.test(email ?? "")) {
      findings.push({ commit: commit.slice(0, 12), rule: `Non-anonymous ${role} email` });
    }
  }
  // Secrets can be accidentally pasted into commit messages or display names,
  // even when all file contents and author email addresses are safe.
  scanText(git(["show", "-s", "--format=%an%n%cn%n%B", commit]), {
    commit: commit.slice(0, 12),
    scope: "commit metadata",
  });
  files.push(...treeFiles(commit));
}

for (const { path, oid } of files) {
  const identity = `${path}\0${oid ?? "working"}`;
  if (seen.has(identity)) continue;
  seen.add(identity);
  const isTemplate = path === ".env.example" || path === "env.example";
  if (!isTemplate && privatePath.test(path)) {
    findings.push({ path, rule: "Private or generated file path" });
  }
  const content = oid
    ? git(["cat-file", "blob", oid], true)
    : staged
      ? git(["show", `:${path}`], true)
      : readFileSync(path);
  bytes += content.length;
  if (content.length >= 95 * 1024 * 1024) {
    findings.push({ path, rule: "File exceeds publication size limit" });
  }
  if (content.includes(0)) continue;
  const value = content.toString("utf8");
  if (isTemplate && /^[ \t]*OPENAI_API_KEY[ \t]*=[ \t]*\S+/m.test(value)) {
    findings.push({ path, rule: "Environment template contains a value" });
  }
  scanText(value, { path });
}

console.log(
  JSON.stringify(
    {
      checkedFiles: seen.size,
      checkedCommits: commits.length,
      totalMiB: Math.round((bytes / 1024 / 1024) * 10) / 10,
      staged,
      findings,
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
