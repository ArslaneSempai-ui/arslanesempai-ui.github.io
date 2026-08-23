# What was checked here, and what it cost

The portfolio's test count was wrong. Closing that took four findings, three of which were
in the tool that publishes the figure rather than in the figure itself.

**And the best argument for the guard added here is that it caught the person who asked for
it.** A count of 536 was published to the profile page while three repositories had already
committed tests past it. The freshness guard went red, the publication was corrected before
anything left this machine, and the real number — 549 — is the one on the page.

---

## Found

### 1. A count measured on a tree that moves belongs to no commit

`compter()` runs `npm test` in each neighbouring repository and stamps the result with the
last commit that touched a test file. If the tree carries uncommitted work, **the number
measured comes from code that commit does not contain** — the published figure is attributed
to a state of the repository that exists nowhere.

The freshness guard could not catch this, for the reason it exists: it compares commit
hashes, so it only ever sees what was committed. A test edited and not committed moves no
hash. Measured on the night: three of eleven repositories had work in flight.

`compter` now refuses to **certify** those repositories, names them with their file count,
and the published figure carries the list. It does not refuse the whole count: on a machine
where somebody is always working somewhere, a tool that refuses everything gets worked
around, which is worse than not writing it.

### 2. Three circular deadlocks, all the same drawing

**A guard judging a gap between two things that only the gesture it blocks can close.**

- Uncertified repositories were dropped from `parDepot`, so README marks pointed at nothing,
  so `npm test` here failed *before its suite*, so `compter` refused to count this
  repository, so nothing could rewrite the file that would have repaired the marks.
- `le nombre de tests annoncé est celui qui a été compté` failed during the count — the page
  necessarily still carries the old number, since the count is what produces the new one.
- `prose --check` compared published prose to `chiffres.json`, which differ by construction
  while the tour is producing the new figures.

Each now suspends itself **during that precise gesture** and fires again outside it. That is
not an exemption: a guard that exempts itself stops guarding. It goes quiet only for the
instant when its verdict cannot structurally be true.

And a published key no longer disappears when its repository is uncertified — the previous
value stays, with `nonCertifies` naming it alongside. The reader sees the figure **and** that
it was not remade.

### 3. The guard cried wolf, and would have been loosened for it

It failed whenever any repository had committed a test since the count. It earned its keep —
it caught the stale 536 — but it would have gone red at **every** publication: a tour takes
ten minutes, several hands work, somebody always commits during it. **A guard that goes red
every time gets relaxed, and it takes the real defect with it.**

The distinction that saves it: a later commit does not make the figure *false*, it makes it
*dated*. Dated is an honest state you can publish, provided you say so.

Movement is now reported and passes. What stays red: a survey carrying **no** fingerprint
for a repository — there the figure designates no state at all — and a figure that matches
no known state, which the neighbouring case still catches.

### 4. The fingerprint was present but unreadable

`testsCommitesLe` holds forty-character digests. A tool compares them; nobody reads them.
`mesureSur` renders the same data seven characters at a time. **Replacing a figure with no
provenance by a figure with unreadable provenance is the same thing for whoever reads it.**

---

## Proved, on the paths that make it a change of verdict rather than a hole

    nothing moved            green
    a repository moved       GREEN, and the movement is printed by name
    no fingerprint at all    red, naming this guard
    figure hand-edited       red, naming the neighbouring guard
    clean tree               certifiable — a guard that refuses clean
                             repositories is deleted at the first complaint

The second and third are the ones that matter. Without them, green would only prove that
nothing was looking.

---

## Resisted

Every marker block is generated and checked, `--check` proved both ways. Fence parity even.
No constant predicate. The four shared modules byte-identical to `cascade`, checked before
and after and not touched.

---

## What was not done, and why

**The publication is not mine.** `npm run prose` writes into `profil/README.md` — the page an
employer opens — and into repositories not assigned here. It is not the tool that grants the
territory. The figure was computed and committed; publishing it was taken by the session that
owns that decision, under its own responsibility, and pushing was left to Arslane.

**And the count 282 was refused before that.** It was correct and it would have misled: 496
counted eleven repositories, 282 counted seven. *A correct figure published without what
accompanies it misleads more efficiently than a false one* — a number halving on a sales page
is read as a portfolio that shrank, and a note explaining the gap arrives after the reader
has drawn the conclusion.

---

## Verification

    npm test    84 tests, 84 pass, 0 fail, exit 0
    549 tests across eleven certified repositories, none excluded
