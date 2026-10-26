/*
 * NO PATH OF THE AUTHOR'S MACHINE IN THE PUBLIC TREE (26/10/2026).
 *
 * decisions/2026-08-22-pas-de-migration-react.md carried the home folder of the machine it was written on, and the
 * scratch folders of the sessions that wrote it: 22 and 15 occurrences, replaced by ~ and <scratchpad>. This case reads
 * every file of the repository and refuses either form, so the next pasted log is refused before it is published.
 * The user name is assembled here, never written whole, so that this file does not trip its own rule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const NOM = ["arslane", "chr"].join("");
const INTERDITS = [`/Users/${NOM}`, `-Users-${NOM}`];
const IGNORES = new Set([".git", "node_modules"]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    if (IGNORES.has(n)) return [];
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });
}

export function cheminsMachine(texte: string): string[] {
  return INTERDITS.filter((motif) => texte.includes(motif));
}

test("no file of the repository names a path of the author's machine", () => {
  const fautes = fichiers(RACINE)
    .map((f) => [relative(RACINE, f), cheminsMachine(readFileSync(f, "latin1"))] as const)
    .filter(([, m]) => m.length > 0)
    .map(([f, m]) => `${f}: ${m.join(", ")}`);
  assert.deepEqual(fautes, []);
});

test("witness: a home path and a scratch path are both seen", () => {
  assert.deepEqual(cheminsMachine(`voir /Users/${NOM}/Documents/vitrine`), [`/Users/${NOM}`]);
  assert.deepEqual(cheminsMachine(`/private/tmp/claude-501/-Users-${NOM}-Downloads/x`), [`-Users-${NOM}`]);
  assert.deepEqual(cheminsMachine("~/Documents/vitrine"), []);
});
