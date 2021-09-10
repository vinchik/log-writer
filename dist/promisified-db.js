"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = __importDefault(require("path"));
var nedb_1 = __importDefault(require("nedb"));
var getDbInstance = function (logPath) {
    var dbFile = 'log-writer-db-file';
    var filename = logPath ? path_1.default.join(logPath, dbFile) : dbFile;
    var db = new nedb_1.default({ filename: filename, autoload: true });
    var insert = function (doc) { return new Promise(function (res, rej) {
        db.insert(doc, function (err, newDoc) {
            if (err) {
                rej(err);
            }
            res(newDoc);
        });
    }); };
    var find = function (query) { return new Promise(function (res, rej) {
        db.find(query, function (err, docs) {
            if (err) {
                rej(err);
            }
            res(docs);
        });
    }); };
    var findOne = function (query) { return new Promise(function (res, rej) {
        db.findOne(query, function (err, docs) {
            if (err) {
                rej(err);
            }
            res(docs);
        });
    }); };
    var updateRecord = function (query, update, options) {
        if (options === void 0) { options = {}; }
        return new Promise(function (res, rej) {
            db.update(query, update, options, function (err, numAffected) {
                if (err) {
                    rej(err);
                }
                res(numAffected);
            });
        });
    };
    var remove = function (query, options) {
        if (options === void 0) { options = {}; }
        return new Promise(function (res, rej) {
            db.remove(query, options, function (err, numRemoved) {
                if (err) {
                    rej(err);
                }
                res(numRemoved);
            });
        });
    };
    return {
        insert: insert,
        find: find,
        findOne: findOne,
        updateRecord: updateRecord,
        remove: remove,
    };
};
exports.default = getDbInstance;
//# sourceMappingURL=promisified-db.js.map