import { formatDateTime } from '../../helpers/utils-data-table'
import { MeetingTableDataType } from '../../types/meetings'
import TruncatedText from './TruncatedText'
import { SingleDocumentIcon, MultipleDocumentsIcon } from '@/components/ui/icons'

interface VoteDetailsProps {
  meetingData: MeetingTableDataType
}

export default function VoteDetails({ meetingData }: VoteDetailsProps) {
  const hasComments = meetingData.comments && meetingData.comments !== '-'
  const hasResearchDocuments = meetingData.researchDocuments

  let gridClass = 'grid grid-cols-1 gap-4 mb-4'

  if (hasComments) {
    gridClass += ' md:grid-cols-3'
  } else {
    gridClass += ' md:grid-cols-2'
  }

  return (
    <div className={gridClass}>
      {/*  meeting details */}
      <div className="rounded-lg border border-border">
        <div className="space-y-2 text-sm p-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">תאריך האסיפה</span>
            <TruncatedText
              text={formatDateTime(meetingData.meetingDate)}
              className="text-foreground max-w-[250px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מיקום האסיפה</span>
            <TruncatedText text={meetingData.location} className="text-foreground max-w-[250px]" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מועד קובע</span>
            <TruncatedText
              text={formatDateTime(meetingData.holdingsLimit)}
              className="text-foreground max-w-[250px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">מועד מסירת ההצבעות</span>
            <TruncatedText
              text={formatDateTime(meetingData.proxyVotingDate)}
              className="text-foreground max-w-[250px]"
            />
          </div>
        </div>
      </div>

      {/* stock details */}
      <div className="rounded-lg border border-border">
        <div className="space-y-2 text-sm p-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">שם חברה</span>
            <TruncatedText
              text={meetingData.companyName}
              className="text-foreground max-w-[250px]"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-medium">שווי שוק</span>
            <TruncatedText
              text={meetingData.marketValue.toLocaleString() + ' ₪'}
              className="text-foreground max-w-[250px]"
            />
          </div>
          {meetingData.stockOrigin === 'TASE' &&
            meetingData.stockTradable === true &&
            meetingData.stockNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">סוג נייר</span>
                <a
                  href={
                    'https://www.tase.co.il/he/market_data/security/' +
                    meetingData.stockNumber +
                    '/major_data'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:text-blue-800 hover:underline text-xs flex items-center transition-colors"
                >
                  <TruncatedText text={meetingData.stockType} className="max-w-[200px]" />
                </a>
              </div>
            )}
          {hasResearchDocuments && (
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">מחקר</span>
              <div className="flex gap-2">
                {meetingData.researchDocuments.length > 0 && (
                  <button
                    onClick={() => {
                      meetingData.researchDocuments.forEach((doc) => {
                        const link = document.createElement('a')
                        link.href = doc.url
                        link.download = doc.filename
                        link.style.display = 'none'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      })
                    }}
                    title={
                      meetingData.researchDocuments.length === 1
                        ? 'Download document'
                        : 'Download all documents'
                    }
                    className="group transition-transform hover:scale-110 hover:brightness-110 cursor-pointer"
                  >
                    {meetingData.researchDocuments.length === 1 ? (
                      <SingleDocumentIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
                    ) : (
                      <MultipleDocumentsIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* meeting comment  */}
      {hasComments && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-100 dark:bg-yellow-950 dark:border-yellow-900">
          <div className="flex items-center mb-2 px-3 pt-3">
            <h3 className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 whitespace-nowrap">
              הערות האסיפה
            </h3>
            <div className="flex-1 border-t border-yellow-200 dark:border-yellow-800 mr-2 mt-0.5"></div>
          </div>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 px-3 pb-3">
            {meetingData.comments}
          </p>
        </div>
      )}
    </div>
  )
}
