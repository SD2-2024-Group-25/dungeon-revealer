"use strict";
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = void 0;
var sqlite3 = require("sqlite3");
var sqlite = require("sqlite");
var path = require("path");
var migration0 = require("./migrations/0");
var migration1 = require("./migrations/1");
var migration2 = require("./migrations/2");
var migration3 = require("./migrations/3");
var migration4 = require("./migrations/4");
/**
 * @param {{ dataPath: string }}
 */
var loadDatabase = function (_a) {
    var databasePath = _a.databasePath;
    return sqlite.open({
        filename: databasePath,
        driver: sqlite3.Database,
    });
};
var runMigrations = function (db_1, _a) { return __awaiter(void 0, [db_1, _a], void 0, function (db, _b) {
    var result, userVersion, _c;
    var dataPath = _b.dataPath;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, db.get("PRAGMA \"user_version\";")];
            case 1:
                result = _d.sent();
                userVersion = null;
                if (result) {
                    userVersion = result.user_version || 0;
                }
                _c = userVersion;
                switch (_c) {
                    case 0: return [3 /*break*/, 2];
                    case 1: return [3 /*break*/, 4];
                    case 2: return [3 /*break*/, 6];
                    case 3: return [3 /*break*/, 8];
                    case 4: return [3 /*break*/, 10];
                }
                return [3 /*break*/, 12];
            case 2: return [4 /*yield*/, migration0.migrate({ db: db })];
            case 3:
                _d.sent();
                _d.label = 4;
            case 4: return [4 /*yield*/, migration1.migrate({ db: db, dataPath: dataPath })];
            case 5:
                _d.sent();
                _d.label = 6;
            case 6: return [4 /*yield*/, migration2.migrate({ db: db })];
            case 7:
                _d.sent();
                _d.label = 8;
            case 8: return [4 /*yield*/, migration3.migrate({ db: db })];
            case 9:
                _d.sent();
                _d.label = 10;
            case 10: return [4 /*yield*/, migration4.migrate({ db: db, dataPath: dataPath })];
            case 11:
                _d.sent();
                _d.label = 12;
            case 12: return [2 /*return*/, db];
        }
    });
}); };
var initialize = function (_a) {
    var dataPath = _a.dataPath, _b = _a.databasePath, databasePath = _b === void 0 ? path.join(dataPath, "db.sqlite") : _b;
    return Promise.resolve()
        .then(function () { return loadDatabase({ databasePath: databasePath }); })
        .then(function (db) { return runMigrations(db, { dataPath: dataPath }); });
};
exports.initialize = initialize;
