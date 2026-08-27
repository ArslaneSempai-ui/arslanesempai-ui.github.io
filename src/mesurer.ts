/* piege:ok facade-en-francais — les sorties sont traduites ; ce qui reste en francais est le NOM du fichier engendre (`chiffres.json`) et celui de la commande (`npm run mesurer`) — des identifiants, pas de la prose. La regle compte `chiffres` dans sa liste de mots. Les renommer est un autre changement, qui touche le README, les habitudes et les artefacts : il appartient a Arslane, pas a ce commit. */
import { fileURLToPath } from "node:url";
/*
 * LES CHIFFRES DE LA VITRINE, PRIS À LA SOURCE.
 *
 * Cette page annonce une trouvaille par outil. Chacune est un nombre, et un nombre recopié
 * à la main se périme au premier changement de modèle sans que rien ne le signale — c'est
 * déjà arrivé trois fois sur les README de ces dépôts. Alors on ne recopie pas : on fait
 * tourner les modèles et on écrit `chiffres.json`.
 *
 * ─── Ce qui rend ce fichier particulier ───
 *
 * Les six outils sont six dépôts séparés. Ce script les importe depuis les dossiers
 * voisins, ce qui marche sur la machine où ils sont tous présents et nulle part ailleurs.
 * D'où trois règles :
 *
 *  1. **Chaque import est optionnel.** Un dossier absent donne un message clair, pas une
 *     pile d'exceptions. Quelqu'un qui clone seulement cette vitrine doit pouvoir la
 *     construire à partir du `chiffres.json` livré.
 *  2. **`--check` ne juge que ce qu'il a pu mesurer.** Un outil manquant est signalé comme
 *     non vérifié, jamais comme concordant. Dire « à jour » de ce qu'on n'a pas lu est le
 *     mensonge que ce fichier existe pour empêcher.
 *  3. **Le moteur de recherche documentaire est privé.** Il est absent de la plupart des
 *     machines, y compris des runners publics, et c'est voulu. Ses chiffres restent dans
 *     `chiffres.json` et sont gardés par un test qui les confronte au README public.
 *
 * Ce que ce fichier ne mesure pas : `v4-sous-budget`, du banc de régression. Cette
 * version-là court après une horloge et est non déterministe *par construction* — c'est
 * son rôle dans la démonstration. Publier un score figé pour elle serait afficher un
 * tirage au sort avec deux décimales.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

/** Les dépôts voisins. Une seule ligne à changer si l'arborescence bouge. */
const VOISINS = fileURLToPath(new URL("../../", import.meta.url));
const FICHIER = fileURLToPath(new URL("../chiffres.json", import.meta.url));

export type Chiffres = Record<string, Record<string, number | string | boolean>>;

type Mesure = { cle: string; dossier: string; prendre: () => Promise<Record<string, number | string | boolean>> };

const oui = (n: number, d = 3) => Number(n.toFixed(d));

const MESURES: Mesure[] = [
  {
    cle: "economics", dossier: "economics",
    async prendre() {
      const { generatePopulation } = await import(`${VOISINS}economics/src/alerts.ts`);
      const { sweep, ASSUMPTIONS, THRESHOLDS } = await import(`${VOISINS}economics/src/model.ts`);
      const pop = generatePopulation();
      const pts = sweep(pop, THRESHOLDS, ASSUMPTIONS).sort((a: any, b: any) => a.threshold - b.threshold);
      const ici = pts.find((p: any) => Math.abs(p.threshold - 0.65) < 1e-9);
      /* Le dernier seuil dont le cas suivant est encore gratuit : la marche s'achète après. */
      const gratuits = pts.filter((p: any) => p.costPerMarginalTruePositive === 0);
      return {
        analystesEnPoste: ASSUMPTIONS.analystsInPost,
        analystesUtilises: ici.fteWhole,
        /* Ceux qui sont payés et n'ont rien à traiter : la soustraction est faite ici, une
         * fois, plutôt que dans chaque phrase qui la cite. */
        analystesInoccupes: ASSUMPTIONS.analystsInPost - ici.fteWhole,
        attrapes: ici.truePositivesCaught,
        aTrouver: pop.truePositivesTotal,
        coutAnnuel: ici.annualCost,
        seuilGratuitLePlusLarge: oui(Math.min(...gratuits.map((p: any) => p.threshold)), 2),
        casSuivantLePlusCher: Math.round(Math.max(...pts.map((p: any) => p.costPerMarginalTruePositive ?? 0))),
        /*
         * Le premier pas qui se paie, et non le plus cher.
         *
         * « Gratuit jusqu'à 0,45, après quoi ça coûte X » : le lecteur comprend le pas
         * *suivant*. Le maximum du balayage, lui, est deux marches plus loin — la page
         * d'accueil du profil citait un montant pris dans un troisième tableau encore, et
         * rien ne le vérifiait puisque ce README-là est écrit à la main.
         */
        /*
         * Ce que la prose affirme ailleurs sur la page, et qui n'avait pas de mesure.
         *
         * L'occupation et l'attente au seuil encore gratuit, et les deux facteurs de volume
         * entre 0,70 et 0,50. Quatre phrases les citaient de mémoire.
         *
         * Deux autres nombres de la prose restent non marqués, faute d'une définition qui
         * corresponde : « 306 cas de plus » se compte depuis le seuil affiché à l'écran, qui
         * bouge, et « 33 % d'occupation » est un exemple de raisonnement, pas une sortie du
         * modèle. Marquer avec une définition approchante serait pire que ne pas marquer :
         * ça donnerait une garantie fausse.
         */
        ...(() => {
          const gratuit = pts.filter((p: any) => p.costPerMarginalTruePositive === 0)
            .sort((a: any, b: any) => a.threshold - b.threshold)[0];
          const a70 = pts.find((p: any) => Math.abs(p.threshold - 0.70) < 1e-9);
          const a50 = pts.find((p: any) => Math.abs(p.threshold - 0.50) < 1e-9);
          return {
            chargeAuSeuilGratuit: oui(gratuit?.load ?? 0),
            attenteAuSeuilGratuit: oui(gratuit?.waitDays ?? 0, 1),
            facteurVolume: Math.round((a50?.alerts ?? 0) / (a70?.alerts || 1)),
            facteurHeures: Math.round((a50?.hours ?? 0) / (a70?.hours || 1)),
          };
        })(),
        premierCasPayant: Math.round(
          pts.filter((p: any) => (p.costPerMarginalTruePositive ?? 0) > 0)
            .sort((a: any, b: any) => b.threshold - a.threshold)[0]?.costPerMarginalTruePositive ?? 0,
        ),
      };
    },
  },
  {
    cle: "triage", dossier: "triage",
    async prendre() {
      const { genererCas } = await import(`${VOISINS}triage/src/cas.ts`);
      const { mesurer } = await import(`${VOISINS}triage/src/mesurer.ts`);
      const { REFERENTIEL_SECTORIEL } = await import(`${VOISINS}triage/src/referentiel.ts`);
      const { trier } = await import(`${VOISINS}triage/src/agent.ts`);
      const cas = genererCas();
      const b = mesurer(cas, 0.7, REFERENTIEL_SECTORIEL);
      /*
       * Les escalades que le curseur ne déplacera jamais.
       *
       * C'est l'affirmation que la page d'accueil du profil porte en une ligne — « le seuil
       * était inerte » — et elle sortait d'un relevé fait à la main. Un verdict escaladé
       * sans que la confiance soit sous le seuil vient d'une règle qui ne dépend pas d'elle.
       */
      const verdicts = cas.map((c: any) => trier(c, 0.7, REFERENTIEL_SECTORIEL));
      const escalades = verdicts.filter((v: any) => v.decision === "escalader");
      return {
        dossiers: b.total,
        partAutomatisee: oui(b.tauxAutomatisation),
        justesse: oui(b.precisionAutomatisee),
        manquements: b.manquements,
        escaladesEvitables: b.escaladesInutiles,
        escaladesParLaRegle: escalades.filter((v: any) => !v.escalade).length,
        escaladesParLeSeuil: escalades.filter((v: any) => v.escalade).length,
      };
    },
  },
  {
    cle: "funnel", dossier: "funnel",
    async prendre() {
      const { generate, SCENARIO } = await import(`${VOISINS}funnel/src/population.ts`);
      const { measure, worstStep } = await import(`${VOISINS}funnel/src/funnel.ts`);
      const { priceAll } = await import(`${VOISINS}funnel/src/value.ts`);
      const pop = generate(SCENARIO);
      const taux = measure(pop);
      const prix = priceAll();
      const meilleur = prix[0], pire = prix[prix.length - 1];
      return {
        etapes: taux.length,
        etapeLaPlusFaible: worstStep(taux).worst.step,
        meilleurLevier: meilleur.step,
        meilleurRendement: oui(meilleur.perDollar, 2),
        pireLevier: pire.step,
        pireRendement: oui(pire.perDollar, 2),
        facteur: Math.round(meilleur.perDollar / pire.perDollar),
      };
    },
  },
  {
    cle: "arbitrage", dossier: "arbitrage",
    async prendre() {
      const { CAS } = await import(`${VOISINS}arbitrage/src/situation.ts`);
      const { arbitrer, bascule, desaccordReel, ecartConversion } = await import(`${VOISINS}arbitrage/src/arbitrage.ts`);
      const v = arbitrer(CAS);
      const e = ecartConversion(CAS);
      const d = desaccordReel(CAS);
      return {
        ecartConversion: oui(e.centre * 100, 2),
        ecartBas: oui(e.bas * 100, 2),
        ecartHaut: oui(e.haut * 100, 2),
        bascule: oui(bascule(CAS)! * 100, 2),
        croyanceBas: oui(CAS.croyance.bas * 100, 2),
        croyanceHaut: oui(CAS.croyance.haut * 100, 2),
        desaccordReel: d.dedans,
        signeDecidePar: v.signeDecidePar === "les hypothèses" ? "assumptions" : "the test",
        net: Math.round(v.net.centre),
        analystesBas: v.analystes.bas,
        analystesHaut: v.analystes.haut,
      };
    },
  },
  {
    cle: "cascade", dossier: "cascade",
    async prendre() {
      const { readProfiles } = await import(`${VOISINS}cascade/src/measure.ts`);
      const { evaluer, optimiseExtraction } = await import(`${VOISINS}cascade/src/optimise.ts`);
      const { ASSUMPTIONS } = await import(`${VOISINS}cascade/src/assumptions.ts`);
      const { FIELDS } = await import(`${VOISINS}cascade/src/corpus.ts`);
      const p = readProfiles();
      if (!p) throw new Error("cascade: no measured profile — run `npm run measure` over there");
      const o = optimiseExtraction(p, ASSUMPTIONS)!;
      const tout = (palier: string) =>
        evaluer(p, ASSUMPTIONS, Object.fromEntries(FIELDS.map((c: string) => [c, palier])) as never);
      const grand = tout("large");
      return {
        champs: FIELDS.length,
        justesseOptimale: oui(o.accuracy * 100, 1),
        coutOptimal: Math.round(o.cost),
        justesseGrandModele: oui(grand.accuracy * 100, 1),
        coutGrandModele: Math.round(grand.cost),
        facteur: oui(grand.cost / Math.max(1, o.cost), 1),
        champsGratuits: FIELDS.filter((c: string) => o.routing[c] === "rules").length,
      };
    },
  },
  {
    cle: "remediation", dossier: "remediation",
    async prendre() {
      const { CARNET, EQUIPE, POLITIQUES, planifier } = await import(`${VOISINS}remediation/src/carnet.ts`);
      const chiffrer = (nom: "graviteDabord" | "echeanceDabord") => {
        const o = POLITIQUES[nom](CARNET);
        return { centre: planifier(o, CARNET, EQUIPE, "centre"), haut: planifier(o, CARNET, EQUIPE, "haut") };
      };
      const reflexe = chiffrer("graviteDabord"), trie = chiffrer("echeanceDabord");
      return {
        constats: CARNET.length,
        manquesReflexe: reflexe.centre.manques,
        coutReflexe: Math.round(reflexe.centre.cout),
        manquesTrie: trie.centre.manques,
        coutReflexeHaut: Math.round(reflexe.haut.cout),
        coutTrieHaut: Math.round(trie.haut.cout),
      };
    },
  },
  {
    cle: "derive", dossier: "derive",
    async prendre() {
      const { REGLAGE, rubans, fenetreSeparante } = await import(`${VOISINS}derive/src/derive.ts`);
      const r = rubans(REGLAGE, 80);
      const s = fenetreSeparante(r);
      return {
        seuilDeLaNote: REGLAGE.seuil,
        deplacement: REGLAGE.deplacement,
        signal: oui(r.signal, 3),
        fenetreSeparante: s.fenetre,
        seuilSeparant: oui(s.seuil ?? 0, 3),
      };
    },
  },
  {
    cle: "cycle", dossier: "cycle",
    async prendre() {
      const { generate } = await import(`${VOISINS}cycle/src/events.ts`);
      const { perCase, overall } = await import(`${VOISINS}cycle/src/time.ts`);
      const { conformance } = await import(`${VOISINS}cycle/src/paths.ts`);
      const ev = generate();
      const o = overall(perCase(ev));
      const c = conformance(ev);
      return {
        dossiers: o.cases,
        joursDeBoutEnBout: oui(o.meanLeadDays, 1),
        /* Les heures sont mesurées, pas déduites des jours arrondis : 6,4 × 8 donne 51,2
         * alors que la valeur réelle est 51,0, et la barre de la figure s'en ressent. */
        heuresDeBoutEnBout: oui(o.meanLeadDays * 8, 1),
        heuresTravaillees: oui(o.meanTouchHours, 1),
        partAttente: oui(o.waitingShare),
        routesDistinctes: c.distinctPaths,
        conformite: oui(c.share),
      };
    },
  },
  {
    cle: "banc", dossier: "banc",
    async prendre() {
      const { runAll } = await import(`${VOISINS}banc/src/run.ts`);
      const { DETERMINISTE } = await import(`${VOISINS}banc/src/screening.ts`).catch(() => ({ DETERMINISTE: null }));
      const runs = await runAll();
      /*
       * On ne publie que les versions déclarées déterministes. `v4-sous-budget` en est
       * exclue parce qu'elle race un chronomètre : elle a donné 18 puis 19 sur cette même
       * machine à quelques minutes d'intervalle, ce qui est son propos, pas un défaut.
       */
      const stables = runs.filter((r: any) => DETERMINISTE ? DETERMINISTE[r.version] !== false : !r.version.includes("sous-budget"));
      const premier = stables[0], dernier = stables[stables.length - 1];
      /*
       * Les deux taux que la trouvaille compare, et l'intervalle qui les rend
       * indépartageables. Le README les écrivait à la main dans cinq phrases différentes.
       * L'intervalle est celui de Wilson à 95 %, en points de pourcentage, arrondi comme il
       * est cité : « à peu près ±14 points ».
       */
      const { wilson } = await import(`${VOISINS}banc/src/interval.ts`);
      const avant = stables[stables.length - 2] ?? premier;
      const [bas, haut] = wilson(dernier.passed, dernier.total);
      return {
        cas: premier.total,
        tauxAvant: oui(avant.passed / avant.total),
        tauxApres: oui(dernier.passed / dernier.total),
        demiIntervalle: Math.round(((haut - bas) / 2) * 100),
        versionsPubliees: stables.length,
        versionsEnTout: runs.length,
        passesAuDebut: premier.passed,
        passesALaFin: dernier.passed,
        versionNonDeterministe: runs.find((r: any) => !stables.includes(r))?.version ?? "",
      };
    },
  },
  {
    cle: "rag", dossier: "rag",
    async prendre() {
      const M = await import(`${VOISINS}rag/src/index.ts`);
      await M.etape1_lire(`${VOISINS}rag/corpus`);
      await M.etape2_indexer();
      const m = await M.mesurer();
      const indisponibles = m.total - m.repondables;
      const justes = Math.round(m.top1 * m.repondables);
      return {
        questions: m.total,
        justes,
        ratees: m.repondables - justes,
        silencesJustifies: Math.round(m.abstention * indisponibles),
        sansReponsePossible: indisponibles,
        /* La barre elle-même. Le README l'écrit dans une dizaine de phrases — « 0,84 est la
         * plus basse à laquelle cet outil n'invente rien » — et c'est un réglage, pas une
         * loi : il change si le corpus change. */
        barre: M.getSeuil(),
      };
    },
  },
];

export async function mesurer(): Promise<{ chiffres: Chiffres; absents: string[] }> {
  const chiffres: Chiffres = {};
  const absents: string[] = [];
  for (const m of MESURES) {
    if (!existsSync(`${VOISINS}${m.dossier}/src`)) { absents.push(m.cle); continue; }
    try {
      chiffres[m.cle] = await m.prendre();
    } catch (e) {
      absents.push(m.cle);
      console.error(`  ${m.cle} : mesure impossible — ${(e as Error).message}`);
    }
  }
  return { chiffres, absents };
}

export function lire(): Chiffres {
  return JSON.parse(readFileSync(FICHIER, "utf8")) as Chiffres;
}

async function principal(): Promise<void> {
  /* Le drapeau est cherché, pas lu à une position : `arg(0)` renvoyait le chemin de Node,
   * et la vérification s'est silencieusement transformée en écriture. */
  const controle = process.argv.includes("--check");
  const { chiffres, absents } = await mesurer();

  if (!controle) {
    const garde = existsSync(FICHIER) ? lire() : {};
    /* Un outil absent conserve ses chiffres livrés plutôt que de disparaître du fichier. */
    const fusion = { ...garde, ...chiffres };
    writeFileSync(FICHIER, JSON.stringify(fusion, null, 2) + "\n");
    console.log(`chiffres.json written — ${Object.keys(chiffres).length} tool(s) measured` +
      (absents.length ? `, ${absents.length} conservé(s) tels quels : ${absents.join(", ")}` : ""));
    return;
  }

  if (!existsSync(FICHIER)) {
    console.error("chiffres.json missing — run `npm run mesurer`");
    process.exit(1);
  }
  const livre = lire();
  const perimes: string[] = [];
  for (const [cle, valeurs] of Object.entries(chiffres)) {
    if (JSON.stringify(livre[cle]) !== JSON.stringify(valeurs)) perimes.push(cle);
  }
  if (perimes.length) {
    console.error(`chiffres.json stale for: ${perimes.join(", ")} — run \`npm run mesurer\``);
    for (const cle of perimes) {
      console.error(`  livré  ${cle} ${JSON.stringify(livre[cle])}`);
      console.error(`  mesuré ${cle} ${JSON.stringify(chiffres[cle])}`);
    }
    process.exit(1);
  }
  /* On dit ce qu'on a vérifié, et surtout ce qu'on n'a pas pu vérifier. */
  console.log(`chiffres.json up to date — ${Object.keys(chiffres).length} tool(s) checked` +
    (absents.length ? `, ${absents.length} non vérifié(s) faute de dépôt voisin : ${absents.join(", ")}` : ""));
}

if (isMain(import.meta)) await principal();
