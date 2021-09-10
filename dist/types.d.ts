export declare enum DbEntryType {
    LogState = "logState",
    LogFile = "logFile",
    PricesData = "pricesData"
}
export declare type DbLogStateRecord = {
    type: DbEntryType.LogState;
    filename: string;
    totalLines: number;
    lastLine: number;
};
export declare type DbLogFileRecord = {
    type: DbEntryType.LogFile;
    filename: string;
    lines: number;
    finished: boolean;
};
export declare type FollowingState = {
    lastLine: number;
    totalLines: number | null;
    filename: string | null;
};
