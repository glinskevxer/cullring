# cullring

The shellfish sanitation programme of a coastal state's marine fisheries
division: growing area classification, conditional area management, harvest
legality, time and temperature control, and the trace that runs backwards from
a reported case to the water it came out of.

This is the office programme. It is not a laboratory system and it is not an
enforcement system. Results arrive as submitted sheets, rainfall arrives as
gauge readings, and what leaves is a decision somebody has to be able to
defend in front of a grower.

## Why it is shaped the way it is

The rules in this domain do not sit side by side. They select each other.

An area's classification decides which bacteriological standard its samples
are judged against, and the verdict of that judgement is a new classification.
The sampling strategy decides both which criteria apply and how a censored
result is read, so one set of thirty samples has two different verdicts. The
shoreline survey caps what the samples can support, whatever they say. A
conditionally approved area closes on rain and reopens on hours, or on
conforming samples, or on tide cycles, which are units the programme refuses to
convert between. The clock on a lot of oysters starts at harvest or at the
moment a falling tide uncovered the bed, and which one it is depends on the
gear. And an emergency order beats all of it.

So the programme is layered rather than flat, and the layers are in
[docs/design.md](docs/design.md).

## Getting started

```
npm install
npm test
npm run walk
```

`npm run walk` runs every report over both worked examples and seals what it
printed. Each is deliberately dirty, and they are dirty in different ways:
`core-sound` breaks rules about water, people and temperature, and
`white-oak` breaks a river-stage closure, a treatment that the dealer is not
certified for, and a daily limit taken across two trips.

`npm run smoke` packs the tarball, installs it into a directory of its own and
runs it from there, which is the only check that sees a file left out of the
package.

## The command line

```
node bin/cullring.js --help
node bin/cullring.js coverage -c examples/core-sound
node bin/cullring.js standing -c examples/core-sound -a "2025-06-11 09:00" -f 2025-06-01
node bin/cullring.js where 34.66,-76.55 -c examples/core-sound -a "2025-06-11 09:00"
node bin/cullring.js lot 20250814-D2-001 -c examples/core-sound -f 2025-08-01
node bin/cullring.js trace 20250815-C3-101 -c examples/core-sound
node bin/cullring.js exceptions -c examples/core-sound -o 2025-08-31
```

Start with `coverage`. It is the one that says which reports over a case are
narrower than they look, and every other report reads better once you know.

Every command takes a case directory, a zone and a moment, prints its report to
standard output and its findings to standard error, and exits 0 for nothing to
report, 1 for a finding and 2 for a request it could not carry out.

The full list is generated from the command tree into
[docs/commands.md](docs/commands.md), and `npm run check:commands` fails the
build if the two drift apart.

## Layout

| path            | what is in it                                                      |
| --------------- | ------------------------------------------------------------------ |
| `src/core`      | errors, guards, findings, identifiers, the catalogue, the glossary |
| `src/time`      | civil dates, zones, instants, windows, the five clocks             |
| `src/geo`       | positions, distance, area boundaries                               |
| `src/area`      | classification, the register, stations, reviews, consistency       |
| `src/survey`    | results, statistics, strategies, standards, the shoreline, trends  |
| `src/condition` | triggers, reopening rules, plans, closures, emergency orders       |
| `src/weather`   | gauges and their readings                                          |
| `src/tide`      | tide predictions and bed exposure                                  |
| `src/licence`   | harvester licences, dealer certifications, education, inspections  |
| `src/harvest`   | beds, records, tags, culling, seed, shipping, legality             |
| `src/vibrio`    | the time to temperature table and the clock it runs on             |
| `src/treatment` | relay, depuration, wet storage                                     |
| `src/trace`     | the movement ledger, the trace and the book audit                  |
| `src/report`    | one module per document the office produces                        |
| `src/cli`       | the command bodies and the tree                                    |
| `src/io`        | reading and writing the registers and the feeds                    |
| `src/text`      | tables, wrapping and the words numbers are printed in              |

## The four rules that decide what the others measure

If you read one file, read [docs/rules.md](docs/rules.md). It is generated from
a registry of every rule in the programme, and the part worth having is the
last line of each entry: which other rules decide what that one measures. The
build fails if it stops being true.

## Documents that are generated

Four files under `docs/` are written from the source and checked against it:
[commands.md](docs/commands.md) from the command tree,
[findings.md](docs/findings.md) from the finding catalogue, and
[glossary.md](docs/glossary.md) from the glossary, and [rules.md](docs/rules.md)
from the rule registry, which is the only place that says which rules decide
what the others measure. Run the matching write script after changing any of
them.

## Words

The glossary is the state's own, not a general one. Where this programme has
had to invent a noun the rule book does not have, the entry says so.
