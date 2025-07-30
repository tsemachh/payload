// Mapping between frontend field names and database field names for sorting
export const sortFieldMapping: Record<string, string> = {
  // Default is to use the same field name
  meetingId: 'meetingId',
  stockNumber: 'stock.stockId',
  stockType: 'stock.type',
  stockOrigin: 'stock.origin',
  stockSymbol: 'stock.symbol',
  stockName: 'stock.name',
  companyName: 'stock.longName',
  stockTradable: 'stock.tradable',
  meetingType: 'type',
  meetingDate: 'meetingDate',
  reference: 'magnaId',
  location: 'location',
  holdingsLimit: 'holdingsLimit',
  proxyVotingDate: 'proxyVotingDate',
  meetingState: 'state',
  comments: 'comments',
  electronicVotingEnabled: 'electronicVotingEnabled',
  resultsConfirmationStatus: 'resultsConfirmationStatus',
  committeeInitiated: 'stock.isFinancial',
}

// Get the database field name for a frontend field
export function getDbFieldName(frontendField: string): string {
  return sortFieldMapping[frontendField] || frontendField
}
