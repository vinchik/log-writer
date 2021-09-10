"use strict";
// @ts-nocheck
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStream = exports.RotatingFileStream = void 0;
var child_process_1 = require("child_process");
var zlib_1 = require("zlib");
var stream_1 = require("stream");
var fs_1 = require("fs");
var path_1 = require("path");
var util_1 = require("util");
var timers_1 = require("timers");
var RotatingFileStreamError = /** @class */ (function (_super) {
    __extends(RotatingFileStreamError, _super);
    function RotatingFileStreamError() {
        var _this = _super.call(this, 'Too many destination file attempts') || this;
        _this.code = 'RFS-TOO-MANY';
        return _this;
    }
    return RotatingFileStreamError;
}(Error));
var RotatingFileStream = /** @class */ (function (_super) {
    __extends(RotatingFileStream, _super);
    function RotatingFileStream(generator, options) {
        var _this = this;
        var encoding = options.encoding, history = options.history, maxFiles = options.maxFiles, maxSize = options.maxSize, path = options.path;
        // @ts-ignore
        _this = _super.call(this, { decodeStrings: true, defaultEncoding: encoding }) || this;
        _this.createGzip = zlib_1.createGzip;
        _this.exec = child_process_1.exec;
        _this.filename = path + generator(null);
        _this.fsClose = fs_1.close;
        _this.fsCreateReadStream = fs_1.createReadStream;
        _this.fsCreateWriteStream = fs_1.createWriteStream;
        _this.fsMkdir = fs_1.mkdir;
        _this.fsOpen = fs_1.open;
        _this.fsReadFile = fs_1.readFile;
        _this.fsRename = fs_1.rename;
        _this.fsStat = fs_1.stat;
        _this.fsUnlink = fs_1.unlink;
        _this.fsWrite = fs_1.write;
        _this.fsWriteFile = fs_1.writeFile;
        _this.generator = generator;
        _this.maxTimeout = 2147483640;
        _this.options = options;
        if (maxFiles || maxSize)
            options.history = path + (history || _this.generator(null) + ".txt");
        _this.on('close', function () { return (_this.finished ? null : _this.emit('finish')); });
        _this.on('finish', function () { return (_this.finished = _this.clear()); });
        process.nextTick(function () {
            return _this.init(function (error) {
                _this.error = error;
                if (_this.opened)
                    _this.opened();
                else if (_this.error)
                    _this.emit('error', error);
            });
        });
        return _this;
    }
    RotatingFileStream.prototype._destroy = function (error, callback) {
        var _this = this;
        var destroyer = function () {
            _this.clear();
            _this.reclose(function () { });
        };
        if (this.stream)
            destroyer();
        else
            this.destroyer = destroyer;
        callback(error);
    };
    RotatingFileStream.prototype._final = function (callback) {
        if (this.stream)
            return this.stream.end(callback);
        callback();
    };
    RotatingFileStream.prototype._write = function (chunk, encoding, callback) {
        this.rewrite({ chunk: chunk, encoding: encoding, next: null }, callback);
    };
    RotatingFileStream.prototype._writev = function (chunks, callback) {
        this.rewrite(chunks[0], callback);
    };
    RotatingFileStream.prototype.rewrite = function (chunk, callback) {
        var _this = this;
        var destroy = function (error) {
            _this.destroy();
            return callback(error);
        };
        var rewrite = function () {
            if (_this.destroyed)
                return callback(_this.error);
            if (_this.error)
                return destroy(_this.error);
            if (!_this.stream) {
                _this.opened = rewrite;
                return;
            }
            var done = function (error) {
                if (error)
                    return destroy(error);
                if (chunk.next)
                    return _this.rewrite(chunk.next, callback);
                callback();
            };
            _this.size += chunk.chunk.length;
            _this.stream.write(chunk.chunk, chunk.encoding, function (error) {
                if (error)
                    return done(error);
                if (_this.options.size && _this.size >= _this.options.size)
                    return _this.rotate(done);
                done();
            });
            if (_this.options.teeToStdout && !process.stdout.destroyed)
                process.stdout.write(chunk.chunk, chunk.encoding);
        };
        if (this.stream) {
            return this.fsStat(this.filename, function (error) {
                if (!error)
                    return rewrite();
                if (error.code !== 'ENOENT')
                    return destroy(error);
                _this.reclose(function () { return _this.reopen(false, 0, function () { return rewrite(); }); });
            });
        }
        this.opened = rewrite;
    };
    RotatingFileStream.prototype.init = function (callback) {
        var _this = this;
        var _a = this.options, immutable = _a.immutable, initialRotation = _a.initialRotation, interval = _a.interval, size = _a.size;
        if (immutable)
            return this.immutate(true, callback);
        this.fsStat(this.filename, function (error, stats) {
            if (error)
                return error.code === 'ENOENT' ? _this.reopen(false, 0, callback) : callback(error);
            if (!stats.isFile())
                return callback(new Error("Can't write on: " + _this.filename + " (it is not a file)"));
            if (initialRotation) {
                _this.intervalBounds(_this.now());
                var prev = _this.prev;
                _this.intervalBounds(new Date(stats.mtime.getTime()));
                if (prev !== _this.prev)
                    return _this.rotate(callback);
            }
            _this.size = stats.size;
            if (!size || stats.size < size)
                return _this.reopen(false, stats.size, callback);
            if (interval)
                _this.intervalBounds(_this.now());
            _this.rotate(callback);
        });
    };
    RotatingFileStream.prototype.makePath = function (name, callback) {
        var _this = this;
        var dir = (0, path_1.parse)(name).dir;
        this.fsMkdir(dir, function (error) {
            if (error) {
                if (error.code === 'ENOENT')
                    return _this.makePath(dir, function (error) { return (error ? callback(error) : _this.makePath(name, callback)); });
                if (error.code === 'EEXIST')
                    return callback();
                return callback(error);
            }
            callback();
        });
    };
    RotatingFileStream.prototype.reopen = function (retry, size, callback) {
        var _this = this;
        var options = { flags: 'a' };
        if ('mode' in this.options)
            options.mode = this.options.mode;
        var called;
        var stream = this.fsCreateWriteStream(this.filename, options);
        var end = function (error) {
            if (called) {
                _this.error = error;
                return;
            }
            called = true;
            _this.stream = stream;
            if (_this.opened) {
                process.nextTick(_this.opened);
                _this.opened = null;
            }
            if (_this.destroyer)
                process.nextTick(_this.destroyer);
            callback(error);
        };
        stream.once('open', function () {
            _this.size = size;
            end();
            _this.interval();
            _this.emit('open', _this.filename);
        });
        stream.once('error', function (error) {
            return (error.code !== 'ENOENT' || retry ? end(error) : _this.makePath(_this.filename, function (error) { return (error ? end(error) : _this.reopen(true, size, callback)); }));
        });
    };
    RotatingFileStream.prototype.reclose = function (callback) {
        var stream = this.stream;
        if (!stream)
            return callback();
        this.stream = null;
        stream.once('finish', callback);
        stream.end();
    };
    RotatingFileStream.prototype.now = function () {
        return new Date();
    };
    RotatingFileStream.prototype.rotate = function (callback) {
        var _this = this;
        var _a = this.options, immutable = _a.immutable, rotate = _a.rotate;
        this.size = 0;
        this.rotation = this.now();
        this.clear();
        this.reclose(function () { return (rotate ? _this.classical(rotate, callback) : immutable ? _this.immutate(false, callback) : _this.move(callback)); });
        this.emit('rotation');
    };
    RotatingFileStream.prototype.findName = function (tmp, callback, index) {
        var _this = this;
        if (!index)
            index = 1;
        var _a = this.options, interval = _a.interval, path = _a.path, intervalBoundary = _a.intervalBoundary;
        var filename = this.filename + "." + index + ".rfs.tmp";
        if (index >= 1000)
            return callback(new RotatingFileStreamError());
        if (!tmp) {
            try {
                filename = path + this.generator(interval && intervalBoundary ? new Date(this.prev) : this.rotation, index);
            }
            catch (e) {
                return callback(e);
            }
        }
        this.fsStat(filename, function (error) {
            if (!error || error.code !== 'ENOENT')
                return _this.findName(tmp, callback, index + 1);
            callback(null, filename);
        });
    };
    RotatingFileStream.prototype.move = function (callback) {
        var _this = this;
        var compress = this.options.compress;
        var filename;
        var open = function (error) {
            if (error)
                return callback(error);
            _this.rotated(filename, callback);
        };
        this.findName(false, function (error, found) {
            if (error)
                return callback(error);
            filename = found;
            _this.touch(filename, false, function (error) {
                if (error)
                    return callback(error);
                if (compress)
                    return _this.compress(filename, open);
                _this.fsRename(_this.filename, filename, open);
            });
        });
    };
    RotatingFileStream.prototype.touch = function (filename, retry, callback) {
        var _this = this;
        this.fsOpen(filename, 'a', 438, function (error, fd) {
            if (error) {
                if (error.code !== 'ENOENT' || retry)
                    return callback(error);
                return _this.makePath(filename, function (error) {
                    if (error)
                        return callback(error);
                    _this.touch(filename, true, callback);
                });
            }
            return _this.fsClose(fd, function (error) {
                if (error)
                    return callback(error);
                _this.fsUnlink(filename, function (error) {
                    if (error)
                        _this.emit('warning', error);
                    callback();
                });
            });
        });
    };
    RotatingFileStream.prototype.classical = function (count, callback) {
        var _this = this;
        var _a = this.options, compress = _a.compress, path = _a.path, rotate = _a.rotate;
        var prevName;
        var thisName;
        if (rotate === count)
            delete this.rotatedName;
        var open = function (error) {
            if (error)
                return callback(error);
            _this.rotated(_this.rotatedName, callback);
        };
        try {
            prevName = count === 1 ? this.filename : path + this.generator(count - 1);
            thisName = path + this.generator(count);
        }
        catch (e) {
            return callback(e);
        }
        var next = count === 1 ? open : function () { return _this.classical(count - 1, callback); };
        var move = function () {
            if (count === 1 && compress)
                return _this.compress(thisName, open);
            _this.fsRename(prevName, thisName, function (error) {
                if (!error)
                    return next();
                if (error.code !== 'ENOENT')
                    return callback(error);
                _this.makePath(thisName, function (error) {
                    if (error)
                        return callback(error);
                    _this.fsRename(prevName, thisName, function (error) { return (error ? callback(error) : next()); });
                });
            });
        };
        this.fsStat(prevName, function (error) {
            if (error) {
                if (error.code !== 'ENOENT')
                    return callback(error);
                return next();
            }
            if (!_this.rotatedName)
                _this.rotatedName = thisName;
            move();
        });
    };
    RotatingFileStream.prototype.clear = function () {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        return true;
    };
    RotatingFileStream.prototype.intervalBoundsBig = function (now) {
        var year = now.getFullYear();
        var month = now.getMonth();
        var day = now.getDate();
        var hours = now.getHours();
        var _a = this.options.interval, num = _a.num, unit = _a.unit;
        if (unit === 'M') {
            day = 1;
            hours = 0;
        }
        else if (unit === 'd')
            hours = 0;
        else
            hours = parseInt((hours / num), 10) * num;
        this.prev = new Date(year, month, day, hours, 0, 0, 0).getTime();
        if (unit === 'M')
            month += num;
        else if (unit === 'd')
            day += num;
        else
            hours += num;
        this.next = new Date(year, month, day, hours, 0, 0, 0).getTime();
    };
    RotatingFileStream.prototype.intervalBounds = function (now) {
        var unit = this.options.interval.unit;
        if (unit === 'M' || unit === 'd' || unit === 'h')
            this.intervalBoundsBig(now);
        else {
            var period = 1000 * this.options.interval.num;
            if (unit === 'm')
                period *= 60;
            this.prev = parseInt((now.getTime() / period), 10) * period;
            this.next = this.prev + period;
        }
        return new Date(this.prev);
    };
    RotatingFileStream.prototype.interval = function () {
        var _this = this;
        if (!this.options.interval)
            return;
        this.intervalBounds(this.now());
        var set = function () {
            var time = _this.next - _this.now().getTime();
            if (time <= 0)
                return _this.rotate(function (error) { return (_this.error = error); });
            _this.timer = (0, timers_1.setTimeout)(set, time > _this.maxTimeout ? _this.maxTimeout : time);
            _this.timer.unref();
        };
        set();
    };
    RotatingFileStream.prototype.compress = function (filename, callback) {
        var _this = this;
        var compress = this.options.compress;
        var done = function (error) {
            if (error)
                return callback(error);
            _this.fsUnlink(_this.filename, callback);
        };
        if (typeof compress === 'function')
            this.external(filename, done);
        else
            this.gzip(filename, done);
    };
    RotatingFileStream.prototype.external = function (filename, callback) {
        var _this = this;
        var compress = this.options.compress;
        var cont;
        try {
            cont = compress(this.filename, filename);
        }
        catch (e) {
            return callback(e);
        }
        this.findName(true, function (error, found) {
            if (error)
                return callback(error);
            _this.fsOpen(found, 'w', 511, function (error, fd) {
                if (error)
                    return callback(error);
                var unlink = function (error) {
                    _this.fsUnlink(found, function (error2) {
                        if (error2)
                            _this.emit('warning', error2);
                        callback(error);
                    });
                };
                _this.fsWrite(fd, cont, 'utf8', function (error) {
                    _this.fsClose(fd, function (error2) {
                        if (error) {
                            if (error2)
                                _this.emit('warning', error2);
                            return unlink(error);
                        }
                        if (error2)
                            return unlink(error2);
                        if (found.indexOf(path_1.sep) === -1)
                            found = "." + path_1.sep + found;
                        _this.exec("sh \"" + found + "\"", unlink);
                    });
                });
            });
        });
    };
    RotatingFileStream.prototype.gzip = function (filename, callback) {
        var mode = this.options.mode;
        var options = mode ? { mode: mode } : {};
        var inp = this.fsCreateReadStream(this.filename, {});
        var out = this.fsCreateWriteStream(filename, options);
        var zip = this.createGzip();
        [inp, out, zip].map(function (stream) { return stream.once('error', callback); });
        out.once('finish', callback);
        inp.pipe(zip).pipe(out);
    };
    RotatingFileStream.prototype.rotated = function (filename, callback) {
        var _this = this;
        var _a = this.options, maxFiles = _a.maxFiles, maxSize = _a.maxSize;
        var open = function (error) {
            if (error)
                return callback(error);
            _this.reopen(false, 0, callback);
            _this.emit('rotated', filename);
        };
        if (maxFiles || maxSize)
            return this.history(filename, open);
        open();
    };
    RotatingFileStream.prototype.history = function (filename, callback) {
        var _this = this;
        var history = this.options.history;
        this.fsReadFile(history, 'utf8', function (error, data) {
            if (error) {
                if (error.code !== 'ENOENT')
                    return callback(error);
                return _this.historyGather([filename], 0, [], callback);
            }
            var files = data.split('\n');
            files.push(filename);
            _this.historyGather(files, 0, [], callback);
        });
    };
    RotatingFileStream.prototype.historyGather = function (files, index, res, callback) {
        var _this = this;
        if (index === files.length)
            return this.historyCheckFiles(res, callback);
        this.fsStat(files[index], function (error, stats) {
            if (error) {
                if (error.code !== 'ENOENT')
                    return callback(error);
            }
            else if (stats.isFile()) {
                res.push({
                    name: files[index],
                    size: stats.size,
                    time: stats.ctime.getTime(),
                });
            }
            else
                _this.emit('warning', new Error("File '" + files[index] + "' contained in history is not a regular file"));
            _this.historyGather(files, index + 1, res, callback);
        });
    };
    RotatingFileStream.prototype.historyRemove = function (files, size, callback) {
        var _this = this;
        var file = files.shift();
        this.fsUnlink(file.name, function (error) {
            if (error)
                return callback(error);
            _this.emit('removed', file.name, !size);
            callback();
        });
    };
    RotatingFileStream.prototype.historyCheckFiles = function (files, callback) {
        var _this = this;
        var maxFiles = this.options.maxFiles;
        files.sort(function (a, b) { return a.time - b.time; });
        if (!maxFiles || files.length <= maxFiles)
            return this.historyCheckSize(files, callback);
        this.historyRemove(files, false, function (error) { return (error ? callback(error) : _this.historyCheckFiles(files, callback)); });
    };
    RotatingFileStream.prototype.historyCheckSize = function (files, callback) {
        var _this = this;
        var maxSize = this.options.maxSize;
        var size = 0;
        if (!maxSize)
            return this.historyWrite(files, callback);
        files.map(function (e) { return (size += e.size); });
        if (size <= maxSize)
            return this.historyWrite(files, callback);
        this.historyRemove(files, true, function (error) { return (error ? callback(error) : _this.historyCheckSize(files, callback)); });
    };
    RotatingFileStream.prototype.historyWrite = function (files, callback) {
        var _this = this;
        this.fsWriteFile(this.options.history, files.map(function (e) { return e.name; }).join('\n') + "\n", 'utf8', function (error) {
            if (error)
                return callback(error);
            _this.emit('history');
            callback();
        });
    };
    RotatingFileStream.prototype.immutate = function (first, callback, index, now) {
        var _this = this;
        if (!index) {
            index = 1;
            now = this.now();
        }
        if (index >= 1001)
            return callback(new RotatingFileStreamError());
        try {
            this.filename = this.options.path + this.generator(now, index);
        }
        catch (e) {
            return callback(e);
        }
        var open = function (size, callback) {
            if (first) {
                _this.last = _this.filename;
                return _this.reopen(false, size, callback);
            }
            _this.rotated(_this.last, function (error) {
                _this.last = _this.filename;
                callback(error);
            });
        };
        this.fsStat(this.filename, function (error, stats) {
            var size = _this.options.size;
            if (error) {
                if (error.code === 'ENOENT')
                    return open(0, callback);
                return callback(error);
            }
            if (!stats.isFile())
                return callback(new Error("Can't write on: '" + _this.filename + "' (it is not a file)"));
            if (size && stats.size >= size)
                return _this.immutate(first, callback, index + 1, now);
            open(stats.size, callback);
        });
    };
    return RotatingFileStream;
}(stream_1.Writable));
exports.RotatingFileStream = RotatingFileStream;
function buildNumberCheck(field) {
    return function (type, options, value) {
        var converted = parseInt(value, 10);
        if (type !== 'number' || converted !== value || converted <= 0)
            throw new Error("'" + field + "' option must be a positive integer number");
    };
}
function buildStringCheck(field, check) {
    return function (type, options, value) {
        if (type !== 'string')
            throw new Error("Don't know how to handle 'options." + field + "' type: " + type);
        options[field] = check(value);
    };
}
function checkMeasure(value, what, units) {
    var ret = {};
    ret.num = parseInt(value, 10);
    if (isNaN(ret.num))
        throw new Error("Unknown 'options." + what + "' format: " + value);
    if (ret.num <= 0)
        throw new Error("A positive integer number is expected for 'options." + what + "'");
    ret.unit = value.replace(/^[ 0]*/g, '').substr(("" + ret.num).length, 1);
    if (ret.unit.length === 0)
        throw new Error("Missing unit for 'options." + what + "'");
    if (!units[ret.unit])
        throw new Error("Unknown 'options." + what + "' unit: " + ret.unit);
    return ret;
}
var intervalUnits = {
    M: true,
    d: true,
    h: true,
    m: true,
    s: true,
};
function checkIntervalUnit(ret, unit, amount) {
    if (parseInt((amount / ret.num), 10) * ret.num !== amount)
        throw new Error("An integer divider of " + amount + " is expected as " + unit + " for 'options.interval'");
}
function checkInterval(value) {
    var ret = checkMeasure(value, 'interval', intervalUnits);
    switch (ret.unit) {
        case 'h':
            checkIntervalUnit(ret, 'hours', 24);
            break;
        case 'm':
            checkIntervalUnit(ret, 'minutes', 60);
            break;
        case 's':
            checkIntervalUnit(ret, 'seconds', 60);
            break;
    }
    return ret;
}
var sizeUnits = {
    B: true,
    G: true,
    K: true,
    M: true,
};
function checkSize(value) {
    var ret = checkMeasure(value, 'size', sizeUnits);
    if (ret.unit === 'K')
        return ret.num * 1024;
    if (ret.unit === 'M')
        return ret.num * 1048576;
    if (ret.unit === 'G')
        return ret.num * 1073741824;
    return ret.num;
}
var checks = {
    compress: function (type, options, value) {
        if (!value)
            throw new Error('A value for \'options.compress\' must be specified');
        if (type === 'boolean')
            return (options.compress = function (source, dest) { return "cat " + source + " | gzip -c9 > " + dest; });
        if (type === 'function')
            return;
        if (type !== 'string')
            throw new Error("Don't know how to handle 'options.compress' type: " + type);
        if (value !== 'gzip')
            throw new Error("Don't know how to handle compression method: " + value);
    },
    encoding: function (type, options, value) { return new util_1.TextDecoder(value); },
    history: function (type) {
        if (type !== 'string')
            throw new Error("Don't know how to handle 'options.history' type: " + type);
    },
    immutable: function () { },
    initialRotation: function () { },
    interval: buildStringCheck('interval', checkInterval),
    intervalBoundary: function () { },
    maxFiles: buildNumberCheck('maxFiles'),
    maxSize: buildStringCheck('maxSize', checkSize),
    mode: function () { },
    path: function (type, options, value) {
        if (type !== 'string')
            throw new Error("Don't know how to handle 'options.path' type: " + type);
        if (value[value.length - 1] !== path_1.sep)
            options.path = value + path_1.sep;
    },
    rotate: buildNumberCheck('rotate'),
    size: buildStringCheck('size', checkSize),
    teeToStdout: function () { },
};
function checkOpts(options) {
    var ret = {};
    for (var opt in options) {
        var value = options[opt];
        var type = typeof value;
        if (!(opt in checks))
            throw new Error("Unknown option: " + opt);
        ret[opt] = options[opt];
        checks[opt](type, ret, value);
    }
    if (!ret.path)
        ret.path = '';
    if (!ret.interval) {
        delete ret.immutable;
        delete ret.initialRotation;
        delete ret.intervalBoundary;
    }
    if (ret.rotate) {
        delete ret.history;
        delete ret.immutable;
        delete ret.maxFiles;
        delete ret.maxSize;
        delete ret.intervalBoundary;
    }
    if (ret.immutable)
        delete ret.compress;
    if (!ret.intervalBoundary)
        delete ret.initialRotation;
    return ret;
}
function createClassical(filename) {
    return function (index) { return (index ? filename + "." + index : filename); };
}
function createGenerator(filename) {
    var pad = function (num) { return (num > 9 ? '' : '0') + num; };
    return function (time, index) {
        if (!time)
            return filename;
        var month = "" + time.getFullYear() + pad(time.getMonth() + 1);
        var day = pad(time.getDate());
        var hour = pad(time.getHours());
        var minute = pad(time.getMinutes());
        return month + day + "-" + hour + minute + "-" + pad(index) + "-" + filename;
    };
}
function createStream(filename, options) {
    if (typeof options === 'undefined')
        options = {};
    else if (typeof options !== 'object')
        throw new Error("The \"options\" argument must be of type object. Received type " + typeof options);
    var opts = checkOpts(options);
    var generator;
    if (typeof filename === 'string')
        generator = options.rotate ? createClassical(filename) : createGenerator(filename);
    else if (typeof filename === 'function')
        generator = filename;
    else
        throw new Error("The \"filename\" argument must be one of type string or function. Received type " + typeof filename);
    return new RotatingFileStream(generator, opts);
}
exports.createStream = createStream;
//# sourceMappingURL=index.js.map