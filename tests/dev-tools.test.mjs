import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  installFile,
  verifyInstallation,
} from "../scripts/setup-dev-tools.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("the committed tool payload matches its pinned inventory", () => {
  assert.ok(verifyInstallation(root) > 0);
  const skills = fs.readdirSync(path.join(root, ".agents/skills"));
  assert.equal(skills.length, 27);
  for (const skill of skills) {
    const markdown = fs.readFileSync(
      path.join(root, ".agents/skills", skill, "SKILL.md"),
      "utf8",
    );
    assert.match(markdown, /^---\r?\n/);
    assert.match(markdown, /^name: .+/m);
    assert.match(markdown, /^description: .+/m);
  }
});

test("reinstalling preserves local edits and permits an unchanged managed update", () => {
  fs.mkdirSync(path.join(root, "work"), { recursive: true });
  const temporary = fs.mkdtempSync(path.join(root, "work/dev-tools-test-"));
  const relative = ".agents/skills/example/SKILL.md";
  const target = path.join(temporary, relative);
  try {
    const first = {};
    installFile(temporary, relative, "version one", {}, first);
    const second = {};
    installFile(temporary, relative, "version two", first, second);
    assert.equal(fs.readFileSync(target, "utf8"), "version two");
    installFile(temporary, relative, "version two", second, {});
    fs.writeFileSync(target, "local edit");
    assert.throws(
      () => installFile(temporary, relative, "version three", second, {}),
      /Local edits preserved/,
    );
    assert.equal(fs.readFileSync(target, "utf8"), "local edit");
    assert.throws(() =>
      installFile(temporary, "../outside", "bad path", {}, {}),
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
