/*
 * COMBIEN DE TESTS, ET DEPUIS QUAND.
 *
 * La page d'accueil du profil annonce un nombre de tests. C'est le seul README du
 * portfolio écrit à la main — les six autres sont générés depuis leurs modèles et tenus
 * par `readme.ts --check`. Résultat prévisible : il affirmait « 147 tests » alors qu'il y
 * en avait 167, sur la première page que lit un recruteur, et rien n'aurait jamais signalé
 * l'écart.
 *
 * Compter les tests sans les exécuter ne marche pas : un `grep` sur `test(` en trouve 187,
 * parce qu'il attrape les occurrences dans les chaînes et les commentaires. Le seul compte
 * juste est celui que le lanceur rapporte. Il coûte quatre-vingts secondes, ce qui est trop
 * pour chaque `npm test` — donc on mesure sur demande, on écrit le résultat avec sa date,
 * et un test bon marché vérifie deux choses : que le README dit ce nombre-là, et qu'aucun
 * dépôt n'a commité de test depuis la mesure. La seconde est ce qui empêche le chiffre de
 * vieillir en silence, sans avoir à relancer quoi que ce soit.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const VOISINS = new URL("../../", import.meta.url).pathname;
const CHIFFRES = new URL("../chiffres.json", import.meta.url).pathname;

export const DEPOTS = ["economics", "triage", "funnel", "cycle", "banc", "rag", "arbitrage", "cascade", "remediation", "derive", "vitrine"];

/** Le dernier commit qui a touché un fichier de test, par dépôt. */
export function dernierTest(depot: string): string | null {
  const dossier = depot === "vitrine" ? new URL("..", import.meta.url).pathname : `${VOISINS}${depot}/`;
  if (!existsSync(dossier + ".git")) return null;
  try {
    /* Restreint aux fichiers de test : un commit qui touche un modèle ne périme pas un
     * compte de tests, et une alerte qui se déclenche à chaque commit n'est plus lue. */
    const sortie = execFileSync("git", ["log", "-1", "--format=%H", "--", "src/*.test.ts"], {
      cwd: dossier, encoding: "utf8",
    }).trim();
    return sortie || null;
  } catch { return null; }
}

export function compter(): { nombre: number; parDepot: Record<string, number>; absents: string[] } {
  const parDepot: Record<string, number> = {};
  const absents: string[] = [];
  for (const depot of DEPOTS) {
    const dossier = depot === "vitrine" ? new URL("..", import.meta.url).pathname : `${VOISINS}${depot}/`;
    if (!existsSync(dossier + "package.json")) { absents.push(depot); continue; }
    let sortie = "";
    try {
      /*
       * Le contrôle de péremption ne doit pas bloquer la mesure qui le met à jour.
       *
       * Sans ça : `compter` refuse de compter une suite en échec, la suite de la vitrine
       * échoue parce que le comptage est périmé, et le comptage ne peut plus être refait.
       * Le test se met en pause pendant la mesure — il est sans objet à ce moment-là.
       */
      sortie = execFileSync("npm", ["test"], {
        cwd: dossier, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, COMPTAGE: "1" },
      });
    } catch (e: any) {
      /* Une suite en échec ne doit pas être comptée comme si elle passait. */
      sortie = String(e.stdout ?? "");
      const echoue = Number(/^ℹ fail (\d+)$/m.exec(sortie)?.[1] ?? 1);
      if (echoue > 0) throw new Error(`${depot} : ${echoue} test(s) en échec — compter ce dépôt n'aurait pas de sens`);
    }
    parDepot[depot] = Number(/^ℹ pass (\d+)$/m.exec(sortie)?.[1] ?? 0);
  }
  return { nombre: Object.values(parDepot).reduce((a, b) => a + b, 0), parDepot, absents };
}

if (isMain(import.meta)) {
  const { nombre, parDepot, absents } = compter();
  const chiffres = JSON.parse(readFileSync(CHIFFRES, "utf8"));
  chiffres.portfolio = {
    tests: nombre,
    parDepot,
    mesureLe: new Date().toISOString(),
    /* Le dernier commit de test connu au moment de la mesure, dépôt par dépôt :
     * c'est lui qui permet de dire « ce compte a vieilli » sans relancer les suites. */
    testsCommitesLe: Object.fromEntries(DEPOTS.map((d) => [d, dernierTest(d)])),
  };
  writeFileSync(CHIFFRES, JSON.stringify(chiffres, null, 2) + "\n");
  console.log(`${nombre} tests${absents.length ? `, ${absents.length} dépôt(s) absent(s)` : ""} — ${
    Object.entries(parDepot).map(([d, n]) => `${d} ${n}`).join(", ")}`);
}
