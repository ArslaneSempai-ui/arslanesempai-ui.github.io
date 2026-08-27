import { fileURLToPath } from "node:url";
/**
 * Le tour complet du portfolio, en une commande.
 *
 * Le 19 août 2026, remettre un seul chiffre à jour a demandé quatre tours manuels : le
 * compteur tombe sur `rag`, on répare, il tombe sur `arbitrage`, on répare, il tombe sur les
 * chiffres de la vitrine, on répare, il tombe sur la prose du profil. Chaque panne cachait la
 * suivante, et chacune s'est découverte par hasard.
 *
 * Deux défauts, pas un. Le premier est qu'aucune commande ne faisait le tour. Le second est
 * que tout s'arrêtait au **premier** problème : on répare, on relance, on attend, on découvre
 * le deuxième. Quatre allers-retours pour ce qui tient en un rapport.
 *
 * ─── Pourquoi une boucle ───
 *
 * Rafraîchir les chiffres change le nombre de tests, ce qui périme le chiffre qu'on vient
 * d'écrire. Une passe ne suffit donc pas : on itère jusqu'à ce que rien ne bouge, avec une
 * borne, parce qu'un point fixe qu'on n'atteint pas est un défaut à voir et non une boucle à
 * subir.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { isMain } from "./cli.ts";
import { DEPOTS } from "./compter.ts";

const VOISINS_DEFAUT = fileURLToPath(new URL("../../", import.meta.url));
const ICI_DEFAUT = fileURLToPath(new URL("..", import.meta.url));

export type Souci = { ou: string; quoi: string; detail: string };
export type Reparation = { quoi: string; detail: string };

/**
 * Ce qu'on conclut d'un dépôt, à partir de faits bruts et de rien d'autre.
 *
 * Cette logique vivait au milieu de l'orchestration, mêlée aux `spawn` et aux chemins — donc
 * intestable, donc non testée. L'outil qui juge douze dépôts était le seul que rien ne
 * jugeait, exactement l'état de `diffuser` ce matin et de `verifier-ecran` cet après-midi.
 *
 * Les effets restent dehors : ici on ne fait que décider.
 */
export function conclure(faits: {
  depot: string;
  testOk: boolean; testSortie: string;
  aDocs: boolean; temoinValide: boolean;
  pagesOk?: boolean; pagesSortie?: string;
  paquetChange?: boolean;
}): { etat: string; soucis: Souci[]; reparations: Reparation[] } {
  const soucis: Souci[] = [];
  const reparations: Reparation[] = [];
  let etat = "";

  if (faits.aDocs) {
    if (faits.temoinValide) {
      etat = " · paquet à jour";
    } else if (faits.pagesOk === false) {
      etat = " · pages ÉCHEC";
      soucis.push({ ou: faits.depot, quoi: "npm run pages", detail: cause(faits.pagesSortie ?? "") });
    } else if (faits.paquetChange) {
      etat = " · paquet publié PÉRIMÉ, reconstruit";
      reparations.push({ quoi: `${faits.depot} : paquet publié périmé`,
        detail: "docs/ servait un code antérieur à la dernière modification" });
    }
  }
  if (!faits.testOk) soucis.push({ ou: faits.depot, quoi: "npm test", detail: cause(faits.testSortie) });

  const passes = /^ℹ pass (\d+)$/m.exec(faits.testSortie)?.[1] ?? "?";
  return { etat: `  ${faits.depot.padEnd(16)} ${faits.testOk ? `${passes} tests` : "ÉCHEC"}${etat}`, soucis, reparations };
}

function lancer(dossier: string, cmd: string, args: string[]): { ok: boolean; sortie: string } {
  try {
    return { ok: true, sortie: execFileSync(cmd, args, { cwd: dossier, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: envPropre() }) };
  } catch (e: any) {
    return { ok: false, sortie: String(e.stdout ?? "") + String(e.stderr ?? "") };
  }
}

/**
 * La même chose, sans bloquer — pour que les dépôts avancent ensemble.
 *
 * Le tour durait trois minutes, dont l'essentiel en douze `tsc` lancés l'un après l'autre.
 * Les dépôts sont indépendants : rien ne justifiait de les attendre en file. Et la lenteur
 * n'est pas un désagrément, c'est la première raison pour laquelle un contrôle cesse d'être
 * lancé — donc un contrôle lent finit par ne plus rien contrôler.
 */
function lancerAsync(dossier: string, cmd: string, args: string[]): Promise<{ ok: boolean; sortie: string }> {
  return new Promise((resoudre) => {
    const p = spawn(cmd, args, { cwd: dossier, stdio: ["ignore", "pipe", "pipe"], env: envPropre() });
    let sortie = "";
    p.stdout.on("data", (c) => { sortie += c; });
    p.stderr.on("data", (c) => { sortie += c; });
    p.on("close", (code) => resoudre({ ok: code === 0, sortie }));
    p.on("error", (e) => resoudre({ ok: false, sortie: String(e) }));
  });
}

/** Les trois dernières lignes utiles d'une sortie, pour dire *quoi* sans tout recopier. */
/**
 * Un environnement débarrassé du contexte de test qui l'englobe.
 *
 * Un lanceur de tests exporte des variables que les processus enfants héritent. Un `npm test`
 * lancé depuis l'intérieur d'une session de test se croit alors sous-processus de cette
 * session : il rend compte à un parent qui ne l'écoute pas, et **sort en zéro même quand ses
 * assertions tombent**.
 *
 * Conséquence, mesurée : le tour du portfolio, exécuté lui-même sous `node --test`, déclarait
 * sains des dépôts dont la suite échouait. Le défaut ne se voyait que dans ce cas précis — et
 * ce cas précis est exactement celui d'un contrôle qui se vérifie lui-même.
 */
function envPropre(): NodeJS.ProcessEnv {
  /*
   * Une liste blanche, pas une liste noire.
   *
   * La première version supprimait trois motifs choisis à la main. Un quatrième lanceur, une
   * autre convention, et le défaut revenait — silencieusement, et dans le sens rassurant, ce
   * qui est le pire des deux.
   *
   * On énumère donc ce qu'un sous-processus a besoin de connaître, et rien d'autre passe.
   * Ajouter une variable devient une décision consciente au lieu d'un héritage.
   */
  const GARDES = ["PATH", "HOME", "SHELL", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR",
    "TERM", "NVM_DIR", "NODE_PATH", "npm_config_cache", "npm_config_prefix"];
  const e: NodeJS.ProcessEnv = {};
  for (const cle of GARDES) if (process.env[cle] !== undefined) e[cle] = process.env[cle];
  return e;
}

/** L'empreinte d'un fichier ou d'un dossier — absent vaut chaîne vide, pas erreur. */
function empreinteFichierOuDossier(chemin: string): string {
  try {
    if (statSync(chemin).isDirectory()) return empreinteDossier(chemin);
    return createHash("sha256").update(readFileSync(chemin)).digest("hex");
  } catch { return ""; }
}

/** L'empreinte d'un dossier : le contenu, pas les dates. */
function empreinteDossier(dossier: string): string {
  const h = createHash("sha256");
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const c = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(c);
      else { h.update(e.name); h.update(readFileSync(c)); }
    }
  };
  try { parcourir(dossier.replace(/\/$/, "")); } catch { return ""; }
  return h.digest("hex");
}

const cause = (s: string) => s.split("\n")
  .filter((l) => l.trim() && !/^(npm |>|$|\s*at )/.test(l))
  .slice(-3).map((l) => l.trim()).join(" · ");

/**
 * Le tour, contre une racine quelconque.
 *
 * Il ne s'exécutait que contre les vrais dépôts, donc le seul moyen de savoir s'il détecte
 * une panne était d'en provoquer une pour de bon. Les tests se rabattaient sur la lecture de
 * sa source — vérifier qu'un mot apparaît dans un fichier, ce qui n'est pas une propriété
 * mais une présence, et ce qui passe le jour où le mot reste sans que la fonction tienne.
 *
 * Avec une racine en paramètre, on peut lui donner un faux portfolio où l'on casse ce qu'on
 * veut, et vérifier ce qu'il en dit.
 */
export async function tour(options: {
  voisins?: string; ici?: string; depots?: string[]; reparer?: boolean; silencieux?: boolean;
} = {}): Promise<{ soucis: Souci[]; reparations: Reparation[]; lignes: string[] }> {
  const voisins = options.voisins ?? VOISINS_DEFAUT;
  const ici = options.ici ?? ICI_DEFAUT;
  const depots = options.depots ?? DEPOTS;
  const reparer = options.reparer ?? true;
  const lignes: string[] = [];
  const dire = (x: string) => { lignes.push(x); if (!options.silencieux) console.log(x); };

  
  const soucis: Souci[] = [];
  const reparations: { quoi: string; detail: string }[] = [];

  dire(`\nTOUR DU PORTFOLIO — ${depots.length} dépôts${reparer ? "" : " (contrôle seul)"}\n`);

  /*
   * 1. La couche partagée d'abord — puis les emprunts, dans cet ordre.
   *
   * Deux mécanismes de propagation coexistent et l'ordre n'est pas indifférent. `diffuser`
   * pousse les couches d'`identite` vers tous les dépôts ; `emprunter` recopie des modèles
   * d'un outil vers un autre, **avec** `cli.ts` et `interval.ts` pris chez `identite`.
   *
   * Diffuser sans réemprunter laisse donc les dossiers empruntés une version en retard, et
   * leur contrôle d'intégrité tombe — c'est arrivé le 19 août 2026, et le message accusait
   * `economics/interval.ts` alors que la modification venait d'`identite`.
   */
  const identite = voisins + "identite/";
  if (existsSync(identite + "diffuser.mjs")) {
    /*
     * On relève d'abord, on répare ensuite.
     *
     * Réparer directement effaçait la panne en même temps que ses traces : onze fichiers
     * divergents auraient été remis d'aplomb sans que personne sache qu'ils l'étaient. Une
     * commande qui corrige en silence masque la fréquence à laquelle les choses cassent, et
     * c'est cette fréquence qui dit s'il faut changer autre chose.
     */
    const vu = lancer(identite, "node", ["diffuser.mjs", "--check"]);
    const nDiverges = (vu.sortie.match(/divergé :/g) ?? []).length;
    if (nDiverges && reparer) {
      const fait = lancer(identite, "node", ["diffuser.mjs"]);
      reparations.push({ quoi: `${nDiverges} fichier(s) de la couche partagée`, detail: cause(vu.sortie) });
      dire(`  couche partagée   ${nDiverges} divergence(s) — RÉPARÉE${fait.ok ? "" : " (échec)"}`);
      if (!fait.ok) soucis.push({ ou: "identite", quoi: "diffusion en échec", detail: cause(fait.sortie) });
    } else if (nDiverges) {
      dire(`  couche partagée   ${nDiverges} divergence(s)`);
      soucis.push({ ou: "identite", quoi: "couche partagée divergente", detail: cause(vu.sortie) });
    } else {
      dire(`  couche partagée   concordante`);
    }
  }


  /*
   * 1b. Les emprunts, après la diffusion et avant les suites.
   *
   * Ce bloc avait disparu : une réécriture de la boucle l'a emporté, et il n'est resté que
   * le commentaire qui l'annonçait. `portefeuille` documentait donc un enchaînement qu'il ne
   * faisait plus — et rien ne l'aurait dit si un test ne comparait pas le document au code.
   *
   * Les emprunteurs se découvrent : tout dépôt dont le `package.json` porte un script
   * `emprunter`. Les écrire en dur reproduirait le motif que ce fichier existe pour démonter.
   */
  const emprunteurs = depots.filter((d) => {
    const x = d === "vitrine" ? ici : `${voisins}${d}/`;
    try { return !!JSON.parse(readFileSync(x + "package.json", "utf8")).scripts?.emprunter; }
    catch { return false; }
  });
  if (reparer) {
    for (const emprunteur of emprunteurs) {
      const d = emprunteur === "vitrine" ? ici : `${voisins}${emprunteur}/`;
      const e = lancer(d, "npm", ["run", "emprunter"]);
      if (!e.ok) soucis.push({ ou: emprunteur, quoi: "emprunter", detail: cause(e.sortie) });
    }
  }
  if (emprunteurs.length) dire(`  emprunts          ${emprunteurs.length} dépôt(s)`);

  /*
   * 2. Chaque dépôt, en parallèle, jusqu'au bout.
   *
   * On ne s'arrête pas au premier qui tombe — et on ne les attend plus en file non plus.
   * Les lignes sont rassemblées après coup pour rester lisibles dans l'ordre.
   */
  const aVerifier = depots.filter((x) => x !== "vitrine")
    .map((depot) => ({ depot, d: depot === "vitrine" ? ici : `${voisins}${depot}/` }))
    .filter(({ d }) => existsSync(d + "package.json"));

  const resultats = await Promise.all(aVerifier.map(async ({ depot, d }) => {
    const r = await lancerAsync(d, "npm", ["test"]);
    const locaux: Souci[] = [];
    const repare: Reparation[] = [];
    let temoinValide = false, pagesOk: boolean | undefined, pagesSortie: string | undefined, paquetChange = false;

    if (existsSync(d + "docs")) {
      const empreinteSrc = [d + "src", d + "package.json", d + "tsconfig.json", d + "tsconfig.web.json"]
        .map((c) => empreinteFichierOuDossier(c)).join("|");
      const temoin = d + ".build-source";
      const connue = existsSync(temoin) ? readFileSync(temoin, "utf8").trim() : "";
      if (connue === empreinteSrc) {
        temoinValide = true;
      } else {
        const avant = empreinteDossier(d + "docs");
        const pages = await lancerAsync(d, "npm", ["run", "pages"]);
        writeFileSync(temoin, empreinteSrc + "\n");
        const apres = empreinteDossier(d + "docs");
        pagesOk = pages.ok; pagesSortie = pages.sortie;
        paquetChange = avant !== apres;
      }
    }
    const c = conclure({
      depot, testOk: r.ok, testSortie: r.sortie,
      aDocs: existsSync(d + "docs"), temoinValide, pagesOk, pagesSortie, paquetChange,
    });
    return { depot, ligne: c.etat, locaux: [...locaux, ...c.soucis], repare: [...repare, ...c.reparations] };
  }));

  for (const x of resultats) {
    dire(x.ligne);
    soucis.push(...x.locaux);
    reparations.push(...x.repare);
  }

  /* 3. Les chiffres, puis la prose, en boucle jusqu'à ce que rien ne bouge. */
  if (reparer) {
    let tours = 0;
    const misesAJour: string[][] = [];
    for (; tours < 4; tours++) {
      lancer(ici, "npm", ["run", "mesurer"]);
      const p = lancer(ici, "npm", ["run", "prose"]);
      const lignes = p.sortie.split("\n").filter((l) => /·.*:/.test(l)).map((l) => l.trim());
      if (!lignes.length) break;
      misesAJour.push(lignes);
      dire(`  chiffres          tour ${tours + 1} : ${lignes.length} affirmation(s) remises à jour`);
      if (reparer) reparations.push({ quoi: `${lignes.length} chiffre(s), tour ${tours + 1}`, detail: lignes.join(" · ") });
    }
    if (tours >= 4) {
      /*
       * Nommer la valeur qui oscille, pas seulement constater l'absence de point fixe.
       *
       * « Quatre tours sans converger » dit qu'il y a un cycle et pas où le chercher. Une clé
       * qui revient à chaque tour est celle qui en fait bouger une autre, laquelle la fait
       * rebouger — et c'est elle qu'on veut voir nommée.
       */
      const compte = new Map<string, number>();
      for (const tour of misesAJour) {
        for (const l of tour) {
          const cle = /·\s*([^:]+):/.exec(l)?.[1]?.trim() ?? l;
          compte.set(cle, (compte.get(cle) ?? 0) + 1);
        }
      }
      const cycliques = [...compte.entries()].filter(([, n]) => n >= tours).map(([c]) => c);
      soucis.push({ ou: "vitrine", quoi: "les chiffres ne se stabilisent pas",
        detail: cycliques.length
          ? `valeur(s) remises à jour à chaque tour : ${cycliques.join(", ")}`
          : "quatre tours sans point fixe, sans qu'une valeur unique se répète" });
    }
  }

  /*
   * LE TAMPON S'ÉCRIT ICI — après le tour des onze dépôts et des chiffres, AVANT la suite
   * de la vitrine. Sa place d'avant (après le pas 4, conditionnée à zéro souci) créait une
   * COUTURE CIRCULAIRE, mesurée le 27/08/2026 : la suite de la vitrine contient le test de
   * fraîcheur qui LIT ce tampon ; un tampon vieux rendait la suite rouge, la suite rouge
   * était un souci, et le souci empêchait d'écrire le tampon. Le portfolio entier pouvait
   * être vert, le tour tourner tous les jours, et la vitrine rester rouge pour toujours.
   *
   * Le tampon atteste que LE TOUR A TOURNÉ — c'est exactement ce que le test de fraîcheur
   * surveille (« un contrôle qu'on doit penser à lancer est une note déguisée »). La santé
   * des dépôts a ses propres gardes, dans leurs propres suites, et le tour la rapporte
   * bruyamment ; elle reste une condition : un tour qui a trouvé des soucis AILLEURS que
   * dans la suite de la vitrine ne tamponne pas — on ne date pas comme « fait » un tour
   * qui laisse le portfolio cassé.
   */
  if (!soucis.length) {
    /*
     * Le témoin appartient au portfolio parcouru, pas au module qui parcourt.
     *
     * Il s'écrivait à côté du fichier source, donc un tour d'essai sur une racine fictive
     * rajeunissait le témoin de fraîcheur du vrai portfolio — l'inverse exact de ce qu'un
     * essai doit faire. Le défaut est de la même famille que les deux précédents : un effet
     * qui déborde du cadre où on le croit confiné.
     */
    mkdirSync(ici + "data/", { recursive: true });
    writeFileSync(ici + "data/dernier-tour.txt", new Date().toISOString() + "\n");
  }

  /* 4. La vitrine en dernier, parce qu'elle contrôle tout ce qui précède. */
  const v = lancer(ici, "npm", ["test"]);
  dire(`  vitrine           ${v.ok ? `${/^ℹ pass (\d+)$/m.exec(v.sortie)?.[1] ?? "?"} tests` : "ÉCHEC"}`);
  if (!v.ok) soucis.push({ ou: "vitrine", quoi: "npm test", detail: cause(v.sortie) });

  if (reparations.length) {
    dire(`\n${reparations.length} réparation(s) — ce qui était cassé et ne l'est plus :\n`);
    for (const r of reparations) dire(`  ↻ ${r.quoi}\n      ${r.detail}`);
  }
  if (!soucis.length) {
    dire(`\nTout concorde${reparations.length ? " — après réparation" : ""}.\n`);
  } else {
    dire(`\n${soucis.length} problème(s) — tous, pas seulement le premier :\n`);
    for (const s of soucis) dire(`  ✗ ${s.ou} · ${s.quoi}\n      ${s.detail}`);
    dire("");
    /*
     * Le code de sortie est décidé plus bas, par la ligne de commande.
     *
     * Il était posé ici — donc une fonction de bibliothèque marquait le processus entier en
     * échec dès qu'elle constatait quelque chose. Conséquence : les tests qui provoquent une
     * panne exprès pour vérifier qu'elle est détectée faisaient sortir la suite en erreur,
     * tous leurs cas passant. Un outil qui ne peut pas être appelé sans conséquence ne peut
     * pas être testé, et c'est pour ça qu'il ne l'était pas.
     */
  }

  return { soucis, reparations, lignes };
}

if (isMain(import.meta)) {
  const r = await tour({ reparer: !process.argv.includes("--check") });
  if (r.soucis.length) process.exitCode = 1;
}
