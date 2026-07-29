# The rules

Generated from `src/core/rules.js` by `npm run write:rules`. Every rule the
programme applies, the finding families it raises, and the rules that decide
what it measures.

## emergency orders

an order beats the register and the plan for as long as it stands

- Lives in `src/condition/emergency.js`
- Raises nothing of its own
- Decided by nothing else

## harvest legality

whether one lot was lawfully taken, by water, person, ground, season and size

- Lives in `src/harvest/legality.js`
- Raises `harvest.*`, `cull.*`, `seed.*`, `limit.*`
- Decided by the classification in force, the licence, the lease, time to temperature, the dealer certification

## register holds together

everything the register names exists, and every position is where it says it is

- Lives in `src/area/consistency.js`
- Raises `register.*`, `locate.*`
- Decided by nothing else

## the adverse condition

an adverse survey may only read samples taken while the trigger was firing

- Lives in `src/survey/conditions.js`
- Raises `conditions.*`
- Decided by the management plan

## the classification in force

what class an area is in at a moment, once the plan and any order are read

- Lives in `src/area/effective.js`
- Raises `area.*`, `order.*`
- Decided by the management plan, emergency orders

## the dealer certification

a dealer may only do what the certification lists

- Lives in `src/licence/dealer.js`
- Raises `book.*`, `inspection.*`
- Decided by the classification in force

## the embargo

product named by an embargo does not move until somebody signs a release

- Lives in `src/harvest/embargo.js`
- Raises `embargo.*`
- Decided by the trace

## the lease

who held the ground on the day, and whether the lease was suspended

- Lives in `src/area/lease.js`
- Raises `lease.*`
- Decided by the classification in force

## the licence

whether a licence was current, unsuspended and endorsed for the gear

- Lives in `src/licence/harvester.js`
- Raises `renewal.*`
- Decided by nothing else

## the management plan

whether a conditional area is shut, and what reopens it

- Lives in `src/condition/closure.js`
- Raises nothing of its own
- Decided by the classification in force

## the register is readable

the case directory parses into records the rest of the programme can read

- Lives in `src/io/load.js`
- Raises `case.*`, `csv.*`, `load.*`, `schema.*`, `migrate.*`
- Decided by nothing else

## the sampling programme

how often each station is sampled, and which are due

- Lives in `src/survey/schedule.js`
- Raises `schedule.*`, `rotation.*`, `review.*`
- Decided by the classification in force

## the sampling strategy

which criteria are scored and how a censored result is read

- Lives in `src/survey/strategy.js`
- Raises nothing of its own
- Decided by nothing else

## the shoreline cap

the survey caps what the samples can support, whatever they say

- Lives in `src/survey/shoreline.js`
- Raises nothing of its own
- Decided by nothing else

## the survey verdict

what class the samples support, walked from the strictest down

- Lives in `src/survey/evaluate.js`
- Raises `survey.*`, `duplicate.*`, `laboratory.*`
- Decided by the sampling strategy, the adverse condition, the shoreline cap

## the tag

what has to be written on a container, which depends on the form

- Lives in `src/harvest/tag.js`
- Raises `tag.*`, `ship.*`
- Decided by nothing else

## the trace

where a lot came from and everywhere it went

- Lives in `src/trace/trace.js`
- Raises `trace.*`, `audit.*`, `advisory.*`
- Decided by the tag

## the treatment

restricted product is legal only after relay or depuration

- Lives in `src/treatment/depuration.js`
- Raises `depuration.*`, `relay.*`, `wet.*`
- Decided by the classification in force, the dealer certification

## time to temperature

how long a lot had, counted from where the gear says the clock starts

- Lives in `src/vibrio/compliance.js`
- Raises `vibrio.*`
- Decided by nothing else

## what the case can answer

which reports are narrower than they look because a register is not there

- Lives in `src/report/coverage.js`
- Raises `coverage.*`
- Decided by the register is readable
