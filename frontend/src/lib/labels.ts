/** Friendly names for scientific codes/abbreviations used across the app. */

export const CHANNEL_LABELS: Record<string, { name: string; hint: string }> = {
  IR1: { name: 'Infrared', hint: 'Cloud-top temperature — shows storm structure day or night' },
  WV: { name: 'Water Vapor', hint: 'Moisture in the upper atmosphere' },
  VIS: { name: 'Visible', hint: 'Like a regular photo — only available in daylight' },
  PMW: { name: 'Rainfall (Microwave)', hint: 'Rain intensity sensed through cloud cover' },
}

export const ERA5_VARIABLE_LABELS: Record<string, string> = {
  u10: 'Wind (East-West component)',
  v10: 'Wind (North-South component)',
  msl: 'Air Pressure',
  sst: 'Sea Surface Temperature',
}

export const DATASET_LABELS: Record<string, string> = {
  CPAC: 'Central Pacific',
  IO: 'Indian Ocean',
  SH: 'Southern Hemisphere',
  NI: 'North Indian Ocean',
  WP: 'Western Pacific',
}

export function friendlyChannel(code: string): string {
  return CHANNEL_LABELS[code]?.name ?? code
}

export function friendlyEra5Variable(code: string): string {
  return ERA5_VARIABLE_LABELS[code] ?? code
}

export function friendlyDataset(code: string): string {
  return DATASET_LABELS[code] ?? code
}
