
# Why We Need Voting Percentage Fields Only in Agenda and Not in Votes

Based on a thorough analysis of the codebase, the `vpercent` (regular majority percentage) and `vPercentSpecial` (special majority percentage) fields are **only stored in the meetingagenda table**, not in the votes table (meetingagendaclient). This design is intentional and efficient for several reasons:

## Current Implementation

1. **Single Source of Truth**: The voting threshold percentages are properties of the agenda item itself, not of individual votes. They represent the required thresholds for approval, which are the same for all voters.

2. **Data Normalization**: Storing these fields only in the `meetingagenda` table follows proper database normalization principles by avoiding data duplication.

3. **Consistent Requirements**: All clients voting on a particular agenda item are subject to the same voting thresholds, so there's no need to duplicate this information for each vote.

## Why Agenda Table is Sufficient

1. **Threshold vs. Actual Vote**: The percentage fields represent the *thresholds* required for approval, not the actual votes. The actual voting decisions are stored in the `meetingagendaclient` table as `cdecision`.

2. **Efficient Updates**: When administrators need to change the voting thresholds, they only need to update one record in the `meetingagenda` table, rather than updating multiple records in the votes table.

3. **Presentation Logic**: When displaying voting information in reports or UI, the system joins data from both tables, making the threshold percentages available alongside individual votes without needing to duplicate the data.

## Evidence from the Code

The code clearly shows this separation of concerns:

1. **Model Definitions**:
   - `meetingagenda` contains `vpercent` and `vPercentSpecial`
   - `meetingagendaclient` contains voting-specific fields like `cdecision`, `committee`, `conflict`, etc., but not the percentage thresholds

2. **Update Methods**:
   - `updateMeetingAgenda` updates `vpercent` and `vPercentSpecial` in the agenda table
   - `updateFirmAgenda` and `UpdateMeetingAgendaClient` update vote-specific fields but not percentage thresholds

3. **UI Implementation**:
   - The admin interface shows percentage thresholds at the agenda level
   - Individual client votes are shown with their decisions but reference the same threshold values

## Conclusion

The current design is optimal because it maintains a single source of truth for voting thresholds while allowing individual votes to be recorded separately. There's no need to duplicate the threshold percentages in the votes table because they are properties of the agenda item itself, not of individual votes.