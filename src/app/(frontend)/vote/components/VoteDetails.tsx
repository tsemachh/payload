import { ExternalLink } from 'lucide-react'
import { formatDateTime } from '../../helpers/utils-data-table'
import { MeetingTableDataType } from '../../types/meetings'
import TruncatedText from './TruncatedText'

interface VoteDetailsProps {
  meetingData: MeetingTableDataType
}

export default function VoteDetails({ meetingData }: VoteDetailsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      {/* פרטי האסיפה */}
      <div className="rounded-lg border border-border">
        <div className="space-y-2 text-sm p-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">תאריך האסיפה</span>
            <TruncatedText
              text={formatDateTime(meetingData.meetingDate)}
              className="text-foreground max-w-[150px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מיקום האסיפה</span>
            <TruncatedText text={meetingData.location} className="text-foreground max-w-[150px]" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מועד קובע</span>
            <TruncatedText
              text={formatDateTime(meetingData.holdingsLimit)}
              className="text-foreground max-w-[150px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מועד מסירת ההצבעות</span>
            <TruncatedText
              text={formatDateTime(meetingData.proxyVotingDate)}
              className="text-foreground max-w-[150px]"
            />
          </div>
        </div>
      </div>

      {/* פרטי נייר ערך */}
      <div className="rounded-lg border border-border">
        <div className="space-y-2 text-sm p-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">שם חברה</span>
            <TruncatedText
              text={meetingData.companyName}
              className="text-foreground max-w-[150px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">סוג נייר</span>
            <TruncatedText text={meetingData.stockType} className="text-foreground max-w-[150px]" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">שווי שוק</span>
            <TruncatedText
              text={meetingData.marketValue.toLocaleString() + ' ₪'}
              className="text-foreground max-w-[150px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">קישור לנייר בבורסה</span>
            <a
              href={
                'https://www.tase.co.il/he/market_data/security/' +
                meetingData.stockNumber +
                '/major_data'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 hover:underline text-xs flex items-center transition-colors"
            >
              <TruncatedText text="צפייה בנייר" className="max-w-[100px]" />
              <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* הערות האסיפה - רק אם יש הערות */}
      {meetingData.comments && meetingData.comments !== '-' ? (
        <div className="bg-yellow-50 rounded-lg border border-yellow-100 dark:bg-yellow-950 dark:border-yellow-900">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 p-3">{meetingData.comments}</p>
        </div>
      ) : null}
    </div>
  )
}
