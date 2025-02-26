import React, { useEffect, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface TimerProps {
  initialTime: number // The initial countdown time in seconds
}

const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (time % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const Timer: React.FC<TimerProps> = ({ initialTime }) => {
  const [time, setTime] = useState<number>(initialTime)
  // Synchronize state with the latest `initialTime` prop
  useEffect(() => {
    setTime(initialTime) // Update `time` whenever `initialTime` changes
  }, [initialTime])
  useEffect(() => {
    if (time <= 0) return

    const timerId = setInterval(() => {
      setTime((prevTime) => prevTime - 1)
    }, 1000)

    return () => clearInterval(timerId) // Cleanup the interval
  }, [time])

  const formattedTime = formatTime(time)

  return (
    <div className={cn('flex items-center gap-2 p-2')}>
      <span className="text-lg font-medium">{formattedTime}</span>
      <Separator orientation="vertical" className="h-5 bg-muted" />
      <span className="text-sm text-muted-foreground">Time Remaining</span>
    </div>
  )
}

export default Timer
