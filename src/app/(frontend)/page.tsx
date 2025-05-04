import { Suspense } from 'react'
import LoadingSpinnerDiamond from '@/components/ui/loading-spinner-diamond'
import { MeetingsTableFuture } from './meetings/Table'

export default function MeetingsPage() {
  return (
    <div className="space-y-4 flex flex-col">
      {/* <h1 className="text-2xl font-bold text-center">אסיפות</h1> */}
      <Suspense
        fallback={
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
          </div>
        }
      >
        <MeetingsTableFuture />
      </Suspense>
    </div>
  )
}
