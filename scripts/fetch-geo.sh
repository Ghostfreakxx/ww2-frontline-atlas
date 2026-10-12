#!/usr/bin/env bash
# Downloads the raw Natural Earth (public domain) files used by scripts/build-geo.mjs and build-control.mjs.
# Terrain tiles for build-relief.mjs are downloaded (and cached) by that script itself.
set -euo pipefail
DIR="${NE_RAW_DIR:-.geo-raw}"
mkdir -p "$DIR"
BASE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_50m_admin_0_countries ne_50m_land ne_10m_lakes ne_10m_rivers_lake_centerlines ne_10m_rivers_europe; do
  [ -f "$DIR/$f.geojson" ] || curl -fsSL -o "$DIR/$f.geojson" "$BASE/$f.geojson"
  echo "ok $f"
done
