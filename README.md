# cullring

The shellfish sanitation program of a coastal state's marine fisheries
division: growing area classification, conditional area management, harvest
legality, time and temperature control, and the trace that runs backwards from
a reported case to the water it came out of.

This is the office program, not a laboratory system and not an enforcement
system. Results arrive as submitted sheets, rainfall arrives as gauge readings,
and what leaves is a decision somebody has to be able to defend.

## Why it is shaped the way it is

The rules in this domain are not a list of independent checks. They select each
other. An area's classification decides which standard its samples are judged
against, and the verdict of that judgement is a new classification. A
conditionally approved area carries its own closing trigger and its own
reopening test, and the two are different instruments. The clock on a lot of
oysters starts at harvest or at the moment a falling tide first uncovered the
bed, and which one it is depends on the gear.

So the package is layered rather than flat. The registers hold what was
recorded. The rules read registers and produce findings. The reports read
findings. Nothing in the rule layer reads a file and nothing in the register
layer knows what a standard is.

## Getting started

```
npm install
npm test
```

## Layout

| path       | what is in it                                             |
| ---------- | --------------------------------------------------------- |
| `src/core` | errors, guards, the small vocabulary everything else uses |

## Words

The glossary is the one in the state's own shellfish sanitation rule, not a
general one. Where this program has had to invent a word it says so in
`docs/glossary.md`.
