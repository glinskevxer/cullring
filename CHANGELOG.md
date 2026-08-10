# Changelog

Kept by hand, in the order somebody reading it would want. The versions are the
ones the programme itself reports; `cullring --version` and the provenance line
at the foot of a walk say which one wrote a report.

## 1.0.0

The first version the office runs rather than the one that wrote it. What
changed in the run-up is grouped by what it is for rather than by date.

### Water

- A position claimed by two boundaries is settled by the stricter
  classification in force, so the answer moves when either area is
  reclassified. `where` answers it for a latitude and longitude.
- Two areas that share a line are neighbours rather than an overlap, which
  stopped the check firing on most of the register.
- The register check now reports a station standing inside an area it is not
  registered to, which is the case where the samples have been scored against
  the wrong standard for as long as the station has existed.

### Sampling

- `round` says which stations the boat works next out of everything that is
  due, capped so one neglected area cannot take the whole trip, and reports
  what it left behind.
- An adverse survey may only read samples taken while the plan's own trigger
  was firing. Where the caller supplies no plans, the survey says the condition
  was never checked rather than passing it.

### Product

- Embargoes hold named product where it stands. They reach it by lot, by
  dealer or by water and period, which are three different registers, and a lot
  caught by two of them needs two releases.
- `advisory` writes the consumer notice a recall produces. The wording comes
  from what shut the water, and it is demoted to a record once nothing named
  can still be in a cold box.
- Leases are a register with dates on them, so the trespass rule reads who held
  the ground on the day of the harvest, and `leases` reads it as at any day. A lease over prohibited water is
  suspended: the term runs, the rent is owed, and the ground may not be worked.

### Licences

- `renewals` is the letter run. A grower whose licence and certificate both
  need attention gets one letter, and a licence inside the grace period renews
  as the same licence with the term running from the old expiry.

### The office

- `exceptions` runs every check over a whole case and groups the findings twice,
  by family and by code.
- `coverage` says which reports over a case are narrower than they look because
  a register is not there, and `validate` says so in one line.
- `diff` walks one case at two days and names the line that moved. A filed seal
  can stand in for the earlier walk.

### Under it

- The seal names its pieces, so two walks compare to a list of names rather than
  to one hash over forty pages.
- A walk carries its provenance, so a report that moved because the programme
  changed says which.
- The register carries a version, an unversioned file is read as version one,
  and a key nothing reads is a finding rather than a list that came back empty.
  `migrate` writes an old file forward.
- `docs/rules.md` is generated from a rule registry that says which rules decide
  what the others measure, and the build fails if it stops being true.
- Limits on what will be read, so a sheet exported with a million blank rows
  fails in a second with a sentence.
- An index over the movement ledger, which refuses to answer once the book has
  grown underneath it.
- A second worked example, whose plans close on a river stage and a plant bypass
  and reopen on tide cycles and conforming samples. It found a hole in the
  temperature table on its first run.
- `npm run smoke` packs the tarball, installs it elsewhere and runs it from
  there, because packing is what a release breaks.

## Before 1.0.0

The programme was run out of the working copy and the commit was the version.

- The commands document, the findings catalogue and the glossary became
  generated from the source and checked against it. Three of the four checks
  found something on their first run.
- `walk` sealed what it printed, so two runs over one case could be compared.
- The register was checked against its own boundaries.
- The dealer book audit reconciled what came in against what went out, and told
  a remainder still in the cooler from a discrepancy.
