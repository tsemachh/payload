export default interface ImportStock {
  stockID: number;
  name: string;
  symbol: string;
  type: string;
  closingRate: number;
  marketValue: number;
  registeredValue: number;
  valueDate: string; // ISO date string (e.g., "2021-11-10T00:00:00")
  logUpdateID: number;
  longName: string;
}