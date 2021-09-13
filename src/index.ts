import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';
import axios from 'axios';
import { Subject, defer } from 'rxjs';
import {
  scan,
  filter,
  retryWhen,
  takeUntil,
  repeat,
  switchMap,
  tap,
  delay,
  distinctUntilChanged,
} from 'rxjs/operators';

import getDbInstance from './promisified-db';
import { DbEntryType, DbLogFileRecord, DbLogStateRecord, FollowingState } from './types';
import { createStream, Options } from './rotating-file-stream';
import sliceFile from './slice-file';

class SecondStreetLogWriter {
  private token;
  private logStream;
  private readStream;
  private logReader;
  private rl;
  private telemetryApi;
  private logFileLinesToSend;
  private db;
  private newLogFile;
  private followingState: FollowingState = {
    lastLine: 0,
    totalLines: 0,
    filename: null,
  };
  private isPaused = false;
  private restartSubject = new Subject();
  private bufferSubject: Subject<string> = new Subject();
  private sendingObservable = this.bufferSubject
    .pipe(distinctUntilChanged())
    .pipe(tap(() => this.followingState.lastLine++))
    .pipe(scan((acc: string[], current: string) => ([...acc, current]), []))
    .pipe(filter((val: string[]) => val.length === this.logFileLinesToSend))
    .pipe(tap(() => {
      this.isPaused = true;
      this.readStream.pause();
    }))
    .pipe(takeUntil(this.restartSubject))
    .pipe(
      switchMap((value: string[]) => defer(() => axios.post(
        this.telemetryApi,
        value.join('\n'),
        { headers: { 'content-type': 'text/plain', Authorization: `Bearer ${this.token}` } },
      ))
        .pipe(retryWhen(errors => errors.pipe(
          delay(10000), // todo: move to config?
        )))),
    )
    .pipe(repeat());

  public setToken(token: string): void {
    this.token = token;
  }

  constructor(logFileSize: string, logFileLinesToSend: number, telemetryApi: string, logPath?: string) {
    this.logFileLinesToSend = logFileLinesToSend;
    this.telemetryApi = telemetryApi;
    this.db = getDbInstance(logPath);
    const fileNameGenerator = (data, index): string => `logFile-${index}.jsonl`;

    const logFileDefaultName = 'logFile-undefined.jsonl';
    this.newLogFile = logPath ? path.join(logPath, logFileDefaultName) : logFileDefaultName;

    const logStreamOptions: Options = {
      size: logFileSize,
      maxFiles: 3,
      immutable: true,
    };

    if (logPath) {
      logStreamOptions.path = logPath;
    }

    this.logStream = createStream(fileNameGenerator, logStreamOptions);

    this.sendingObservable.subscribe(async () => {
      this.restartSubject.next(null);
      await this.db.updateRecord({ type: DbEntryType.LogState }, this.followingState);
      this.isPaused = false;
      this.readStream.resume();
    });

    this.logStream.on('removed', filename => this.removed(filename));
    this.logStream.on('rotated', filename => this.rotated(filename));
    this.logStream.once('open', filename => this.startFollowingProcess(filename));
  }

  private async createLineListener(filename, lastLine): Promise<void> {
    if (this.logReader) {
      this.logReader.close();
    }

    this.logReader = sliceFile(filename);
    this.readStream = this.logReader.follow(lastLine);
    this.rl = readline.createInterface({
      input: this.readStream,
    });

    if (this.isPaused) {
      this.readStream.pause();
    }

    this.rl.on('line', async line => {
      this.bufferSubject.next(line.toString());

      if (this.followingState.lastLine === this.followingState.totalLines) {
        await this.db.updateRecord({
          type: DbEntryType.LogFile,
          filename: this.followingState.filename,
        }, { finished: true });

        const existingLogs = await this.db.find({ type: DbEntryType.LogFile, finished: false });

        const filteredLogs = existingLogs
          .map(logFile => ({ ...logFile, mtime: fs.statSync(logFile.filename).mtime }))
          .sort((file1, file2) => file1.mtime.getTime() - file2.mtime.getTime());

        this.followingState.lastLine = 0;

        if (filteredLogs.length) {
          const fileData: DbLogFileRecord = await this.db.findOne(
            { type: DbEntryType.LogFile, filename: filteredLogs[0].filename },
          );
          this.followingState.filename = fileData.filename;
          this.followingState.totalLines = fileData.lines;
        } else {
          this.followingState.filename = this.newLogFile;
          this.followingState.totalLines = null;
        }

        await this.createLineListener(this.followingState.filename, this.followingState.lastLine);
      }
    });
  }

  private async startFollowingProcess(filename): Promise<void> {
    let stateRecord: DbLogStateRecord = await this.db.findOne({ type: DbEntryType.LogState });

    if (!stateRecord) {
      stateRecord = await this.db.insert({
        type: DbEntryType.LogState,
        filename,
        totalLines: null,
        lastLine: 0,
      });
    }

    this.followingState = stateRecord;

    await this.createLineListener(this.followingState.filename, this.followingState.lastLine);
  }

  private async removed(filename): Promise<void> {
    await this.db.remove({ filename });
  }

  private async rotated(filename): Promise<void> {
    this.readStream.pause();
    const lines = await this.countLogLines(filename);

    const newLogEntry = { type: DbEntryType.LogFile, filename, lines, finished: false };
    await this.db.insert(newLogEntry);

    if (!this.followingState.totalLines) {
      const linesDiff = this.followingState.lastLine - lines;

      if (linesDiff < 0) {
        this.followingState.filename = filename;
        this.followingState.totalLines = lines;

        await this.createLineListener(this.followingState.filename, this.followingState.lastLine);
      } else {
        this.followingState.filename = this.newLogFile;
        this.followingState.lastLine = linesDiff;
        this.followingState.totalLines = null;

        await this.db.updateRecord({ type: DbEntryType.LogFile, filename }, { finished: true });

        await this.createLineListener(this.followingState.filename, linesDiff);
      }
    }
  }


  private countLogLines(logFileName: string): Promise<number> {
    return new Promise((res, rej) => {
      exec(`wc -l < ${logFileName}`, (error, stdout, stderr) => {
        if (error || stderr) {
          rej(error || stderr);
        }

        res(Number(stdout));
      });
    });
  }

  public writeLog(log: object): void {
    if (this.logStream) {
      this.logStream.write(`${JSON.stringify(log)}\n`);
    }
  }
}

export default SecondStreetLogWriter;
