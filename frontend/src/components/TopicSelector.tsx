import React from 'react'
import { Button } from '@/components/ui/button'

const TopicSelector: React.FC = () => {
  return (
    <div className="w-full md:w-1/4 h-4/5 flex flex-col border">
      <div className="text-2xl py-4 mb-4 text-center border rounded">
        Choose topic
      </div>
      <div className="flex flex-col gap-y-2 px-4">
        <Button variant={'outline'}>
          Is it better to wake up early or stay up late?
        </Button>
        <Button variant={'outline'}>Can money really buy happiness?</Button>
        <Button variant={'outline'}>
          Daydreaming: Productive or time-wasting activity?
        </Button>
        <Button variant={'outline'}>
          Winter vs. summer: Best season ever?
        </Button>
        <Button variant={'outline'}>
          Social media: Connecting or isolating people?
        </Button>
      </div>
      <div className="mt-auto p-4">
        <Button className="w-full">Play</Button>
      </div>
    </div>
  )
}

export default TopicSelector
