
# How to Get User Voting on Meeting Agenda Items at Firm Level

Based on the database structure and code analysis, here's how to retrieve user voting on meeting agenda items at the firm level:

## Database Tables Involved

The system uses several key tables to store voting information:

1. **tblVotingResult** - Contains voting result codes and their meanings:
   ```
   -2  ---
   -1  הצבעות סותרות (Contradictory votes)
   0   ---
   1   בעד (For)
   2   נגד (Against)
   3   דיון (Discussion)
   4   הוסר מסדר היום (Removed from agenda)
   10  אין חובת השתתפות (No participation obligation)
   14  נמנע (Abstain)
   15  לא משתתף (Not participating)
   16  ללא הצבעה (Without voting)
   17  נמכרה אחזקה (Holding sold)
   ```

2. **tblVotingType** - Contains voting type codes:
   ```
   -2  --
   0   ללא חו"ד (Without opinion)
   1   בעד (For)
   2   נגד (Against)
   3   דיון (Discussion)
   4   הוסר מסדר היום (Removed from agenda)
   ```

3. **meetingagendaclient** - Stores client-specific voting information:
   ```
   maid - Meeting agenda ID
   fid - Firm ID
   comment - Comment
   ccomment - Client comment
   cdecision - Client decision (voting)
   committee - Committee flag
   conflict - Conflict flag
   relatedParty - Related party flag
   pInterest - Personal interest flag
   profFactor - Professional factor
   ```

## How to Retrieve Voting Data

### Option 1: Use the getUserMeetingVoting Stored Procedure

This is the most direct way to get voting data for a specific user and meeting:

```sql
SELECT * FROM meetingagendaclient
WHERE maid IN (SELECT id FROM meetingagenda WHERE mid = @meetingId)
AND fid = @firmId
```

Or use the stored procedure directly:

```csharp
using (dbEmdaEntities ctx = new dbEmdaEntities())
{
    var votingData = ctx.getUserMeetingVoting(userId, meetingId).ToList();
    // Filter by firm if needed
    var firmVotingData = votingData.Where(v => v.fid == firmId).ToList();
}
```

### Option 2: Use the getReportVoting Stored Procedure

For more comprehensive reporting that includes additional information:

```csharp
using (dbEmdaEntities ctx = new dbEmdaEntities())
{
    var reportVoting = ctx.getReportVoting(
        userId, 
        groupId: -1,  // -1 means no group filtering
        firmId: firmId, 
        accountId: null, 
        stockId: null, 
        meetingTypeId: null, 
        securityTypeId: null, 
        fromDate: startDate, 
        toDate: endDate, 
        filterVoting: null, 
        filterRovVoting: null, 
        filterResultVoting: null, 
        filterFinanceManager: null).ToList();
}
```

### Option 3: Direct SQL Query

If you need more control, you can write a custom SQL query:

```sql
SELECT 
    ma.id AS maid,
    ma.topic,
    ma.result,
    ma.vpercent,
    ma.vPercentSpecial,
    ma.vtype,
    mac.fid,
    mac.cdecision,
    mac.ccomment,
    mac.committee,
    mac.conflict,
    mac.relatedParty,
    mac.pInterest,
    vr.Name AS votingResultName
FROM 
    meetingagenda ma
JOIN 
    meetingagendaclient mac ON ma.id = mac.maid
JOIN 
    tblVotingResult vr ON mac.cdecision = vr.id
WHERE 
    ma.mid = @meetingId
    AND mac.fid = @firmId
ORDER BY 
    ma.id
```

## Data Interpretation

- The `cdecision` field in `meetingagendaclient` contains the voting decision code, which can be mapped to the corresponding name in `tblVotingResult`.
- The `committee`, `conflict`, `relatedParty`, and `pInterest` fields are flags (0/1) indicating special conditions.
- The `ccomment` field contains client-specific comments about the agenda item.

## Example Code

Here's a complete example of how to retrieve and display voting data:

```csharp
public ActionResult GetMeetingVoting(int meetingId, int firmId)
{
    using (dbEmdaEntities ctx = new dbEmdaEntities())
    {
        // Get meeting details
        var meeting = ctx.meetings.Find(meetingId);
        
        // Get voting results
        var votingResults = ctx.tblVotingResults.ToList();
        
        // Get firm voting data
        var firmVoting = ctx.meetingagendaclients
            .Where(mac => mac.maid == meetingId && mac.fid == firmId)
            .Join(ctx.meetingagendas, 
                  mac => mac.maid, 
                  ma => ma.id, 
                  (mac, ma) => new { 
                      AgendaId = ma.id,
                      Topic = ma.topic,
                      FirmId = mac.fid,
                      Decision = mac.cdecision,
                      Comment = mac.ccomment,
                      Committee = mac.committee,
                      Conflict = mac.conflict,
                      RelatedParty = mac.relatedParty,
                      PersonalInterest = mac.pInterest
                  })
            .ToList();
            
        return View(firmVoting);
    }
}
```

This approach will give you all the voting information for a specific firm on all agenda items in a meeting.