import React, { useEffect, useState } from 'react'
import LineChart from './AnalyticsCharts/LineChart'
import BarChart from './AnalyticsCharts/BarChart'
import { DebateAnalytics } from '../types/analytics'

interface Props {
  debateId: string
  onClose?: () => void
}

const AnalyticsModal: React.FC<Props> = ({ debateId, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<DebateAnalytics | null>(null)

  useEffect(() => {
    if (!debateId) return
    setLoading(true)
    fetch(`/api/debates/${debateId}/analytics`)
      .then((r) => r.json())
      .then((json) => {
        // endpoint returns { analytics: {...}, transcript }
        const a = json.analytics || json
        setAnalytics(a || null)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [debateId])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-4 relative">
        <button
          className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
          onClick={() => onClose && onClose()}
        >
          Close
        </button>
        <h3 className="text-xl font-semibold mb-2">Debate Analytics</h3>
        {loading && <div>Loading analytics…</div>}
        {error && <div className="text-red-500">Error: {error}</div>}
        {!loading && !error && !analytics && <div>No analytics available.</div>}
        {analytics && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-2 border rounded">
                <h4 className="text-sm font-medium">Total Arguments</h4>
                <div className="text-2xl font-bold">{analytics.totalArguments}</div>
                <h4 className="mt-2 text-sm font-medium">Average Argument Length</h4>
                <div>{analytics.avgArgumentLength.toFixed(1)} chars</div>
              </div>

              <div className="p-2 border rounded">
                <h4 className="text-sm font-medium">Total Duration</h4>
                <div className="text-2xl font-bold">{Math.round(analytics.totalDurationSeconds)}s</div>
                <h4 className="mt-2 text-sm font-medium">Avg Response Time</h4>
                <div>{analytics.avgResponseTimeSecs.toFixed(1)}s</div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Rebuttals</h4>
              <BarChart data={[analytics.totalRebuttals]} labels={["Rebuttals"]} width={400} height={120} />
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Arguments Over Time (placeholder)</h4>
              {/* Placeholder series with a single point - backend could return time-series later */}
              <LineChart data={[{ x: 0, y: analytics.totalArguments }]} width={500} height={120} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsModal
