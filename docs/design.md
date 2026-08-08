# Design

The programme is layered, and the layers are the reason the composition in
this domain is tractable at all.

## The layers

| layer     | what is in it                                                      | what it may read |
| --------- | ------------------------------------------------------------------ | ---------------- |
| core      | errors, guards, findings, identifiers, the catalogue, the glossary | nothing          |
| time      | civil dates, zones, instants, windows, the five clocks             | core             |
| geo       | positions and distance                                             | core             |
| registers | areas, stations, beds, licences, certifications                    | core, time, geo  |
| rules     | classification, surveys, plans, closures, temperature, treatment   | registers        |
| reports   | one file per document the office produces                          | rules            |
| cli       | the command bodies and the tree                                    | reports          |

Nothing in the rule layer opens a file, and nothing in the register layer knows
what a standard is. That is not tidiness for its own sake: it is what makes it
possible to test the composition without a fixture directory, and it is why
every rule module can be handed the registers it needs and asked a question.

## The compositions

Six rules in here decide what other rules measure. They are the reason the
programme is shaped the way it is, and each one is documented in the module
that carries it.

1. **The classification chooses the standard and the standard reclassifies.**
   An area is held to a class, its samples are judged against that class's
   numbers, and when they fail the answer is the class its water does support,
   which is a different row of the table. `src/survey/evaluate.js`.
2. **The sampling strategy chooses the criteria and the censoring policy.**
   One set of thirty results has two verdicts, and the survey's declared
   strategy picks which one counts. `src/survey/strategy.js`.
3. **The shoreline caps what the samples support.** The bacteriological answer
   and the shoreline answer are folded with the same rule as any other
   conjunction, and the stricter wins. `src/survey/shoreline.js`.
4. **A conditional plan's closing and reopening instruments are different.**
   Rain closes, and hours or samples or tides reopen, in units the programme
   refuses to convert between. `src/condition/`.
5. **The gear decides where the temperature clock starts.** Boat gear runs from
   harvest, wading gear from the moment the falling tide uncovered the bed.
   `src/vibrio/clock.js`.
6. **An emergency order beats both the register and the plan.** It is consulted
   first and it stops the function, so the notice cites the right reason rather
   than the strictest one. `src/area/effective.js`.

## The registers

A register is a history, not a row. An area carries its classifications with
the dates each was in force between, because the question the office is asked
is almost never about today: it is about the eleventh of August, when this lot
was landed. A register that overwrote the classification could not answer it.

The same is true of licences, certifications and plans. Every one of them is
read with a date.

## What the reports promise

Every report is deterministic. `cullring walk` runs all of them over one case
and prints a sha256 of what it printed, and the worked example job runs it
twice and compares. Nothing in the report layer reads the clock, and that is
the only claim the seal is making.

## What is deliberately not here

- No laboratory instrumentation. Results arrive as a submitted sheet.
- No boat, engine or crew records. A harvester has a licence and gear.
- No retail or restaurant records. The chain stops at the dealer, and the trace
  says so rather than guessing.
- No enforcement case management. The programme reports; it does not prosecute.

## What the programme grew into

The five questions above are still the shape of it. Four things were added
that the first sketch did not have, and each of them exists because a report
that looked complete was not.

**Ground is contested and boundaries overlap.** Two areas both claim a
position often enough that the geometry cannot settle it, so the stricter
classification does, which means the answer moves when either area is
reclassified. The worked example carries a real instance: a station filed
against one area standing on ground another one governs.

**An adverse survey has to be adverse.** The strategy chooses the criteria,
and until the samples are qualified against the plan's own trigger, a set of
bottles drawn on quiet days can be filed as the strictest reading there is.
Where the caller cannot supply the plans, the survey says the condition was
never checked rather than passing it.

**Product is held separately from water.** An embargo names lots, or a dealer,
or a stretch of water and a period, and those reach product through three
different registers. A lot caught by two of them needs two releases.

**A case that holds together may still not be able to answer.** Every report
works with what it is given, and each one is honest alone: the pile of them is
not, because nothing in it says the tide table was absent and so every
intertidal clock that month was the generous reading. The coverage report says
it once, at the top.

## The documents that are generated and checked

Four, and the fourth is the one worth arguing with. `docs/rules.md` is written
from a registry that names every rule, the finding families it raises, and the
rules that decide what it measures. None of that can be derived from the
source, which is exactly why it is checked against it: a rule claiming a
family the catalogue no longer holds, two rules claiming the same family, or a
rule decided by one that has been renamed all fail the build.

## What is still deliberately not here

The four exclusions above stand. Two more have been added since.

- No scheduling of the boat beyond one day. The round says what to work next
  and what it left behind; a week's plan is a person's job.
- No opinion about which finding to fix first. The exception report ranks by
  severity and by count because both are arithmetic. A programme that ranked
  by judgement would be read as having one.
