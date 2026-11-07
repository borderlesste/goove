import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const run = (command, args) => execFileSync(command, args, { stdio: "pipe" });

export function installFile(root, relative, data, previous, installed) {
  assert(!path.isAbsolute(relative) && !relative.split("/").includes(".."));
  const destination = path.join(root, relative);
  const digest = hash(data);
  if (fs.existsSync(destination)) {
    const current = hash(fs.readFileSync(destination));
    assert(
      current === digest || current === previous[relative],
      `Local edits preserved: review ${relative} before reinstalling.`,
    );
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, data);
  installed[relative] = digest;
}

export function verifyInstallation(root) {
  const lock = readJson(path.join(root, "dev-tools.lock.json"));
  const inventory = readJson(path.join(root, "dev-tools.installed.json"));
  assert.deepEqual(
    inventory.sources,
    lock.sources.map(({ id, revision }) => ({ id, revision })),
  );
  assert(Object.keys(inventory.files).length > 0, "Missing tool inventory.");
  for (const [relative, digest] of Object.entries(inventory.files)) {
    assert(!path.isAbsolute(relative) && !relative.split("/").includes(".."));
    assert.equal(
      hash(fs.readFileSync(path.join(root, relative))),
      digest,
      `Modified tool file: ${relative}`,
    );
  }
  return Object.keys(inventory.files).length;
}

function snapshot(source) {
  assert(/^[a-z-]+$/.test(source.id) && /^[a-f0-9]{40}$/.test(source.revision));
  assert(
    /^https:\/\/github\.com\/borderlesste\/[A-Za-z-]+\.git$/.test(
      source.repository,
    ),
  );
  const base = path.join(project, "work/dev-tools");
  const destination = path.join(
    base,
    "sources",
    `${source.id}-${source.revision}`,
  );
  const marker = path.join(destination, ".source-revision");
  if (fs.existsSync(marker)) {
    assert.equal(fs.readFileSync(marker, "utf8"), source.revision);
    return destination;
  }
  fs.mkdirSync(path.join(base, "cache"), { recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const cache = path.join(base, "cache", source.id);
  if (!fs.existsSync(path.join(cache, ".git"))) {
    run("git", [
      "clone",
      "--depth",
      "1",
      "--no-checkout",
      source.repository,
      cache,
    ]);
  }
  assert.equal(
    run("git", ["-C", cache, "remote", "get-url", "origin"]).toString().trim(),
    source.repository,
  );
  try {
    run("git", ["-C", cache, "cat-file", "-e", `${source.revision}^{commit}`]);
  } catch {
    run("git", [
      "-C",
      cache,
      "fetch",
      "--depth",
      "1",
      "origin",
      source.revision,
    ]);
  }
  const staging = fs.mkdtempSync(path.join(base, "extract-"));
  try {
    const archive = path.join(staging, "source.tar");
    const unpacked = path.join(staging, "source");
    fs.mkdirSync(unpacked);
    run("git", [
      "-C",
      cache,
      "archive",
      "--format=tar",
      `--output=${archive}`,
      source.revision,
    ]);
    run("tar", ["-xf", archive, "-C", unpacked]);
    fs.writeFileSync(path.join(unpacked, ".source-revision"), source.revision);
    fs.renameSync(unpacked, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return destination;
}

function setup() {
  const lock = readJson(path.join(project, "dev-tools.lock.json"));
  const inventoryPath = path.join(project, "dev-tools.installed.json");
  const previous = fs.existsSync(inventoryPath)
    ? readJson(inventoryPath).files
    : {};
  const files = {};
  const copy = (source, relative) => {
    const stat = fs.lstatSync(source);
    assert(!stat.isSymbolicLink(), `Unexpected source symlink: ${source}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(source).sort())
        copy(path.join(source, name), `${relative}/${name}`);
    } else {
      installFile(project, relative, fs.readFileSync(source), previous, files);
      fs.chmodSync(path.join(project, relative), stat.mode & 0o777);
    }
  };
  for (const source of lock.sources) {
    const root = snapshot(source);
    copy(
      path.join(root, "LICENSE"),
      `docs/dev-tools/licenses/${source.id}.txt`,
    );
    for (const skill of source.skills || []) {
      assert(/^[a-z0-9-]+$/.test(skill));
      copy(path.join(root, "skills", skill), `.agents/skills/${skill}`);
    }
    if (source.agents) {
      const generated = path.join(
        project,
        "work/dev-tools/generated",
        source.revision,
      );
      for (const format of ["codex", "antigravity"]) {
        run("bash", [
          path.join(root, "scripts/convert.sh"),
          "--tool",
          format,
          "--out",
          generated,
        ]);
      }
      for (const agent of source.agents) {
        assert(/^[a-z0-9-]+$/.test(agent));
        copy(
          path.join(generated, "antigravity", `agency-${agent}`),
          `.agents/skills/agency-${agent}`,
        );
        copy(
          path.join(generated, "codex/agents", `${agent}.toml`),
          `.codex/agents/${agent}.toml`,
        );
      }
    }
    console.log(`${source.id}: ${source.revision.slice(0, 12)}`);
  }
  for (const relative of Object.keys(previous)) {
    assert(
      relative in files,
      `Review previously installed file before removing it: ${relative}`,
    );
  }
  fs.writeFileSync(
    inventoryPath,
    JSON.stringify(
      {
        version: 1,
        sources: lock.sources.map(({ id, revision }) => ({ id, revision })),
        files: Object.fromEntries(
          Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Verified ${verifyInstallation(project)} installed files.`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv[2] === "--check")
    console.log(`Verified ${verifyInstallation(project)} installed files.`);
  else {
    assert.equal(
      process.argv.length,
      2,
      "Usage: node scripts/setup-dev-tools.mjs [--check]",
    );
    setup();
  }
}
