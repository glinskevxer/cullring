#!/usr/bin/env bash
# Run the programme the way somebody who installed it would.
#
# The suite imports the modules and the walk runs the CLI out of the checkout.
# Neither of them touches the thing that actually breaks a release, which is
# the packing: a file left out of the files list, a bin entry pointing at a
# path that only exists in the repository, an import of a devDependency from
# inside src. All three produce a package that passes every test and does
# nothing when it is installed.
#
# So this packs the tarball, installs it somewhere else, and runs it from the
# installed name with no reference to the checkout at all.
set -euo pipefail

here="$(pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "packing"
tarball="$(npm pack --silent --pack-destination "$work")"

cd "$work"
mkdir installed
cd installed
npm init -y >/dev/null 2>&1
npm install --silent --omit=dev "$work/$tarball" >/dev/null

run() {
  local description="$1"; shift
  local wanted="$1"; shift
  local got
  got="$(npx --no-install cullring "$@" 2>&1 || true)"
  if ! printf '%s' "$got" | grep -q -- "$wanted"; then
    echo "FAIL: $description did not print '$wanted'"
    printf '%s\n' "$got" | head -20
    exit 1
  fi
  echo "ok: $description"
}

# The examples ship with the package, so an installed copy can be tried against
# them without the checkout being anywhere near.
example="node_modules/cullring/examples/core-sound"

run "the help" "shellfish sanitation" --help
run "the version" "1.0.0" --version
run "validate" "Register holds together: yes" validate -c "$example"
run "standing" "Growing area standing" standing -c "$example" -a "2025-06-11 09:00" -f 2025-06-01
run "the walk seals" "sha256" walk -c "$example" -o 2025-08-31
run "coverage" "Reports that are complete" coverage -c "$example"

installed="$(npx --no-install cullring walk -c "$example" -o 2025-08-31 --digest-only)"
cd "$here"
checkout="$(node bin/cullring.js walk -c examples/core-sound -o 2025-08-31 --digest-only)"
if [ "$installed" != "$checkout" ]; then
  echo "FAIL: the installed copy sealed to $installed and the checkout to $checkout"
  exit 1
fi
echo "ok: the installed copy and the checkout seal to the same digest"
echo "the smoke test passed"
