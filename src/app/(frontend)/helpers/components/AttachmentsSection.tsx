'use client'

import { Textarea } from '@/components/ui/textarea'
import { Upload } from 'lucide-react'
import { Document } from '@/payload-types'

interface AttachmentsSectionProps {
  localVoterNotes: string
  onNotesChange: (notes: string) => void
  onNotesBlur: () => void
  uploadedDocs: Document[]
  isUploading: boolean
  isReadOnly: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (docId: string) => void
}

export default function AttachmentsSection({
  localVoterNotes,
  onNotesChange,
  onNotesBlur,
  uploadedDocs,
  isUploading,
  isReadOnly,
  onFileChange,
  onRemoveFile,
}: AttachmentsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[3fr,1fr] gap-6">
      <div>
        <div className="flex items-center mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">הערות המצביע</h3>
        </div>
        <Textarea
          placeholder="אפשרות הוספת הערות..."
          className=" w-full border-muted bg-background resize-none focus-visible:ring-1"
          style={{ height: 'calc(100% - 20px)' }}
          value={localVoterNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          onBlur={onNotesBlur}
          readOnly={isReadOnly}
        />
      </div>
      <div>
        <div className="flex items-center mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">העלאת קבצים</h3>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={onFileChange}
              className="sr-only"
              disabled={isUploading || isReadOnly}
            />
            <label
              htmlFor="file-upload"
              className={`flex items-center gap-2 bg-background border border-input rounded-md p-2 transition-colors ${isUploading || isReadOnly ? 'cursor-default bg-muted/50' : 'cursor-pointer hover:bg-muted/50'}`}
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isUploading ? 'מעלה קבצים...' : 'בחר קובץ/קבצים'}
              </span>
            </label>
          </div>

          {uploadedDocs.length > 0 && (
            <div className="space-y-1 mt-2">
              {uploadedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5 text-xs"
                >
                  <a
                    href={doc.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate max-w-[150px] hover:underline"
                  >
                    {doc.filename}
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(doc.id)}
                    className="text-muted-foreground hover:text-destructive ml-2"
                  >
                    הסר
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
