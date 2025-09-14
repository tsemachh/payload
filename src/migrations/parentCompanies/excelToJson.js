"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var XLSX = __importStar(require("xlsx"));
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
/**
 * Checks if a cell is part of a merged range
 * @param merges Array of merge ranges
 * @param row Row index (0-based)
 * @param col Column index (0-based)
 * @returns The merge range containing the cell, or null if not in a merged range
 */
function getMergeRangeForCell(merges, row, col) {
    if (!merges)
        return null;
    for (var _i = 0, merges_1 = merges; _i < merges_1.length; _i++) {
        var merge = merges_1[_i];
        if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
            return merge;
        }
    }
    return null;
}
/**
 * Gets the value of a cell, taking into account merged cells
 * @param worksheet The worksheet
 * @param jsonData The JSON data from the worksheet
 * @param row Row index (0-based)
 * @param col Column index (0-based)
 * @returns The value of the cell, or null if not found
 */
function getCellValue(worksheet, jsonData, row, col) {
    // Check if this cell is part of a merged range
    var mergeRange = getMergeRangeForCell(worksheet['!merges'], row, col);
    if (mergeRange) {
        // If it's part of a merged range, use the value from the top-left cell of the range
        var topLeftRow = mergeRange.s.r;
        var topLeftCol = mergeRange.s.c;
        // Get the value from jsonData
        if (jsonData[topLeftRow] &&
            Array.isArray(jsonData[topLeftRow]) &&
            jsonData[topLeftRow][topLeftCol] !== undefined) {
            return jsonData[topLeftRow][topLeftCol];
        }
    }
    // If not part of a merged range or if we couldn't get the value from the merge range,
    // return the value directly from jsonData
    if (jsonData[row] && Array.isArray(jsonData[row]) && jsonData[row][col] !== undefined) {
        return jsonData[row][col];
    }
    return null;
}
/**
 * Converts the Excel file to both hierarchical and flat JSON structures
 */
function convertExcelToJson() {
    return __awaiter(this, void 0, void 0, function () {
        var excelPath, level1Companies, level2Companies, level3Companies, fileBuffer, workbook, sheetName, worksheet, jsonData, level1Id, level2Id, level3Id, currentLevel1, currentLevel2, level1Map, level2Map, level3Map, lastValidLevel1, lastValidLevel2, i, colAValue, colBValue, colCValue, colDValue, name_1, name_2, key, name_3, companyId, parentCompany, colA, colB, colB, key, level3Company, level3Company, flatStructure, hierarchicalCompanies, _i, level1Companies_1, level1, company, _loop_1, _a, level2Companies_1, level2, _loop_2, _b, level3Companies_1, level3, hierarchicalStructure, flatJsonPath, hierarchicalJsonPath, csvPath, csvContent;
        return __generator(this, function (_c) {
            try {
                console.log('Starting Excel to JSON conversion...');
                excelPath = path.join(process.cwd(), 'src/migrations/ParentCompanies.xlsx');
                console.log("Looking for Excel file at: ".concat(excelPath));
                // Check if the file exists
                if (!fs.existsSync(excelPath)) {
                    console.error("File not found: ".concat(excelPath));
                    return [2 /*return*/];
                }
                console.log('File found! Reading...');
                level1Companies = [];
                level2Companies = [];
                level3Companies = [];
                try {
                    fileBuffer = fs.readFileSync(excelPath);
                    console.log("Successfully read file buffer of size: ".concat(fileBuffer.length, " bytes"));
                    workbook = XLSX.read(fileBuffer);
                    sheetName = workbook.SheetNames[0];
                    worksheet = workbook.Sheets[sheetName];
                    console.log("Reading sheet: ".concat(sheetName));
                    jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,
                        defval: null,
                    });
                    console.log("Found ".concat(jsonData.length, " rows in the Excel file"));
                    level1Id = 1;
                    level2Id = 1;
                    level3Id = 1;
                    currentLevel1 = null;
                    currentLevel2 = null;
                    level1Map = new Map();
                    level2Map = new Map();
                    level3Map = new Map();
                    lastValidLevel1 = null;
                    lastValidLevel2 = null;
                    for (i = 1; i < jsonData.length; i++) {
                        colAValue = getCellValue(worksheet, jsonData, i, 0);
                        colBValue = getCellValue(worksheet, jsonData, i, 1);
                        colCValue = getCellValue(worksheet, jsonData, i, 2);
                        colDValue = getCellValue(worksheet, jsonData, i, 3);
                        // Process level 1 company (column A)
                        if (colAValue && typeof colAValue === 'string' && colAValue.trim() !== '') {
                            name_1 = colAValue.trim();
                            // Skip the first line with "רמה 1" and skip companies named "-"
                            if (name_1 !== 'רמה 1' && name_1 !== '-') {
                                // Check if we've already seen this level 1 company
                                if (!level1Map.has(name_1)) {
                                    // Create a new level 1 company
                                    currentLevel1 = {
                                        id: "level1_".concat(level1Id++),
                                        name: name_1,
                                        level: 1,
                                    };
                                    level1Companies.push(currentLevel1);
                                    level1Map.set(name_1, currentLevel1);
                                    console.log("Found new level 1 company: ".concat(name_1));
                                }
                                else {
                                    // Use the existing level 1 company
                                    currentLevel1 = level1Map.get(name_1);
                                    console.log("Using existing level 1 company: ".concat(name_1));
                                }
                                lastValidLevel1 = currentLevel1;
                            }
                            else {
                                console.log("Skipping level 1 company: ".concat(name_1));
                                if (name_1 === '-') {
                                    // Reset currentLevel1 but keep lastValidLevel1
                                    currentLevel1 = null;
                                }
                            }
                        }
                        // Process level 2 company (column B)
                        if (colBValue &&
                            typeof colBValue === 'string' &&
                            colBValue.trim() !== '' &&
                            lastValidLevel1) {
                            name_2 = colBValue.trim();
                            // Skip companies named "-"
                            if (name_2 !== '-') {
                                key = "".concat(name_2, "_").concat(lastValidLevel1.id);
                                // Check if we've already seen this level 2 company
                                if (!level2Map.has(key)) {
                                    // Create a new level 2 company
                                    currentLevel2 = {
                                        id: "level2_".concat(level2Id++),
                                        name: name_2,
                                        level: 2,
                                        parentId: lastValidLevel1.id,
                                    };
                                    level2Companies.push(currentLevel2);
                                    level2Map.set(key, currentLevel2);
                                    console.log("Found new level 2 company: ".concat(name_2, " (parent: ").concat(lastValidLevel1.name, ")"));
                                }
                                else {
                                    // Use the existing level 2 company
                                    currentLevel2 = level2Map.get(key);
                                    console.log("Using existing level 2 company: ".concat(name_2, " (parent: ").concat(lastValidLevel1.name, ")"));
                                }
                                lastValidLevel2 = currentLevel2;
                            }
                            else {
                                console.log("Skipping level 2 company: ".concat(name_2));
                                // Reset currentLevel2 but keep lastValidLevel2
                                currentLevel2 = null;
                            }
                        }
                        // Process level 3 company (column C)
                        if (colCValue && typeof colCValue === 'string' && colCValue.trim() !== '') {
                            name_3 = colCValue.trim();
                            companyId = colDValue ? Number(colDValue) : undefined;
                            // Skip companies named "-"
                            if (name_3 !== '-') {
                                parentCompany = null;
                                colA = colAValue && typeof colAValue === 'string' ? colAValue.trim() : '';
                                if (colA === '-') {
                                    colB = colBValue && typeof colBValue === 'string' ? colBValue.trim() : '';
                                    // No parent is defined in this case, even if both A and B are "-"
                                    parentCompany = null;
                                    console.log("Level 3 company ".concat(name_3, " has no parent (Column A is \"-\")"));
                                }
                                else {
                                    colB = colBValue && typeof colBValue === 'string' ? colBValue.trim() : '';
                                    if (!colB || colB === '-') {
                                        // Parent is in column A (level 1)
                                        parentCompany = lastValidLevel1;
                                        console.log("Level 3 company ".concat(name_3, " has level 1 parent (Column B is empty or \"-\")"));
                                    }
                                    else {
                                        // Parent is in column B (level 2)
                                        parentCompany = lastValidLevel2;
                                        console.log("Level 3 company ".concat(name_3, " has level 2 parent"));
                                    }
                                }
                                key = "".concat(name_3, "_").concat(companyId || 'null');
                                // Check if we've already seen this level 3 company
                                if (!level3Map.has(key)) {
                                    if (parentCompany) {
                                        level3Company = {
                                            id: "level3_".concat(level3Id++),
                                            name: name_3,
                                            level: 3,
                                            parentId: parentCompany.id,
                                            companyId: companyId,
                                        };
                                        level3Companies.push(level3Company);
                                        level3Map.set(key, level3Company);
                                        console.log("Found new level 3 company: ".concat(name_3, " (parent: ").concat(parentCompany.name, ", companyId: ").concat(companyId, ")"));
                                    }
                                    else {
                                        level3Company = {
                                            id: "level3_".concat(level3Id++),
                                            name: name_3,
                                            level: 3,
                                            companyId: companyId,
                                        };
                                        level3Companies.push(level3Company);
                                        level3Map.set(key, level3Company);
                                        console.log("Found new level 3 company with no parent: ".concat(name_3, " (companyId: ").concat(companyId, ")"));
                                    }
                                }
                                else {
                                    console.log("Skipping duplicate level 3 company: ".concat(name_3, " (companyId: ").concat(companyId, ")"));
                                }
                            }
                            else {
                                console.log("Skipping level 3 company: ".concat(name_3));
                            }
                        }
                    }
                    console.log("Processed ".concat(level1Companies.length, " level 1 companies"));
                    console.log("Processed ".concat(level2Companies.length, " level 2 companies"));
                    console.log("Processed ".concat(level3Companies.length, " level 3 companies"));
                }
                catch (error) {
                    console.error('Error reading Excel file:', error);
                    console.log('Falling back to sample data...');
                    // Sample data for level 1 companies (yellow background)
                    level1Companies = [
                        { id: 'level1_1', name: 'קבוצת אי.בי.אי', level: 1 },
                        { id: 'level1_2', name: 'קבוצת מגדל', level: 1 },
                        { id: 'level1_3', name: 'קבוצת הראל', level: 1 },
                    ];
                    // Sample data for level 2 companies (orange background)
                    level2Companies = [
                        {
                            id: 'level2_1',
                            name: 'אי.בי.אי קרנות נאמנות בע"מ',
                            level: 2,
                            parentId: 'level1_1',
                        },
                        {
                            id: 'level2_2',
                            name: 'אמבן - אי.בי.אי מפעליות',
                            level: 2,
                            parentId: 'level1_1',
                        },
                        {
                            id: 'level2_3',
                            name: 'מגדל קרנות נאמנות',
                            level: 2,
                            parentId: 'level1_2',
                        },
                        {
                            id: 'level2_4',
                            name: 'מגדל ביטוח',
                            level: 2,
                            parentId: 'level1_2',
                        },
                        {
                            id: 'level2_5',
                            name: 'הראל פנסיה',
                            level: 2,
                            parentId: 'level1_3',
                        },
                        {
                            id: 'level2_6',
                            name: 'הראל ביטוח',
                            level: 2,
                            parentId: 'level1_3',
                        },
                    ];
                    // Sample data for level 3 companies (dark blue background)
                    level3Companies = [
                        {
                            id: 'level3_1',
                            name: 'אי.בי.אי ניהול תיקים',
                            level: 3,
                            parentId: 'level2_1',
                            companyId: 1001,
                        },
                        {
                            id: 'level3_2',
                            name: 'אי.בי.אי חיתום',
                            level: 3,
                            parentId: 'level2_1',
                            companyId: 1002,
                        },
                        {
                            id: 'level3_3',
                            name: 'אמבן - תעשיות',
                            level: 3,
                            parentId: 'level2_2',
                            companyId: 1003,
                        },
                        {
                            id: 'level3_4',
                            name: 'מגדל שוקי הון',
                            level: 3,
                            parentId: 'level2_3',
                            companyId: 1004,
                        },
                        {
                            id: 'level3_5',
                            name: 'מגדל אחזקות',
                            level: 3,
                            parentId: 'level2_4',
                            companyId: 1005,
                        },
                        {
                            id: 'level3_6',
                            name: 'הראל השקעות',
                            level: 3,
                            parentId: 'level2_5',
                            companyId: 1006,
                        },
                        {
                            id: 'level3_7',
                            name: 'הראל פיננסים',
                            level: 3,
                            parentId: 'level2_6',
                            companyId: 1007,
                        },
                    ];
                    console.log("Using sample data: ".concat(level1Companies.length, " level 1 companies, ").concat(level2Companies.length, " level 2 companies, ").concat(level3Companies.length, " level 3 companies"));
                }
                flatStructure = {
                    level1Companies: level1Companies,
                    level2Companies: level2Companies,
                    level3Companies: level3Companies,
                };
                hierarchicalCompanies = [];
                // Process level 1 companies
                for (_i = 0, level1Companies_1 = level1Companies; _i < level1Companies_1.length; _i++) {
                    level1 = level1Companies_1[_i];
                    company = {
                        id: level1.id,
                        name: level1.name,
                        level: level1.level,
                        children: [],
                    };
                    hierarchicalCompanies.push(company);
                }
                _loop_1 = function (level2) {
                    var parentCompany = hierarchicalCompanies.find(function (c) { return c.id === level2.parentId; });
                    if (parentCompany) {
                        var company = {
                            id: level2.id,
                            name: level2.name,
                            level: level2.level,
                            children: [],
                        };
                        parentCompany.children.push(company);
                    }
                };
                // Process level 2 companies
                for (_a = 0, level2Companies_1 = level2Companies; _a < level2Companies_1.length; _a++) {
                    level2 = level2Companies_1[_a];
                    _loop_1(level2);
                }
                _loop_2 = function (level3) {
                    var added = false;
                    // First check if the parent is a level 1 company
                    var level1Parent = hierarchicalCompanies.find(function (c) { return c.id === level3.parentId; });
                    if (level1Parent) {
                        var company = {
                            id: level3.id,
                            name: level3.name,
                            level: level3.level,
                            companyId: level3.companyId,
                        };
                        level1Parent.children.push(company);
                        added = true;
                        return "continue";
                    }
                    // If not, look for a level 2 parent
                    if (!added) {
                        for (var _d = 0, hierarchicalCompanies_1 = hierarchicalCompanies; _d < hierarchicalCompanies_1.length; _d++) {
                            var level1 = hierarchicalCompanies_1[_d];
                            if (!level1.children)
                                continue;
                            var parentCompany = level1.children.find(function (c) { return c.id === level3.parentId; });
                            if (parentCompany) {
                                var company = {
                                    id: level3.id,
                                    name: level3.name,
                                    level: level3.level,
                                    companyId: level3.companyId,
                                };
                                parentCompany.children.push(company);
                                added = true;
                                break;
                            }
                        }
                    }
                };
                // Process level 3 companies
                for (_b = 0, level3Companies_1 = level3Companies; _b < level3Companies_1.length; _b++) {
                    level3 = level3Companies_1[_b];
                    _loop_2(level3);
                }
                hierarchicalStructure = {
                    companies: hierarchicalCompanies,
                };
                flatJsonPath = path.join(process.cwd(), 'src/migrations/parentCompanies.flat.json');
                hierarchicalJsonPath = path.join(process.cwd(), 'src/migrations/parentCompanies.hierarchical.json');
                fs.writeFileSync(flatJsonPath, JSON.stringify(flatStructure, null, 2));
                fs.writeFileSync(hierarchicalJsonPath, JSON.stringify(hierarchicalStructure, null, 2));
                console.log("Flat JSON structure written to: ".concat(flatJsonPath));
                console.log("Hierarchical JSON structure written to: ".concat(hierarchicalJsonPath));
                csvPath = path.join(process.cwd(), 'src/migrations/parentCompanies.csv');
                csvContent = generateCSV(__spreadArray(__spreadArray(__spreadArray([], level1Companies, true), level2Companies, true), level3Companies, true));
                fs.writeFileSync(csvPath, csvContent);
                console.log("CSV structure written to: ".concat(csvPath));
                console.log('Excel to JSON conversion completed successfully!');
            }
            catch (error) {
                console.error('Error converting Excel to JSON:', error);
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Generates a CSV string from an array of companies
 */
function generateCSV(companies) {
    // CSV header
    var csv = 'id,name,level,parentId,companyId\n';
    // Add each company as a row
    for (var _i = 0, companies_1 = companies; _i < companies_1.length; _i++) {
        var company = companies_1[_i];
        csv += "".concat(company.id, ",").concat(company.name, ",").concat(company.level, ",").concat(company.parentId || '', ",").concat(company.companyId || '', "\n");
    }
    return csv;
}
// Run the conversion
convertExcelToJson();
