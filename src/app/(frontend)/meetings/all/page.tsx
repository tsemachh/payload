import { Suspense } from 'react'
import LoadingSpinnerDiamond from '@/components/ui/loading-spinner-diamond'
import { MeetingsTableClient } from './ClientTable'

export default function MeetingPast() {
  return (
    <div className="space-y-4 flex flex-col">
      {/* <h1 className="text-2xl font-bold text-center">כלל האסיפות</h1> */}
      <Suspense
        fallback={
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
          </div>
        }
      >
        <MeetingsTableClient />
      </Suspense>
    </div>
  )
}
