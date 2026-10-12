// Restrained military-atlas palette. Political status uses muted paper tints; military control is
// overlaid as a hatched wash so the two are never confused.

export const PAPER = '#f2eee4';
export const SEA = '#d3dee3';
export const SEA_DEEP = '#c6d4da';
export const INK = '#2b2a26';
export const INK_SOFT = '#5d5a52';
export const COAST = '#8c8576';
export const BORDER = '#6e685c';
export const RIVER = '#6f93ab';
export const LAKE = '#c4d5de';
export const FRONT = '#a4161a';
export const FRONT_PREV = '#6b6b6b';
export const HELD = '#56606e';
export const SOVIET_RED = '#a3322b';
export const ALLIED_BLUE = '#2f5d8a';
export const AXIS_ARROW = '#3a4350';

export const STATUS_FILL: Record<string, string> = {
  reich: '#c4bba8',
  'reich-annexed': '#cdc5b2',
  'german-occupied': '#d9d2c2',
  'german-civil-admin': '#d9d2c2',
  axis: '#ddcfb0',
  'axis-occupied': '#e3dac6',
  soviet: '#ecd5c7',
  allied: '#d6dee3',
  'allied-occupied': '#dde4e7',
  neutral: '#efebe1',
  vichy: '#e4dfd1',
  cobelligerent: '#dfd8c4',
};

export const STATUS_LABEL: Record<string, string> = {
  reich: 'German Reich',
  'reich-annexed': 'Annexed by Germany',
  'german-occupied': 'German-occupied',
  'german-civil-admin': 'German civil administration',
  axis: 'Axis partner',
  'axis-occupied': 'Axis-occupied',
  soviet: 'Soviet Union',
  allied: 'Allied',
  'allied-occupied': 'Allied-occupied',
  neutral: 'Neutral',
  vichy: 'Vichy France',
  cobelligerent: 'Co-belligerent (Finland)',
};

export const SIDE_COLOR: Record<string, string> = { axis: AXIS_ARROW, soviet: SOVIET_RED, allied: ALLIED_BLUE, neutral: INK_SOFT };

export const FONT_SERIF = "'Atlas Serif', 'Source Serif 4', Georgia, 'Times New Roman', serif";
export const FONT_SANS = "'Atlas Sans', 'IBM Plex Sans Condensed', 'Arial Narrow', system-ui, sans-serif";
