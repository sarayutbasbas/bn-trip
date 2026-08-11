#!/bin/zsh
set -eu

/usr/local/bin/orb start
cd /Users/basukekung/Projects/bn-trip
/usr/local/bin/docker compose up -d
