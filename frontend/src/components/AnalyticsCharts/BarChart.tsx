import React from 'react'

interface Props {
  data: number[]
  labels?: string[]
  width?: number
  height?: number
}

const BarChart: React.FC<Props> = ({ data, labels = [], width = 300, height = 150 }) => {
  if (!data || data.length === 0) return <svg width={width} height={height}></svg>
  const max = Math.max(...data, 1)
  const pad = 20
  const barW = (width - pad * 2) / data.length
  return (
    <svg width={width} height={height}>
      {data.map((v, i) => {
        const h = ((v / max) * (height - pad * 2))
        const x = pad + i * barW
        const y = height - pad - h
        return (
          <g key={i}>
            <rect x={x + 6} y={y} width={barW - 12} height={h} fill="#10b981" />
            <text x={x + barW / 2} y={height - 6} fontSize={10} textAnchor="middle">{labels[i] ?? ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default BarChart
