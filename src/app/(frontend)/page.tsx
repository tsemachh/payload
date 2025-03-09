import { Suspense } from 'react'
import { DataTable } from '@/components/data-table'
import { fetchMeetingsForTable } from './api/payload'
import LoadingSpinnerDiamond from '@/components/ui/loading-spinner-diamond'
import { meetingColumns, renderMeetingActions } from './columns'

async function MeetingsTable() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  const pastDateFilterOptions = [
    { value: 'yesterday', label: 'אתמול' },
    { value: 'lastWeek', label: 'שבוע החל מאתמול' },
    { value: 'lastMonth', label: 'חודש החל מאתמול' },
    { value: 'allPast', label: 'כל התאריכים שעברו' },
  ]

  const futureDateFilterOptions = [
    { value: 'today', label: 'היום' },
    { value: 'nextWeek', label: 'עוד שבוע מהיום' },
    { value: 'nextMonth', label: 'עוד חודש מהיום' },
    { value: 'allFuture', label: 'כל התאריכים העתידיים' },
  ]
  return (
    <DataTable
      data={futureMeetingTableData}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField="meetingDate"
      defaultSortDirection="desc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
    />
  )
}

export default function AssembliesPage() {
  return (
    <div className="space-y-4 flex flex-col">
      <h1 className="text-2xl font-bold text-center">אסיפות</h1>
      <Suspense
        fallback={
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
            <p className="text-center">טוען נתונים...</p>
          </div>
        }
      >
        <MeetingsTable />
      </Suspense>
    </div>
  )
}
