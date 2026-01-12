# Changelog

## Unreleased

The programme is not versioned yet. It is run out of the working copy by the
office that wrote it, and the commit is the version. Notable changes are
recorded here from the point at which the command line became something other
people run.

- The commands document, the findings catalogue and the glossary are now
  generated from the source and checked against it. Three of the four checks
  found something on their first run.
- `walk` seals what it printed, so two runs over one case can be compared.
- The register is checked against its own boundaries, which is the only thing
  that would notice a station typed into the wrong area.
- The dealer book audit reconciles what came in against what went out, and
  tells a remainder still in the cooler from a discrepancy.
