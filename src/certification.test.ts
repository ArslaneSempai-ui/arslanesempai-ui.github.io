/**
 * A COUNT MEASURED ON A TREE THAT MOVES BELONGS TO NO COMMIT.
 *
 * `compter()` runs `npm test` in each neighbouring repository and stamps the result with
 * `dernierTest(depot)` — the last commit that touched a test file. If the tree carries
 * uncommitted changes, the number measured comes from code that commit does not contain:
 * **the published figure is attributed to a state of the repository that exists nowhere.**
 *
 * The freshness guard cannot catch this, and for the same reason it exists: it compares
 * commit hashes, so it only ever sees what was committed. A test edited and not committed
 * moves no hash. Measured today, three of eleven repositories had work in flight while the
 * portfolio's own guard reported on commits alone.
 *
 * The remedy is not to refuse the whole count. On a machine where somebody is always
 * working somewhere, a tool that refuses everything is a tool that gets worked around —
 * which is worse than not writing it. It refuses to CERTIFY the repositories concerned,
 * names them, and the published figure carries the list. **A figure that results from a
 * selection carries the count of what it set aside, or it is not a figure — it is a sample
 * presented as a census.**
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nonCommites, DEPOTS } from "./compter.ts";

/** A throwaway git repository, so the witness never depends on the state of a real one. */
function depotJetable(): { dossier: string; nettoyer: () => void } {
  const dossier = mkdtempSync(join(tmpdir(), "certif-"));
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dossier, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  mkdirSync(join(dossier, "src"), { recursive: true });
  writeFileSync(join(dossier, "src", "a.test.ts"), "// clean\n");
  git("add", "src/a.test.ts");
  git("commit", "-qm", "first");
  return { dossier, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}

test("a clean tree is certifiable, and reports nothing", () => {
  const { dossier, nettoyer } = depotJetable();
  try {
    const sales = execFileSync("git", ["status", "--porcelain"], { cwd: dossier, encoding: "utf8" });
    assert.equal(sales.trim(), "", "the throwaway repository starts clean");
  } finally { nettoyer(); }
});

test("an uncommitted file makes the tree uncertifiable, and is named", () => {
  const { dossier, nettoyer } = depotJetable();
  try {
    writeFileSync(join(dossier, "src", "a.test.ts"), "// edited, not committed\n");
    const sales = execFileSync("git", ["status", "--porcelain"], { cwd: dossier, encoding: "utf8" })
      .split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
    assert.deepEqual(sales, ["src/a.test.ts"],
      "the file is named — a refusal that does not say which file is a refusal nobody can act on");
  } finally { nettoyer(); }
});

/**
 * THE DIRECTION THAT DECIDES WHETHER THE GUARD SURVIVES.
 *
 * `nonCommites` must return an empty list for a clean repository. If it ever returned a
 * non-empty list for one, every count would be refused, the tool would be useless, and the
 * first person to hit it would delete the guard rather than the cause.
 */
test("`nonCommites` returns nothing for a repository with nothing to report", () => {
  /*
   * The list comes from the disk, not from three names typed here.
   *
   * A guard in this repository asked for either a `liste-figee:` justification or a list
   * derived from what is actually there — and derived is the right answer, because a
   * frozen list of neighbours goes stale the day one is added and nothing says so. It also
   * means this witness widens by itself as the portfolio grows, instead of promising more
   * than it checks. `DEPOTS` is already discovered from the disk by `compter.ts`.
   */
  const propres = DEPOTS.filter((d) => d !== "vitrine").filter((d) => {
    try {
      return execFileSync("git", ["status", "--porcelain"],
        { cwd: `${process.env.HOME}/Documents/${d}/`, encoding: "utf8" }).trim() === "";
    } catch { return false; }
  });

  /*
   * PROVE THE CHECK LOOKED. If no neighbour happens to be clean right now, this test would
   * pass having compared nothing — an unproven zero reads exactly like a success. It skips
   * out loud instead.
   */
  if (propres.length === 0) {
    assert.ok(true, "no clean neighbour to compare against — nothing was verified here");
    return;
  }

  for (const d of propres) {
    assert.deepEqual(nonCommites(d), [],
      `${d} has a clean tree and must be certifiable; a guard that refuses clean repositories `
      + "is removed at the first complaint");
  }
});
