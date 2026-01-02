import React, { useEffect, useState } from 'react'
import LineChart from '@/components/AnalyticsCharts/LineChart'
import BarChart from '@/components/AnalyticsCharts/BarChart'
import { DebateAnalytics, UserAnalyticsResponse, RecentDebate } from '@/types/analytics'

const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalyticsResponse | null>(null)

  // NOTE: replace with real user id or wire into app state
  const userId = localStorage.getItem('userId') || ''

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/users/${userId}/analytics`)
      .then((r) => r.json())
      .then((json) => {
        setUserAnalytics(json.analytics || json.stats || null)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [userId])

  if (!userId) {
    return <div>Please sign in to view analytics.</div>
  }

  if (loading) return <div>Loading analytics…</div>
  if (error) return <div>Error: {error}</div>
  if (!userAnalytics) return <div>No analytics available yet.</div>

  // Prepare sample series
  const lineSeries = (userAnalytics.recentDebates || []).map((d: RecentDebate, i) => ({
    x: d.date ? new Date(d.date).toLocaleString() : `#${i + 1}`,
    y: d.analytics?.totalArguments ?? 0,
  }))
  const avgArgs = userAnalytics.avgArgumentsPerDebate || userAnalytics.avgArgumentsPerDebate === 0 ? userAnalytics.avgArgumentsPerDebate : undefined

  return (
    <div style={{ padding: 20 }}>
      <h1>Analytics</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3>Arguments Over Time</h3>
          <LineChart data={lineSeries} width={600} height={250} />
        </div>

        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3>Average Arguments</h3>
          <div style={{ fontSize: 32, fontWeight: 600 }}>{avgArgs?.toFixed(1) ?? '-'}</div>
          <BarChart
            data={[(userAnalytics.avgArgumentsPerDebate || 0), (userAnalytics.avgResponseTimeSecs || 0)]}
            labels={['Avg Arguments', 'Avg Resp (s)']}
            width={300}
            height={200}
          />
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>Recent Debates</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Topic</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Result</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Arguments</th>
            </tr>
          </thead>
          <tbody>
            {userAnalytics.recentDebates?.map((d: any) => (
              <tr key={d.id}>
                <td style={{ padding: 8 }}>{new Date(d.date).toLocaleString()}</td>
                <td style={{ padding: 8 }}>{d.topic}</td>
                <td style={{ padding: 8 }}>{d.result}</td>
                <td style={{ padding: 8 }}>{d.analytics?.totalArguments ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default AnalyticsDashboard
