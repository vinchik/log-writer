"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var child_process_1 = require("child_process");
var readline_1 = __importDefault(require("readline"));
var axios_1 = __importDefault(require("axios"));
var slice_file_1 = __importDefault(require("slice-file"));
var rxjs_1 = require("rxjs");
var operators_1 = require("rxjs/operators");
var promisified_db_1 = __importDefault(require("./promisified-db"));
var types_1 = require("./types");
var rotating_file_stream_1 = require("./rotating-file-stream");
var SecondStreetLogWriter = /** @class */ (function () {
    function SecondStreetLogWriter(logFileSize, logFileLinesToSend, telemetryApi, logPath) {
        var _this = this;
        this.followingState = {
            lastLine: 0,
            totalLines: 0,
            filename: null,
        };
        this.isPaused = false;
        this.restartSubject = new rxjs_1.Subject();
        this.bufferSubject = new rxjs_1.Subject();
        this.sendingObservable = this.bufferSubject
            .pipe((0, operators_1.distinctUntilChanged)())
            .pipe((0, operators_1.tap)(function () { return _this.followingState.lastLine++; }))
            .pipe((0, operators_1.scan)(function (acc, current) { return (__spreadArray(__spreadArray([], acc, true), [current], false)); }, []))
            .pipe((0, operators_1.filter)(function (val) { return val.length === _this.logFileLinesToSend; }))
            .pipe((0, operators_1.tap)(function () {
            _this.isPaused = true;
            _this.readStream.pause();
        }))
            .pipe((0, operators_1.takeUntil)(this.restartSubject))
            .pipe((0, operators_1.switchMap)(function (value) { return (0, rxjs_1.defer)(function () { return axios_1.default.post(_this.telemetryApi, value.join('\n'), { headers: { 'content-type': 'text/plain', Authorization: "Bearer " + _this.token } }); })
            .pipe((0, operators_1.retryWhen)(function (errors) { return errors.pipe((0, operators_1.delay)(10000)); })); }))
            .pipe((0, operators_1.repeat)());
        this.logFileLinesToSend = logFileLinesToSend;
        this.telemetryApi = telemetryApi;
        this.db = (0, promisified_db_1.default)(logPath);
        var fileNameGenerator = function (data, index) { return "logFile-" + index + ".jsonl"; };
        var logFileDefaultName = 'logFile-undefined.jsonl';
        this.newLogFile = logPath ? path_1.default.join(logPath, logFileDefaultName) : logFileDefaultName;
        var logStreamOptions = {
            size: logFileSize,
            maxFiles: 3,
            immutable: true,
        };
        if (logPath) {
            logStreamOptions.path = logPath;
        }
        this.logStream = (0, rotating_file_stream_1.createStream)(fileNameGenerator, logStreamOptions);
        this.sendingObservable.subscribe(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.restartSubject.next(null);
                        return [4 /*yield*/, this.db.updateRecord({ type: types_1.DbEntryType.LogState }, this.followingState)];
                    case 1:
                        _a.sent();
                        this.isPaused = false;
                        this.readStream.resume();
                        return [2 /*return*/];
                }
            });
        }); });
        this.logStream.on('removed', function (filename) { return _this.removed(filename); });
        this.logStream.on('rotated', function (filename) { return _this.rotated(filename); });
        this.logStream.once('open', function (filename) { return _this.startFollowingProcess(filename); });
    }
    SecondStreetLogWriter.prototype.setToken = function (token) {
        this.token = token;
    };
    SecondStreetLogWriter.prototype.createLineListener = function (filename, lastLine) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.logReader) {
                    this.logReader.close();
                }
                this.logReader = (0, slice_file_1.default)(filename);
                this.readStream = this.logReader.follow(lastLine);
                this.rl = readline_1.default.createInterface({
                    input: this.readStream,
                });
                if (this.isPaused) {
                    this.readStream.pause();
                }
                this.rl.on('line', function (line) { return __awaiter(_this, void 0, void 0, function () {
                    var existingLogs, filteredLogs, fileData;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.bufferSubject.next(line.toString());
                                if (!(this.followingState.lastLine === this.followingState.totalLines)) return [3 /*break*/, 7];
                                return [4 /*yield*/, this.db.updateRecord({
                                        type: types_1.DbEntryType.LogFile,
                                        filename: this.followingState.filename,
                                    }, { finished: true })];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, this.db.find({ type: types_1.DbEntryType.LogFile, finished: false })];
                            case 2:
                                existingLogs = _a.sent();
                                filteredLogs = existingLogs
                                    .map(function (logFile) { return (__assign(__assign({}, logFile), { mtime: fs_1.default.statSync(logFile.filename).mtime })); })
                                    .sort(function (file1, file2) { return file1.mtime.getTime() - file2.mtime.getTime(); });
                                this.followingState.lastLine = 0;
                                if (!filteredLogs.length) return [3 /*break*/, 4];
                                return [4 /*yield*/, this.db.findOne({ type: types_1.DbEntryType.LogFile, filename: filteredLogs[0].filename })];
                            case 3:
                                fileData = _a.sent();
                                this.followingState.filename = fileData.filename;
                                this.followingState.totalLines = fileData.lines;
                                return [3 /*break*/, 5];
                            case 4:
                                this.followingState.filename = this.newLogFile;
                                this.followingState.totalLines = null;
                                _a.label = 5;
                            case 5: return [4 /*yield*/, this.createLineListener(this.followingState.filename, this.followingState.lastLine)];
                            case 6:
                                _a.sent();
                                _a.label = 7;
                            case 7: return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
            });
        });
    };
    SecondStreetLogWriter.prototype.startFollowingProcess = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var stateRecord;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.findOne({ type: types_1.DbEntryType.LogState })];
                    case 1:
                        stateRecord = _a.sent();
                        if (!!stateRecord) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.db.insert({
                                type: types_1.DbEntryType.LogState,
                                filename: filename,
                                totalLines: null,
                                lastLine: 0,
                            })];
                    case 2:
                        stateRecord = _a.sent();
                        _a.label = 3;
                    case 3:
                        this.followingState = stateRecord;
                        console.log(this.followingState);
                        return [4 /*yield*/, this.createLineListener(this.followingState.filename, this.followingState.lastLine)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SecondStreetLogWriter.prototype.removed = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.remove({ filename: filename })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SecondStreetLogWriter.prototype.rotated = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var lines, newLogEntry, linesDiff;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.readStream.pause();
                        return [4 /*yield*/, this.countLogLines(filename)];
                    case 1:
                        lines = _a.sent();
                        newLogEntry = { type: types_1.DbEntryType.LogFile, filename: filename, lines: lines, finished: false };
                        return [4 /*yield*/, this.db.insert(newLogEntry)];
                    case 2:
                        _a.sent();
                        if (!!this.followingState.totalLines) return [3 /*break*/, 7];
                        linesDiff = this.followingState.lastLine - lines;
                        if (!(linesDiff < 0)) return [3 /*break*/, 4];
                        this.followingState.filename = filename;
                        this.followingState.totalLines = lines;
                        return [4 /*yield*/, this.createLineListener(this.followingState.filename, this.followingState.lastLine)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        this.followingState.filename = this.newLogFile;
                        this.followingState.lastLine = linesDiff;
                        this.followingState.totalLines = null;
                        return [4 /*yield*/, this.db.updateRecord({ type: types_1.DbEntryType.LogFile, filename: filename }, { finished: true })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.createLineListener(this.followingState.filename, linesDiff)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    SecondStreetLogWriter.prototype.countLogLines = function (logFileName) {
        return new Promise(function (res, rej) {
            (0, child_process_1.exec)("wc -l < " + logFileName, function (error, stdout, stderr) {
                if (error || stderr) {
                    rej(error || stderr);
                }
                res(Number(stdout));
            });
        });
    };
    SecondStreetLogWriter.prototype.writeLog = function (log, token) {
        if (token) {
            this.token = token;
        }
        if (this.logStream) {
            this.logStream.write(JSON.stringify(log) + "\n");
        }
    };
    return SecondStreetLogWriter;
}());
exports.default = SecondStreetLogWriter;
//# sourceMappingURL=index.js.map