import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

// Type for merged cell range
interface MergeRange {
  s: { r: number; c: number } // start row, column
  e: { r: number; c: number } // end row, column
}

// Define interfaces for our company data
interface CompanyNode {
  id: string
  name: string
  level: 1 | 2 | 3
  companyId?: number
  privateRegistrationNumbers?: number[]
  children?: CompanyNode[]
}

interface FlatCompany {
  id: string
  name: string
  level: 1 | 2 | 3
  parentId?: string
  companyId?: number
  privateRegistrationNumbers?: number[]
}

/**
 * Checks if a cell is part of a merged range
 * @param merges Array of merge ranges
 * @param row Row index (0-based)
 * @param col Column index (0-based)
 * @returns The merge range containing the cell, or null if not in a merged range
 */
function getMergeRangeForCell(
  merges: MergeRange[] | undefined,
  row: number,
  col: number,
): MergeRange | null {
  if (!merges) return null

  for (const merge of merges) {
    if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
      return merge
    }
  }

  return null
}

/**
 * Gets the value of a cell, taking into account merged cells
 * @param worksheet The worksheet
 * @param jsonData The JSON data from the worksheet
 * @param row Row index (0-based)
 * @param col Column index (0-based)
 * @returns The value of the cell, or null if not found
 */
function getCellValue(worksheet: XLSX.WorkSheet, jsonData: any[], row: number, col: number): any {
  // Check if this cell is part of a merged range
  const mergeRange = getMergeRangeForCell(worksheet['!merges'], row, col)

  if (mergeRange) {
    // If it's part of a merged range, use the value from the top-left cell of the range
    const topLeftRow = mergeRange.s.r
    const topLeftCol = mergeRange.s.c

    // Get the value from jsonData
    if (
      jsonData[topLeftRow] &&
      Array.isArray(jsonData[topLeftRow]) &&
      jsonData[topLeftRow][topLeftCol] !== undefined
    ) {
      return jsonData[topLeftRow][topLeftCol]
    }
  }

  // If not part of a merged range or if we couldn't get the value from the merge range,
  // return the value directly from jsonData
  if (jsonData[row] && Array.isArray(jsonData[row]) && jsonData[row][col] !== undefined) {
    return jsonData[row][col]
  }

  return null
}

/**
 * Checks if a cell in column D is part of a merged cell and collects all values from column E
 * for the rows covered by the merged cell
 * @param worksheet The worksheet
 * @param jsonData The JSON data from the worksheet
 * @param row Row index (0-based)
 * @returns Array of private registration numbers or undefined
 */
function collectPrivateRegistrationNumbers(
  worksheet: XLSX.WorkSheet,
  jsonData: any[],
  row: number,
  companyId: number | undefined
): number[] | undefined {
  if (!companyId) return undefined;

  // Use a Set to store unique registration numbers
  const registrationNumbersSet = new Set<number>();

  // First, check if the current row has a registration number in column E
  const currentRowRegNum = getCellValue(worksheet, jsonData, row, 4);
  if (currentRowRegNum) {
    const regNumStr = String(currentRowRegNum).trim();
    if (regNumStr) {
      // Split by common delimiters and convert to numbers
      const numbers = regNumStr
        .split(/[,;\s]+/)
        .filter(num => num.trim() !== '')
        .map(num => Number(num.trim()))
        .filter(num => !isNaN(num));

      // Add to Set to ensure uniqueness
      numbers.forEach(num => registrationNumbersSet.add(num));
    }
  }

  // Now check all rows in the Excel file for the same company ID
  for (let i = 1; i < jsonData.length; i++) {
    if (i === row) continue; // Skip the current row as we already processed it

    const rowCompanyId = getCellValue(worksheet, jsonData, i, 3);
    if (rowCompanyId && Number(rowCompanyId) === companyId) {
      // This row has the same company ID, collect registration number from column E
      const regNum = getCellValue(worksheet, jsonData, i, 4);
      if (regNum) {
        const regNumStr = String(regNum).trim();
        if (regNumStr) {
          // Split by common delimiters and convert to numbers
          const numbers = regNumStr
            .split(/[,;\s]+/)
            .filter(num => num.trim() !== '')
            .map(num => Number(num.trim()))
            .filter(num => !isNaN(num));

          // Add to Set to ensure uniqueness
          numbers.forEach(num => registrationNumbersSet.add(num));
        }
      }
    }
  }

  // Convert Set back to array
  const registrationNumbers = Array.from(registrationNumbersSet);
  return registrationNumbers.length > 0 ? registrationNumbers : undefined;
}

/**
 * Converts the Excel file to both hierarchical and flat JSON structures
 */
async function convertExcelToJson() {
  try {
    console.log('Starting Excel to JSON conversion...')

    // Get the path to the Excel file
    const excelPath = path.join(process.cwd(), 'src/migrations/ParentCompanies.xlsx')

    console.log(`Looking for Excel file at: ${excelPath}`)

    // Check if the file exists
    if (!fs.existsSync(excelPath)) {
      console.error(`File not found: ${excelPath}`)
      return
    }

    console.log('File found! Reading...')

    // Arrays to store company data
    let level1Companies: FlatCompany[] = []
    let level2Companies: FlatCompany[] = []
    let level3Companies: FlatCompany[] = []

    try {
      // Try to read the Excel file as a buffer first
      const fileBuffer = fs.readFileSync(excelPath)
      console.log(`Successfully read file buffer of size: ${fileBuffer.length} bytes`)

      // Parse the Excel file from the buffer
      const workbook = XLSX.read(fileBuffer)

      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      console.log(`Reading sheet: ${sheetName}`)

      // Convert the worksheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      })

      console.log(`Found ${jsonData.length} rows in the Excel file`)

      // Process the Excel data
      // This is a simplified implementation that assumes:
      // - Level 1 companies are in column A
      // - Level 2 companies are in column B
      // - Level 3 companies are in column C
      // - Company IDs for level 3 companies are in column D

      let level1Id = 1
      let level2Id = 1
      let level3Id = 1

      let currentLevel1: FlatCompany | null = null
      let currentLevel2: FlatCompany | null = null

      // Maps to store unique companies by name
      const level1Map = new Map<string, FlatCompany>()
      const level2Map = new Map<string, FlatCompany>()
      const level3Map = new Map<string, FlatCompany>()

      // Store the last valid level 1 and level 2 companies for each row
      let lastValidLevel1: FlatCompany | null = null
      let lastValidLevel2: FlatCompany | null = null

      for (let i = 1; i < jsonData.length; i++) {
        // Get cell values, taking into account merged cells
        const colAValue = getCellValue(worksheet, jsonData, i, 0)
        const colBValue = getCellValue(worksheet, jsonData, i, 1)
        const colCValue = getCellValue(worksheet, jsonData, i, 2)
        const colDValue = getCellValue(worksheet, jsonData, i, 3)
        const colEValue = getCellValue(worksheet, jsonData, i, 4) // Column E contains private registration numbers

        // Process level 1 company (column A)
        if (colAValue && typeof colAValue === 'string' && colAValue.trim() !== '') {
          const name = colAValue.trim()

          // Skip the first line with "רמה 1" and skip companies named "-"
          if (name !== 'רמה 1' && name !== '-') {
            // Check if we've already seen this level 1 company
            if (!level1Map.has(name)) {
              // Create a new level 1 company
              currentLevel1 = {
                id: `level1_${level1Id++}`,
                name,
                level: 1 as const,
              }
              level1Companies.push(currentLevel1)
              level1Map.set(name, currentLevel1)
              console.log(`Found new level 1 company: ${name}`)
            } else {
              // Use the existing level 1 company
              currentLevel1 = level1Map.get(name)!
              console.log(`Using existing level 1 company: ${name}`)
            }

            lastValidLevel1 = currentLevel1
          } else {
            console.log(`Skipping level 1 company: ${name}`)
            if (name === '-') {
              // Reset currentLevel1 but keep lastValidLevel1
              currentLevel1 = null
            }
          }
        }

        // Process level 2 company (column B)
        if (
          colBValue &&
          typeof colBValue === 'string' &&
          colBValue.trim() !== '' &&
          lastValidLevel1
        ) {
          const name = colBValue.trim()

          // Skip companies named "-"
          if (name !== '-') {
            // Create a unique key for level 2 companies (name + parent)
            const key = `${name}_${lastValidLevel1.id}`

            // Check if we've already seen this level 2 company
            if (!level2Map.has(key)) {
              // Create a new level 2 company
              currentLevel2 = {
                id: `level2_${level2Id++}`,
                name,
                level: 2 as const,
                parentId: lastValidLevel1.id,
              }
              level2Companies.push(currentLevel2)
              level2Map.set(key, currentLevel2)
              console.log(`Found new level 2 company: ${name} (parent: ${lastValidLevel1.name})`)
            } else {
              // Use the existing level 2 company
              currentLevel2 = level2Map.get(key)!
              console.log(
                `Using existing level 2 company: ${name} (parent: ${lastValidLevel1.name})`,
              )
            }

            lastValidLevel2 = currentLevel2
          } else {
            console.log(`Skipping level 2 company: ${name}`)
            // Reset currentLevel2 but keep lastValidLevel2
            currentLevel2 = null
          }
        }

        // Process level 3 company (column C)
        if (colCValue && typeof colCValue === 'string' && colCValue.trim() !== '') {
          const name = colCValue.trim()
          const companyId = colDValue ? Number(colDValue) : undefined

          // Process private registration numbers from column E
          // Use the new function to collect all registration numbers for this company ID
          const privateRegistrationNumbers = collectPrivateRegistrationNumbers(worksheet, jsonData, i, companyId)

          // Skip companies named "-"
          if (name !== '-') {
            // Determine the parent based on the rule:
            // - If column A is "-", then no parent is defined
            // - If column B has no parent (or is "-"), then the parent is in column A
            // - If cell is in a merged range, use the value from the top-left cell of the range
            let parentCompany = null

            // Check if column A is "-"
            const colA = colAValue && typeof colAValue === 'string' ? colAValue.trim() : ''
            if (colA === '-') {
              // Check if column B is also "-"
              const colB = colBValue && typeof colBValue === 'string' ? colBValue.trim() : ''
              // No parent is defined in this case, even if both A and B are "-"
              parentCompany = null
              console.log(`Level 3 company ${name} has no parent (Column A is "-")`)
            } else {
              // Check if column B is empty or "-"
              const colB = colBValue && typeof colBValue === 'string' ? colBValue.trim() : ''
              if (!colB || colB === '-') {
                // Parent is in column A (level 1)
                parentCompany = lastValidLevel1
                console.log(`Level 3 company ${name} has level 1 parent (Column B is empty or "-")`)
              } else {
                // Parent is in column B (level 2)
                parentCompany = lastValidLevel2
                console.log(`Level 3 company ${name} has level 2 parent`)
              }
            }

            // Create a unique key for level 3 companies (name + companyId)
            const key = `${name}_${companyId || 'null'}`

            // Check if we've already seen this level 3 company
            if (!level3Map.has(key)) {
              if (parentCompany) {
                const level3Company = {
                  id: `level3_${level3Id++}`,
                  name,
                  level: 3 as const,
                  parentId: parentCompany.id,
                  companyId,
                  privateRegistrationNumbers,
                }
                level3Companies.push(level3Company)
                level3Map.set(key, level3Company)
                console.log(
                  `Found new level 3 company: ${name} (parent: ${parentCompany.name}, companyId: ${companyId}, privateRegistrationNumbers: ${privateRegistrationNumbers})`,
                )
              } else {
                // If no parent is defined, still add the company but without a parentId
                const level3Company = {
                  id: `level3_${level3Id++}`,
                  name,
                  level: 3 as const,
                  companyId,
                  privateRegistrationNumbers,
                }
                level3Companies.push(level3Company)
                level3Map.set(key, level3Company)
                console.log(
                  `Found new level 3 company with no parent: ${name} (companyId: ${companyId}, privateRegistrationNumbers: ${privateRegistrationNumbers})`,
                )
              }
            } else {
              console.log(`Skipping duplicate level 3 company: ${name} (companyId: ${companyId})`)
            }
          } else {
            console.log(`Skipping level 3 company: ${name}`)
          }
        }
      }

      console.log(`Processed ${level1Companies.length} level 1 companies`)
      console.log(`Processed ${level2Companies.length} level 2 companies`)
      console.log(`Processed ${level3Companies.length} level 3 companies`)
    } catch (error) {
      console.error('Error reading Excel file:', error)
      console.log('Falling back to sample data...')

      // Sample data for level 1 companies (yellow background)
      level1Companies = [
        { id: 'level1_1', name: 'קבוצת אי.בי.אי', level: 1 as const },
        { id: 'level1_2', name: 'קבוצת מגדל', level: 1 as const },
        { id: 'level1_3', name: 'קבוצת הראל', level: 1 as const },
      ]

      // Sample data for level 2 companies (orange background)
      level2Companies = [
        {
          id: 'level2_1',
          name: 'אי.בי.אי קרנות נאמנות בע"מ',
          level: 2 as const,
          parentId: 'level1_1',
        },
        {
          id: 'level2_2',
          name: 'אמבן - אי.בי.אי מפעליות',
          level: 2 as const,
          parentId: 'level1_1',
        },
        {
          id: 'level2_3',
          name: 'מגדל קרנות נאמנות',
          level: 2 as const,
          parentId: 'level1_2',
        },
        {
          id: 'level2_4',
          name: 'מגדל ביטוח',
          level: 2 as const,
          parentId: 'level1_2',
        },
        {
          id: 'level2_5',
          name: 'הראל פנסיה',
          level: 2 as const,
          parentId: 'level1_3',
        },
        {
          id: 'level2_6',
          name: 'הראל ביטוח',
          level: 2 as const,
          parentId: 'level1_3',
        },
      ]

      // Sample data for level 3 companies (dark blue background)
      level3Companies = [
        {
          id: 'level3_1',
          name: 'אי.בי.אי ניהול תיקים',
          level: 3 as const,
          parentId: 'level2_1',
          companyId: 1001,
        },
        {
          id: 'level3_2',
          name: 'אי.בי.אי חיתום',
          level: 3 as const,
          parentId: 'level2_1',
          companyId: 1002,
        },
        {
          id: 'level3_3',
          name: 'אמבן - תעשיות',
          level: 3 as const,
          parentId: 'level2_2',
          companyId: 1003,
        },
        {
          id: 'level3_4',
          name: 'מגדל שוקי הון',
          level: 3 as const,
          parentId: 'level2_3',
          companyId: 1004,
        },
        {
          id: 'level3_5',
          name: 'מגדל אחזקות',
          level: 3 as const,
          parentId: 'level2_4',
          companyId: 1005,
        },
        {
          id: 'level3_6',
          name: 'הראל השקעות',
          level: 3 as const,
          parentId: 'level2_5',
          companyId: 1006,
        },
        {
          id: 'level3_7',
          name: 'הראל פיננסים',
          level: 3 as const,
          parentId: 'level2_6',
          companyId: 1007,
        },
      ]

      console.log(
        `Using sample data: ${level1Companies.length} level 1 companies, ${level2Companies.length} level 2 companies, ${level3Companies.length} level 3 companies`,
      )
    }

    // Create flat JSON structure
    const flatStructure = {
      level1Companies,
      level2Companies,
      level3Companies,
    }

    // Create hierarchical JSON structure
    const hierarchicalCompanies: CompanyNode[] = []

    // Process level 1 companies
    for (const level1 of level1Companies) {
      const company: CompanyNode = {
        id: level1.id,
        name: level1.name,
        level: level1.level,
        children: [],
      }
      hierarchicalCompanies.push(company)
    }

    // Process level 2 companies
    for (const level2 of level2Companies) {
      const parentCompany = hierarchicalCompanies.find((c) => c.id === level2.parentId)
      if (parentCompany) {
        const company: CompanyNode = {
          id: level2.id,
          name: level2.name,
          level: level2.level,
          children: [],
        }
        parentCompany.children!.push(company)
      }
    }

    // Process level 3 companies
    for (const level3 of level3Companies) {
      let added = false

      // First check if the parent is a level 1 company
      const level1Parent = hierarchicalCompanies.find((c) => c.id === level3.parentId)
      if (level1Parent) {
        const company: CompanyNode = {
          id: level3.id,
          name: level3.name,
          level: level3.level,
          companyId: level3.companyId,
          privateRegistrationNumbers: level3.privateRegistrationNumbers,
        }
        level1Parent.children!.push(company)
        added = true
        continue
      }

      // If not, look for a level 2 parent
      if (!added) {
        for (const level1 of hierarchicalCompanies) {
          if (!level1.children) continue

          const parentCompany = level1.children.find((c) => c.id === level3.parentId)
          if (parentCompany) {
            const company: CompanyNode = {
              id: level3.id,
              name: level3.name,
              level: level3.level,
              companyId: level3.companyId,
              privateRegistrationNumbers: level3.privateRegistrationNumbers,
            }
            parentCompany.children!.push(company)
            added = true
            break
          }
        }
      }
    }

    // Create hierarchical structure
    const hierarchicalStructure = {
      companies: hierarchicalCompanies,
    }

    // Write the JSON files
    const flatJsonPath = path.join(process.cwd(), 'src/migrations/parentCompanies.flat.json')
    const hierarchicalJsonPath = path.join(
      process.cwd(),
      'src/migrations/parentCompanies.hierarchical.json',
    )

    fs.writeFileSync(flatJsonPath, JSON.stringify(flatStructure, null, 2))
    fs.writeFileSync(hierarchicalJsonPath, JSON.stringify(hierarchicalStructure, null, 2))

    console.log(`Flat JSON structure written to: ${flatJsonPath}`)
    console.log(`Hierarchical JSON structure written to: ${hierarchicalJsonPath}`)

    // Also create a CSV version
    const csvPath = path.join(process.cwd(), 'src/migrations/parentCompanies.csv')
    const csvContent = generateCSV([...level1Companies, ...level2Companies, ...level3Companies])
    fs.writeFileSync(csvPath, csvContent)

    console.log(`CSV structure written to: ${csvPath}`)

    console.log('Excel to JSON conversion completed successfully!')
  } catch (error) {
    console.error('Error converting Excel to JSON:', error)
  }
}

/**
 * Generates a CSV string from an array of companies
 */
function generateCSV(companies: FlatCompany[]): string {
  // CSV header
  let csv = 'id,name,level,parentId,companyId,privateRegistrationNumbers\n'

  // Add each company as a row
  for (const company of companies) {
    const privateRegNums = company.privateRegistrationNumbers ? 
      company.privateRegistrationNumbers.join(';') : '';
    csv += `${company.id},${company.name},${company.level},${company.parentId || ''},${company.companyId || ''},${privateRegNums}\n`
  }

  return csv
}

// Run the conversion
convertExcelToJson()
