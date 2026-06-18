// Shared chart colours + axis styling for the light dashboard.

export const CHART = {
  grid: '#e5e7eb', // neutral-200
  axis: '#9ca3af', // neutral-400
  text: '#6b7280', // neutral-500
  cursor: 'rgba(0,0,0,0.04)',
  accepted: '#059669', // emerald-600
  open: '#0284c7', // sky-600
  refused: '#e11d48', // rose-600
  margin: '#7c3aed', // violet-600
  marginPct: '#d97706', // amber-600
  runTime: '#0891b2', // cyan-600
  deals: '#d4d4d8', // neutral-300
} as const;

// Donut palette for lead sources.
export const SOURCE_COLORS = [
  '#059669', // emerald-600
  '#0284c7', // sky-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#2563eb', // blue-600
  '#db2777', // pink-600
];

export const AXIS_TICK = { fill: CHART.text, fontSize: 12 } as const;
