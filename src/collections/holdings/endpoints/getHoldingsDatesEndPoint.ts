import { PayloadRequest, addDataAndFileToRequest } from 'payload'

const getHoldingsDatesEndPoint = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  const payload = req.payload
  const { user } = req

  const onlyMonth = req?.query?.month === 'true'

  let lastWeekStart: Date | undefined
  let now: Date | undefined

  if (onlyMonth) {
    now = new Date()
    const year = now.getFullYear()
    const currentMonth = now.getMonth()
    const firstDayOfCurrentMonth = new Date(year, currentMonth, 1)
    const lastDayOfPrevMonth = new Date(firstDayOfCurrentMonth.getTime() - 1)
    lastWeekStart = new Date(lastDayOfPrevMonth)
    lastWeekStart.setDate(lastDayOfPrevMonth.getDate() - 6)
  }
  const holdingsDate = await payload.find({
    collection: 'holdings',
    select: { valueDate: true },
    depth: 0,
    limit: 0,
    where: {
      and: [
        {
          fund: { in: user?.funds || [] },
        },
        onlyMonth
          ? {
              valueDate: {
                greater_than_equal: lastWeekStart?.toISOString() || '',
                less_than_equal: now?.toISOString(),
              },
            }
          : {},
      ],
    },
  })

  const allDates = holdingsDate.docs.map((doc) => doc.valueDate)
  const data = [...new Set(allDates)]
  return Response.json({
    data,
  })
}

export default getHoldingsDatesEndPoint
