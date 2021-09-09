export enum DbEntryType {
  LogState = 'logState',
  LogFile = 'logFile',
  PricesData = 'pricesData'
}

export type DbLogStateRecord = {
  type: DbEntryType.LogState;
  filename: string
  totalLines: number,
  lastLine: number,
}

export type DbLogFileRecord = {
  type: DbEntryType.LogFile;
  filename: string;
  lines: number;
  finished: boolean;
}

export type FollowingState = {
  lastLine: number,
  totalLines: number | null,
  filename: string | null,
}

