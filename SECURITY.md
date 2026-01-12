# Security

This programme reads files off a disk and writes text to a terminal. It opens
no sockets, runs no subprocesses, and has one runtime dependency.

## What it trusts

The case directory. Everything in it is treated as data written by the office
or by a dealer, and every loader is written to survive a malformed one: a bad
row is reported with its line number and the rest of the file is read. Nothing
in a case file is evaluated, interpolated into a shell command, or used as a
path.

## What it does not do

- It does not write to the case directory. `export` writes to standard output.
- It does not follow anything in a case file that looks like a path.
- It does not read anything outside the case directory the caller named.

## Reporting

This is a state office programme. Anything found here goes to the shellfish
sanitation branch rather than to a public tracker.
