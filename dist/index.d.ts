declare class SecondStreetLogWriter {
    private token;
    private logStream;
    private readStream;
    private logReader;
    private rl;
    private telemetryApi;
    private logFileLinesToSend;
    private db;
    private newLogFile;
    private followingState;
    private isPaused;
    private restartSubject;
    private bufferSubject;
    private sendingObservable;
    setToken(token: string): void;
    constructor(logFileSize: string, logFileLinesToSend: number, telemetryApi: string, logPath?: string);
    private createLineListener;
    private startFollowingProcess;
    private removed;
    private rotated;
    private countLogLines;
    writeLog(log: object): void;
}
export default SecondStreetLogWriter;
