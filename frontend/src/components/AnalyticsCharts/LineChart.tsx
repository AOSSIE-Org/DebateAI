import React from 'react'

type Point = { x: string | number; y: number }

interface Props {
  data: Point[]
  width?: number
  height?: number
}

const LineChart: React.FC<Props> = ({ data, width = 600, height = 200 }) => {
  if (!data || data.length === 0) return <svg width={width} height={height}></svg>
  const ys = data.map((p) => p.y)
  const xs = data.map((_, i) => i)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 1)
  const pad = 20

  const points = data
    .map((p, i) => {
      const x = pad + (i / (data.length - 1 || 1)) * (width - pad * 2)
      const y = pad + ((maxY - p.y) / (maxY - minY || 1)) * (height - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height}>
      <polyline fill="none" stroke="#3b82f6" strokeWidth={2} points={points} />
      {data.map((p, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (width - pad * 2)
        const y = pad + ((maxY - p.y) / (maxY - minY || 1)) * (height - pad * 2)
        return <circle key={i} cx={x} cy={y} r={3} fill="#1d4ed8" />
      })}
    </svg>
  )
}

export default LineChart
