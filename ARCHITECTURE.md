# Architecture

A short note on the shape, for somebody about to change something. The
reasoning is in [docs/design.md](docs/design.md); this is the map.

## Dependencies run one way

    core  <-  time, geo
          <-  area, survey, condition, weather, tide, licence
          <-  harvest, vibrio, treatment, trace
          <-  report
          <-  cli

Nothing in `src/report` is imported by anything under it, and nothing outside
`src/io` and `src/cli` opens a file. `tools/check_exports.js` holds every module
to its package index and every package to `src/index.js`, which is what stops a
module becoming reachable only through a path nobody meant.

## Values are frozen

Every record the programme builds comes back frozen, and every list handed out
of a table is a copy. A caller that wants to change something builds a new one.
This costs nothing at this size and it removes a whole class of question about
whether a register was modified halfway through a report.

## Nothing throws at a rule boundary

A rule collects findings and hands them back. It throws only when the caller
handed it something it cannot read, which is a different thing and carries a
different error type. The command line prints the two differently, because one
is a typing mistake and the other is a finding.

## Time is explicit

Nothing in the source calls the system clock. Every question about time takes
the moment it is asked about, which is why `cullring walk` can seal its output
and compare two runs. The one place a clock could get in is the command line,
and it takes `--at` and `--on` rather than defaulting to today.

## Where to add a rule

- A new fact about water goes in `src/area` or `src/survey`.
- A new fact about a person or a plant goes in `src/licence`.
- A new fact about a lot goes in `src/harvest` or `src/vibrio`.
- Anything that reads two of those is a rule, and it goes in the module that
  owns the question rather than in a new one.
- Every finding code it raises goes in `src/core/catalogue.js` in the same
  commit, or `npm run check:findings` fails.
