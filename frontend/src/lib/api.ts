import type {
  AnalyticsOverview,
  CycloneDetail,
  CycloneList,
  CycloneTrackSummary,
  Era5Coverage,
  Era5Environment,
  HealthStatus,
  IntensityPrediction,
  ModelMetadata,
  RiskResult,
  StrongestCyclone,
  TcirOverview,
  TcirSample,
  TcirSampleList,
  TrackForecastModelMetadata,
  TrackForecastResult,
  YearlyCount,
} from '@/types'

const BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8050'}/api`

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<HealthStatus>('/health'),

  listCyclones: (params: {
    page?: number
    limit?: number
    search?: string
    season?: number
    basin?: string
    min_wind?: number
    max_wind?: number
  }) => get<CycloneList>('/cyclones', params),

  getCyclone: (sid: string) => get<CycloneDetail>(`/cyclones/${sid}`),
  cycloneTracks: (params: { season?: number; basin?: string; min_wind?: number; limit?: number }) =>
    get<CycloneTrackSummary[]>('/cyclones/tracks', params),

  analyticsOverview: () => get<AnalyticsOverview>('/analytics/overview'),
  analyticsYearly: () => get<YearlyCount[]>('/analytics/yearly'),
  strongestCyclones: (limit = 10) => get<StrongestCyclone[]>('/analytics/strongest-cyclones', { limit }),

  era5Coverage: () => get<Era5Coverage>('/era5/coverage'),
  era5Environment: (latitude: number, longitude: number, timestamp: string) =>
    get<Era5Environment>('/era5/environment', { latitude, longitude, timestamp }),

  tcirOverview: () => get<TcirOverview>('/tcir/overview'),
  tcirSamples: (params: { page?: number; limit?: number; dataset?: string; cyclone_id?: string }) =>
    get<TcirSampleList>('/tcir/samples', params),
  tcirSample: (index: number) => get<TcirSample>(`/tcir/sample/${index}`),
  tcirSampleImageUrl: (index: number, channel: number) =>
    `${BASE_URL}/tcir/sample/${index}/image?channel=${channel}`,
  tcirModel: () => get<ModelMetadata>('/tcir/model'),
  tcirPredict: async (index: number): Promise<IntensityPrediction> => {
    const res = await fetch(`${BASE_URL}/tcir/sample/${index}/predict`, { method: 'POST' })
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json()
  },

  predict: async (input: {
    latitude: number
    longitude: number
    wind_speed: number
    pressure: number
    sst: number
  }): Promise<RiskResult> => {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json()
  },

  trackForecastModel: () => get<TrackForecastModelMetadata>('/predict/track-forecast/model'),
  trackForecast: (params: {
    latitude: number
    longitude: number
    storm_speed: number
    storm_direction: number
    wind_speed: number
    pressure?: number
    prev_storm_speed?: number
    prev_storm_direction?: number
  }) => get<TrackForecastResult>('/predict/track-forecast', params),
}
