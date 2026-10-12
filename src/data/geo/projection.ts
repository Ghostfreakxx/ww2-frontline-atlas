// Shared map projection config. World units: the default Europe extent fits a 1600 x 1000 frame.
// Used by the client renderer and the Node build scripts (relief, territory).
export const projectionConfig = {
  "type": "conicConformal",
  "parallels": [
    40,
    64
  ],
  "rotate": [
    -24,
    0
  ],
  "fitExtent": {
    "west": -11,
    "east": 56,
    "south": 34.5,
    "north": 70.5
  },
  "worldWidth": 1600,
  "worldHeight": 1000,
  "dataBBox": [
    -24,
    27,
    88,
    78
  ]
} as const;
