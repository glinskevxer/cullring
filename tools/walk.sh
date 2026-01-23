#!/usr/bin/env bash
# Run every command against the worked example and check what came back.
#
# This is the job that catches what the unit tests cannot: a command wired to
# the wrong body, an option renamed on one side only, and a report that reads
# the clock. It runs the commands rather than importing them, because the wiring
# is the part under test.
set -euo pipefail

CASE=examples/core-sound
RUN="node bin/cullring.js"

expect_out() {
  local description="$1"; shift
  local wanted="$1"; shift
  local got
  got="$("$@" 2>/dev/null || true)"
  if ! printf '%s' "$got" | grep -q -- "$wanted"; then
    echo "FAIL: $description did not print '$wanted'"
    printf '%s\n' "$got" | head -20
    exit 1
  fi
  echo "ok: $description"
}

expect_code() {
  local description="$1"; shift
  local wanted="$1"; shift
  local code=0
  "$@" >/dev/null 2>&1 || code=$?
  if [ "$code" -ne "$wanted" ]; then
    echo "FAIL: $description exited $code, wanted $wanted"
    exit 1
  fi
  echo "ok: $description exits $wanted"
}

expect_out "validate" "Findings" $RUN validate -c "$CASE"
expect_out "the register holds together" "Register holds together: yes" $RUN validate -c "$CASE"
expect_out "standing" "Growing area standing" $RUN standing -c "$CASE" -a "2025-06-11 09:00" -f 2025-06-01
expect_out "standing shuts two areas" "Shut by a plan or an order: 2" $RUN standing -c "$CASE" -a "2025-06-11 09:00" -f 2025-06-01
expect_out "closures" "Closures for B-14" $RUN closures B-14 -c "$CASE" -a "2025-06-30 00:00" -f 2025-06-01
expect_out "notice" "Closure lifted" $RUN notice B-12 -c "$CASE" -a "2025-06-20 09:00" -f 2025-06-01
expect_out "survey" "Supported:" $RUN survey B-12 -c "$CASE" -o 2025-09-30
expect_out "survey both" "highest single result" $RUN survey B-14 -c "$CASE" -o 2025-09-30 --both
expect_out "landings" "20250814-B12-001" $RUN landings -c "$CASE" -o 2025-08-14 -f 2025-08-01
expect_out "lot" "Lot 20250814-D2-001" $RUN lot 20250814-D2-001 -c "$CASE" -f 2025-08-01
expect_out "trace" "Complete:" $RUN trace 20250815-C3-101 -c "$CASE"
expect_out "forward" "Piedmont Fish House" $RUN forward 20250814-C3-001 -c "$CASE"
expect_out "recall" "Lots landed" $RUN recall C-3 -c "$CASE" -o 2025-08-14 -t 2025-08-19
expect_out "dealer" "shucker packer" $RUN dealer SP-118 -c "$CASE" -o 2025-08-14
expect_out "harvester" "Suspended" $RUN harvester SH-2025-00877 -c "$CASE" -o 2025-07-14
expect_out "beds" "B12-BCK" $RUN beds B-12 -c "$CASE"
expect_out "tide" "Tide station" $RUN tide B12-BCK -c "$CASE" -o 2025-08-14
expect_out "vibrio" "Time to temperature" $RUN vibrio B-12 -c "$CASE"
expect_out "an order beats the plan" "EO-2025-05, spill" $RUN standing -c "$CASE" -a "2025-09-05 09:00" -f 2025-09-01
expect_out "a shut season is found" "was shut on that day" $RUN landings -c "$CASE" -o 2025-08-15 -f 2025-08-01
expect_out "a lapsed certificate is found" "let the certificate lapse" $RUN landings -c "$CASE" -o 2025-08-18 -f 2025-08-01
expect_out "book" "Reconciliation" $RUN book SP-118 -c "$CASE" -o 2025-08-14
expect_out "chart" "Classification history" $RUN chart B-12 -c "$CASE" -o 2025-09-30
expect_out "chart names the bank" "marina" $RUN chart B-12 -c "$CASE" -o 2025-09-30
expect_out "export" "Broad Creek" $RUN export -c "$CASE" -r B-12
expect_out "export landings" "20250814-B12-001" $RUN export -c "$CASE" -s landings -o 2025-08-14
expect_out "inspections" "Inspection round" $RUN inspections -c "$CASE" -o 2025-09-30
expect_out "a shut plant is found" "shut until it is re-inspected" $RUN inspections -c "$CASE" -o 2025-06-30
expect_out "and put back on the round" "2026-07-15" $RUN inspections -c "$CASE" -o 2025-09-30
expect_out "orders" "Emergency orders" $RUN orders -c "$CASE" -a "2025-09-05 09:00"
expect_out "programme" "Programme standing" $RUN programme -c "$CASE" -o 2025-09-30
expect_out "month" "Programme report" $RUN month -c "$CASE" -o 2025-08-14
expect_out "walk" "sha256" $RUN walk -c "$CASE" -o 2025-08-31

expect_code "a clean day" 0 $RUN landings -c "$CASE" -o 2025-08-20 -f 2025-08-01
expect_code "a day with findings" 1 $RUN landings -c "$CASE" -o 2025-08-14 -f 2025-08-01
expect_code "an area that is not there" 2 $RUN beds Z-9 -c "$CASE"

first="$($RUN walk -c "$CASE" -o 2025-08-31 --digest-only)"
second="$($RUN walk -c "$CASE" -o 2025-08-31 --digest-only)"
if [ "$first" != "$second" ]; then
  echo "FAIL: the walk did not seal to the same digest twice"
  exit 1
fi
echo "ok: the walk seals to $first twice"

node tools/check_commands.js
node tools/check_exports.js
node tools/check_findings.js
node tools/check_glossary.js
node tools/check_readme.js
echo "the worked example walk passed"
