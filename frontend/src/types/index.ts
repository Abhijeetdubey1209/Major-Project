export interface CycloneSummary {
  sid: string
  name: string | null
  season: number | null
  basin: string | null
  subbasin: string | null
  start_time: string | null
  end_time: string | null
  max_wind: number | null
  min_pressure: number | null
  track_points_count: number
  track_length_km: number | null
}

export interface CycloneList {
  items: CycloneSummary[]
  total: number
  page: number
  limit: number
}

export interface TrackPoint {
  timestamp: string
  latitude: number
  longitude: number
  wind_speed: number | null
  pressure: number | null
  storm_speed: number | null
  storm_direction: number | null
}

export interface CycloneDetail extends CycloneSummary {
  track: TrackPoint[]
}

export interface AnalyticsOverview {
  total_cyclones: number
  total_track_points: number
  max_wind_recorded: number | null
  min_pressure_recorded: number | null
  average_max_wind: number | null
  season_range: [number, number]
  basins: Record<string, number>
}

export interface YearlyCount {
  season: number
  count: number
}

export interface CycloneTrackSummary {
  sid: string
  name: string | null
  season: number | null
  max_wind: number | null
  points: [number, number][]
}

export interface StrongestCyclone {
  sid: string
  name: string | null
  season: number | null
  max_wind: number | null
  min_pressure: number | null
}

export interface HealthStatus {
  status: string
  datasets: {
    tcir: boolean
    ibtracs: boolean
    era5: boolean
  }
}

export interface Era5Coverage {
  available: boolean
  start_time?: string
  end_time?: string
  latitude_min?: number
  latitude_max?: number
  longitude_min?: number
  longitude_max?: number
  variables?: string[]
}

export interface Era5Environment {
  available: boolean
  reason?: string
  matched_timestamp?: string
  matched_latitude?: number
  matched_longitude?: number
  u10?: number
  v10?: number
  wind_speed?: number
  wind_direction?: number
  pressure_hpa?: number
  sst_celsius?: number
}

export interface TcirOverview {
  available: boolean
  total_samples: number
  unique_cyclones: number
  dataset_distribution: Record<string, number>
  time_range: [string, string]
  vmax_stats: { min: number; max: number; mean: number }
  mslp_stats: { min: number; max: number; mean: number }
  channels: string[]
}

export interface TcirSample {
  index: number
  id: string
  dataset: string
  lat: number
  lon: number
  time: string
  vmax: number
  mslp: number
  r35_4qavg: number
  channels?: string[]
}

export interface TcirSampleList {
  items: TcirSample[]
  total: number
  page: number
  limit: number
}

export interface ModelMetadata {
  available: boolean
  model_type?: string
  target?: string
  training_samples?: number
  test_samples?: number
  unique_cyclones?: number
  test_metrics?: { mae: number; rmse: number; r2: number }
  trained_at?: string
}

export interface IntensityPrediction {
  available: boolean
  reason?: string
  index?: number
  predicted_vmax?: number
  actual_vmax?: number
  error?: number
  model_type?: string
  test_mae?: number
  test_r2?: number
  trained_at?: string
}

export interface TrackForecastPoint {
  hours_ahead: number
  latitude: number
  longitude: number
  bearing_deg: number
  distance_km: number
  expected_error_km: number | null
  p90_error_km: number | null
}

export interface TrackForecastResult {
  available: boolean
  reason?: string
  points?: TrackForecastPoint[]
}

export interface TrackForecastModelMetadata {
  available: boolean
  model_type?: string
  horizons_hours?: number[]
  metrics_by_horizon?: Record<
    string,
    { training_samples: number; test_samples: number; mean_error_km: number; median_error_km: number; p90_error_km: number }
  >
  trained_at?: string
}

export interface RiskResult {
  latitude: number
  longitude: number
  risk_score: number
  risk_level: 'Low' | 'Moderate' | 'High' | 'Extreme'
  explanation: string[]
  factors: {
    sst_score: number
    pressure_score: number
    wind_score: number
  }
}
