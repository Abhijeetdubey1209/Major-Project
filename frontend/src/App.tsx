import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { CycloneExplorer } from '@/pages/CycloneExplorer'
import { CycloneDetail } from '@/pages/CycloneDetail'
import { GlobalMap } from '@/pages/GlobalMap'
import { Simulator } from '@/pages/Simulator'
import { Satellite } from '@/pages/Satellite'
import { Predict } from '@/pages/Predict'
import { DataSources } from '@/pages/DataSources'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout title="Dashboard" subtitle="Historical Tracking • Satellite Intelligence • Risk Estimation">
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/cyclones"
        element={
          <AppLayout title="Cyclone Explorer" subtitle="Search and filter historical cyclone records">
            <CycloneExplorer />
          </AppLayout>
        }
      />
      <Route
        path="/cyclones/:sid"
        element={
          <AppLayout title="Cyclone Detail">
            <CycloneDetail />
          </AppLayout>
        }
      />
      <Route
        path="/map"
        element={
          <AppLayout title="Global Map" subtitle="Historical cyclone tracks across all matching storms">
            <GlobalMap />
          </AppLayout>
        }
      />
      <Route
        path="/simulator"
        element={
          <AppLayout title="Cyclone Simulator" subtitle="Replay a real historical storm and watch the model forecast it step by step">
            <Simulator />
          </AppLayout>
        }
      />
      <Route
        path="/satellite"
        element={
          <AppLayout title="Satellite Explorer" subtitle="Browse real cyclone satellite images and AI wind-speed predictions">
            <Satellite />
          </AppLayout>
        }
      />
      <Route
        path="/predict"
        element={
          <AppLayout title="Risk Estimation" subtitle="Severity scoring plus a trained track forecast, from a storm's current position and motion">
            <Predict />
          </AppLayout>
        }
      />
      <Route
        path="/data"
        element={
          <AppLayout title="Data Sources" subtitle="Dataset coverage and integration status">
            <DataSources />
          </AppLayout>
        }
      />
    </Routes>
  )
}

export default App
