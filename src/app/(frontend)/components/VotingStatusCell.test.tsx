import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VotingStatusCell } from './VotingStatusCell'
import { MeetingTableDataType } from '../types/meetings'

// Mock the icon component
vi.mock('@/components/ui/icons', () => ({
  VoteStatusIcon: ({ value }: { value: string }) => <div data-testid="vote-icon">{value}</div>,
}))

describe('VotingStatusCell', () => {
  const mockRow = {
    companies: [{ id: 'company1' }, { id: 'company2' }],
    votes: {
      docs: [
        { company: 'company1', reported: true },
        { company: 'company2', reported: true },
      ],
    },
  } as unknown as MeetingTableDataType

  it('renders "all" icon when all companies are reported', () => {
    render(<VotingStatusCell row={mockRow} />)
    expect(screen.getByTestId('vote-icon')).toHaveTextContent('all')
  })

  it('renders "some" icon when only some companies are reported', () => {
    const partiallyReportedRow = {
      ...mockRow,
      votes: {
        docs: [
          { company: 'company1', reported: true },
          { company: 'company2', reported: false },
        ],
      },
    } as unknown as MeetingTableDataType

    render(<VotingStatusCell row={partiallyReportedRow} />)
    expect(screen.getByTestId('vote-icon')).toHaveTextContent('some')
  })

  it('renders "none" icon when no votes are reported', () => {
    const noneReportedRow = {
      ...mockRow,
      votes: {
        docs: [
          { company: 'company1', reported: false },
          { company: 'company2', reported: false },
        ],
      },
    } as unknown as MeetingTableDataType

    render(<VotingStatusCell row={noneReportedRow} />)
    expect(screen.getByTestId('vote-icon')).toHaveTextContent('none')
  })
})
