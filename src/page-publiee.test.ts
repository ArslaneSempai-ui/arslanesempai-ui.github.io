/*
 * LA PAGE PUBLIÉE EST-ELLE CELLE QUE CES SOURCES PRODUISENT AUJOURD'HUI ?
 *
 * `npm test` ne lance pas `npm run pages`. Rien n'obligeait donc `docs/index.html` — le
 * fichier que reçoit un visiteur — à correspondre aux sources qui vivent à côté. Une page
 * construite il y a trois jours, servie depuis, et une suite verte au-dessus.
 *
 * ─── LE PRÉCÉDENT, ET POURQUOI IL DÉCIDE DE LA FORME DE CE CAS ───
 *
 * Sur `rag-vitrine`, la page en ligne exécutait une expression régulière portant un antislash
 * LITTÉRAL là où la construction produit l'échappement correct. Le filtre ne retirait donc
 * jamais rien. Les deux modules se chargeaient, zéro erreur de console, le contenu était là,
 * et aucune capture d'écran ne montrait quoi que ce soit. **Un défaut qui dégrade sans casser
 * survit à tous ses témoins visuels.** Il a vécu jusqu'à ce que quelqu'un exécute les deux
 * expressions côte à côte dans la page servie.
 *
 * D'où deux refus dans la façon d'écrire ce cas :
 *
 *   — CONSTATER UNE PRÉSENCE NE PROUVE RIEN. « docs/index.html existe » est exactement ce
 *     qu'un fichier périmé satisfait. On CONSTRUIT, et on confronte.
 *   — ET LA CONSTRUCTION DOIT ÊTRE LA VRAIE. Réimplémenter ici ce que fait `pages.ts`
 *     donnerait un second producteur qui dériverait du premier, et le jour où ils divergent
 *     c'est le contrôle qui aurait l'air faux.
 *
 * ─── COMMENT ON CONSTRUIT SANS TOUCHER À L'ARBRE ───
 *
 * `pages.ts` écrit dans `root + "docs"`, et `root` se DÉDUIT de `import.meta.url`. On copie
 * donc l'arbre dans un bac, on y lance le vrai script, et il construit dans le bac. L'arbre
 * partagé n'est jamais écrit — six sessions travaillent ici, et un contrôle qui salit l'arbre
 * commun fait refuser le commit d'une autre.
 *
 * `node_modules` est LIÉ plutôt que copié : il pèse, et le contenu n'entre pas dans la page.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync,
  symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const racine = fileURLToPath(new URL("..", import.meta.url));

/*
 * LE CHEMIN DU BAC EST RÉSOLU, ET CE N'EST PAS UN DÉTAIL.
 *
 * `pages.ts` ne construit que si `isMain` est vrai, et `isMain` compare `import.meta.filename`
 * — toujours résolu — à `process.argv[1]` tel qu'on l'a écrit, par ÉGALITÉ DE CHAÎNES. Sur
 * macOS `mkdtemp` rend `/var/folders/…` quand la forme résolue est `/private/var/folders/…` :
 * le script sortait donc avec le code 0 sans rien écrire.
 *
 * Et ça se serait lu comme un succès. Le `tar` copie `docs/` avec le reste, donc
 * `docs/index.html` existait déjà dans le bac : la construction muette laissait un fichier
 * présent, identique à celui du dépôt, et la comparaison passait au vert en n'ayant rien
 * construit. C'est le témoin de non-vacuité qui l'a attrapé — il exige qu'une source modifiée
 * change la sortie, ce qu'une construction qui ne tourne pas ne peut pas faire.
 */
/** Une copie de l'arbre, sans `.git` ni `node_modules`, avec `node_modules` lié. */
function bacAvecLArbre(): string {
  const bac = realpathSync(mkdtempSync(join(tmpdir(), "vitrine-page-")));
  const copie = spawnSync("sh", ["-c",
    `cd ${JSON.stringify(racine)} && tar cf - --exclude=node_modules --exclude=.git . `
    + `| (cd ${JSON.stringify(bac)} && tar xf -)`], { encoding: "utf8" });
  assert.equal(copie.status, 0, `la copie de l'arbre a échoué : ${copie.stderr}`);
  if (existsSync(join(racine, "node_modules"))) {
    symlinkSync(join(racine, "node_modules"), join(bac, "node_modules"));
  }
  return bac;
}

function construire(bac: string): { statut: number | null; sortie: string } {
  /* Le chemin passé en argv[1] doit être celui que `import.meta.filename` rendra, sinon
     `isMain` est faux et le script sort sans construire — voir le commentaire du bac. */
  const r = spawnSync(process.execPath, [realpathSync(join(bac, "src/pages.ts"))],
    { cwd: bac, encoding: "utf8", timeout: 120_000 });
  return { statut: r.status, sortie: (r.stdout ?? "") + (r.stderr ?? "") };
}

test("la page contrôlée est celle que les sources produisent aujourd'hui",
  { timeout: 180_000 }, () => {
  const publiee = join(racine, "docs/index.html");
  assert.ok(existsSync(publiee),
    "docs/index.html est absent : il n'y a pas de page publiée à confronter. Ce cas ne doit "
    + "pas être assoupli — une absence de page n'est pas une page à jour.");

  const bac = bacAvecLArbre();
  try {
    const un = construire(bac);
    assert.equal(un.statut, 0,
      `la construction a échoué dans le bac, donc ce cas ne peut rien confronter :\n${un.sortie}`);

    const reconstruite = join(bac, "docs/index.html");
    assert.ok(existsSync(reconstruite),
      `\`pages.ts\` n'a pas écrit docs/index.html dans le bac :\n${un.sortie}`);

    /*
     * TÉMOIN DE NON-VACUITÉ, AVANT LE VERDICT : la construction LIT-ELLE ses sources ?
     *
     * Un producteur qui rendrait une constante ferait passer la comparaison ci-dessous à
     * chaque fois, y compris sur des sources modifiées — le vert vide dans sa forme la plus
     * pure. On bouge donc une source DANS LE BAC et on exige que la sortie bouge.
     */
    const gabarit = join(bac, "src/gabarit.html");
    assert.ok(existsSync(gabarit),
      "src/gabarit.html est introuvable dans le bac : le témoin ci-dessous ne pourrait rien muter.");
    const avant = readFileSync(reconstruite);
    writeFileSync(gabarit, readFileSync(gabarit, "utf8") + "\n<!-- témoin -->\n");
    const deux = construire(bac);
    assert.equal(deux.statut, 0, `la seconde construction a échoué :\n${deux.sortie}`);
    assert.ok(!readFileSync(reconstruite).equals(avant),
      "une source modifiée ne change pas la page construite : `pages.ts` ne lit pas ce qu'on "
      + "croit, et la comparaison ci-dessous passerait sur n'importe quel contenu.");

    /* On reconstruit depuis les sources INTACTES pour le verdict. */
    const bacPropre = bacAvecLArbre();
    try {
      const trois = construire(bacPropre);
      assert.equal(trois.statut, 0, `la construction de contrôle a échoué :\n${trois.sortie}`);
      const attendu = readFileSync(join(bacPropre, "docs/index.html"));
      const servi = readFileSync(publiee);

      assert.ok(servi.equals(attendu),
        `docs/index.html ne correspond plus à ce que ces sources produisent.\n`
        + `  publié : ${servi.length} octets · reconstruit : ${attendu.length} octets\n`
        + "  Ce n'est pas une question de date : les octets diffèrent. Un défaut qui dégrade\n"
        + "  sans casser — un motif qui ne filtre plus rien, un lien mort — se lit exactement\n"
        + "  comme une page saine dans un navigateur et sur une capture.\n"
        + "  → lancer `npm run pages`.");
    } finally { rmSync(bacPropre, { recursive: true, force: true }); }

    /*
     * ─── ET CE QUI EST COPIÉ VERBATIM, DÉDUIT DU DISQUE ───
     *
     * La liste ne s'écrit pas à la main : tout fichier présent sous le même nom dans `src/` et
     * dans `docs/` a été copié par la construction. Écrite, elle se figerait à ce que la
     * construction copie aujourd'hui, et le prochain artefact ne serait jamais comparé.
     */
    const copies = readdirSync(join(racine, "docs"))
      .filter((f) => /\.(js|css|html)$/.test(f) && existsSync(join(racine, "src", f)));
    assert.ok(copies.length > 0,
      "aucun fichier de docs/ n'a d'homonyme dans src/ : la construction ne copie plus rien "
      + "sous le même nom, et ce bloc ne compare plus rien.");
    const divergents = copies.filter((f) =>
      !readFileSync(join(racine, "src", f)).equals(readFileSync(join(racine, "docs", f))));
    assert.deepEqual(divergents, [],
      `${divergents.join(", ")} : la page sert un contenu différent de sa source. Comparé `
      + "octet pour octet — ce n'est pas une question de date. → `npm run pages`.");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});
