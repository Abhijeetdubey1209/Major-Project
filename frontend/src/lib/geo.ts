export function windColor(kt: number | null): string {
  if (kt == null) return '#8ea3bd'
  if (kt >= 113) return '#f87171'
  if (kt >= 64) return '#f59e0b'
  if (kt >= 34) return '#22d3ee'
  return '#38bdf8'
}

/** Great-circle distance in kilometers (matches backend app/utils/geo.py::haversine_km). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0088
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
