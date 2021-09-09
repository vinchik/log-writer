export enum LogLevel {
  ERROR = 'ERROR',
  INFO = 'INFO',
}

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

export type LogMessageFormatted = {
  logger: string;
  level: LogLevel;
  event: string;
  // eslint-disable-next-line
  created_at: string;
  // eslint-disable-next-line
  log_id: any;
  message?: string;
  args?: any;
  context?: {
    // eslint-disable-next-line
    company_id: string;
    // eslint-disable-next-line
    request_id: string;
    // eslint-disable-next-line
    brand_id: string;
  };
}

export type FollowingState = {
  lastLine: number,
  totalLines: number | null,
  filename: string | null,
}
