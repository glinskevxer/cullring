# Commands

This file is generated from the command tree by `tools/write_commands.js`.
Run that after adding a command; `tools/check_commands.js` fails the build if
the two have drifted apart.

## validate

read a case directory and report what is wrong with it

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-q, --quiet` print the counts but not the findings

## standing

the classification in force for every area at a moment

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-a, --at <stamp>` the moment to ask about (required)
- `-f, --from <date>` the day the walk over the feed starts

## closures

every closure of one area in a period

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-a, --at <stamp>` the end of the period (required)
- `-f, --from <date>` the day the period starts
- `-o, --on <date>` the day the plan is read as in force on

## notice

the closure notice for one area

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-a, --at <stamp>` the moment to ask about (required)
- `-f, --from <date>` the day the walk over the feed starts
- `-o, --on <date>` the day the plan is read as in force on

## survey

score the results for an area and propose a classification

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day the survey is scored as at (required)
- `-s, --strategy <name>` systematic random or adverse pollution condition
- `-n, --analysis <name>` fecal coliform or total coliform
- `-t, --held-to <class>` the class to score against, if not the register one
- `-b, --both` print the same results under both strategies

## landings

every lot landed on a day, checked against every register

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to look at (required)
- `-f, --from <date>` the day the walk over the feed starts

## lot

everything the programme knows about one lot

Arguments:

- `lot` the lot number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-f, --from <date>` the day the walk over the feed starts

## trace

walk back from a lot number to the water it came out of

Arguments:

- `lot` the lot number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON

## forward

walk forward from a lot number to everywhere it went

Arguments:

- `lot` the lot number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON

## recall

everything landed out of an area in a period, and where it went

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the first day of the period (required)
- `-t, --to <date>` the last day of the period

## dealer

a dealer certification and what it permits on a day

Arguments:

- `dealer` the certification number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to ask about (required)

## harvester

a harvester licence and what it permits on a day

Arguments:

- `harvester` the licence number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to ask about (required)

## beds

the beds in an area, with the tide station each is read against

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON

## tide

when a bed comes out of the water on a day

Arguments:

- `bed` the bed number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to ask about (required)

## vibrio

the time to temperature table for the region an area sits in

Arguments:

- `area` the area number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON

## month

the monthly programme report

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` any day in the month (required)

## walk

every report over one case, with a seal at the end

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day the walk is run as at (required)
- `--digest-only` print only the seal

## programme

which reviews are overdue and which stations are due a visit

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to ask about (required)

## orders

the emergency orders, and whether any could be lifted

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-a, --at <stamp>` the moment to ask about (required)
- `-r, --area <area>` only the orders over one area

## book

a dealer book, what it permits, and whether it reconciles

Arguments:

- `dealer` the certification number (required)

Options:

- `-c, --case <directory>` the case directory to read (required)
- `-z, --zone <zone>` the zone the office keeps (default eastern)
- `--json` print the answer as JSON
- `-o, --on <date>` the day to read the certification on (required)
