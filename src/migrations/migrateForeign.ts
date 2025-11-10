import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { Stock, StockType } from '@/payload-types'
import { upsertStockFromImport } from '@/migrations/utils/migrateUtils'
import { getIdOfRelationField, getSequenceStockId, getStockByStockId } from '@/utils/utils'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import ImportStock from '@/collections/stocks/imports/ImportStock'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting foreign stocks migration process...')
    // Create a map of stockId -> isin
    const stockToIsinMap = new Map<string, string>()
    const foreignStocksData = await payload.find({
      collection: 'stock-migration-mapping',
      where: {
        type: {
          equals: 'Foreign',
        },
      },
      limit: 1000,
    })

    // Build the stockId -> isin mapping
    for (let i = 0; i < foreignStocksData.docs.length; i++) {
      const doc = foreignStocksData.docs[i]
      stockToIsinMap.set(`${doc.stockId}`, doc.isin as string)
    }
    console.log('Isin', JSON.stringify(stockToIsinMap))

    const foreignStocks = await payload.find({
      collection: 'stocks',
      where: {
        origin: {
          equals: 'Foreign',
        },
      },
      limit: 0,
    })
    console.log('foreignStocks.docs.length', foreignStocks.docs.length)
    // Process each foreign stock
    for (const originalStock of foreignStocks.docs) {
      try {
        const isin = stockToIsinMap.get(`${originalStock.stockId}`)
        if (!isin) {
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: `${originalStock.stockId}`,
            comments: `No ISIN found for foreign stock ${originalStock.stockId}`,
          })
          continue
        }
        // Check if a stock with this ISIN already exists
        let newStockSequence = await getSequenceStockId(payload, isin)
        if (!newStockSequence) {
          // Create or update the ISIN stock
          newStockSequence = (await upsertStockFromImport(
            null,
            {
              stockID: isin,
              name: originalStock.name as string,
              symbol: originalStock.symbol as string,
              type: originalStock.type as StockType,
              longName: originalStock.longName as string,
            } as ImportStock,
            req,
            true, // tradable
            'Foreign', // origin
            true, // active
            `Created from foreign stock ${originalStock.stockId}`,
          )) as string | null
        }

        // Update the original stock to point to the new ISIN stock
        if (newStockSequence) {
          req.payload.update({
            collection: 'stocks',
            id: originalStock.id,
            data: {
              relatedStock: newStockSequence,
              tradable: false,
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateForeign' },
            },
          })
          // Update all stocks that had this stock as related to point to the new ISIN stock
          req.payload.update({
            collection: 'stocks',
            data: {
              tradable: false,
              origin: 'Foreign',
              active: true,
              relatedStock: newStockSequence,
            },
            where: {
              relatedStock: {
                equals: originalStock.id,
              },
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateForeign' },
            },
          })
          req.payload.update({
            collection: 'meetings',
            data: {
              stock: newStockSequence,
            },
            where: {
              stock: {
                equals: originalStock.id,
              },
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateForeign' },
            },
          })
          // Update all stock values to point to the new stock
          req.payload.update({
            collection: 'stock-values',
            data: {
              stockId: newStockSequence,
            },
            where: {
              stockId: {
                equals: originalStock.id,
              },
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateForeign' },
            },
          })
          console.log(`Successfully processed stock ${originalStock.stockId} with ISIN ${isin}`)
        }
      } catch (error) {
        await logMigrationFault({
          payload,
          type: 'stock',
          comments: `Failed to process foreign stock ${originalStock.stockId}: ${JSON.stringify(error)}`,
          typeId: originalStock.stockId,
        })
      }
    }

    console.log('Foreign stocks migration completed successfully')
  } catch (error) {
    console.error('Error during foreign stocks migration:', error)
    throw error
  }
}

export async function migrateDual({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting dual-listed stocks migration process...')

    // Create a JSON mapping based on the provided table
    const dualStocksMapping = [
      {
        hebrewName: "אבוג'ן",
        englishName: 'Abogen',
        taseISIN: '1105055',
        foreignISIN: 'IL0011050551',
      },
      {
        hebrewName: 'אודיוקודס',
        englishName: 'Audiocodes',
        taseISIN: '1082965',
        foreignISIN: 'IL0010829658',
      },
      {
        hebrewName: "אופקו הלת'",
        englishName: 'Opko Health',
        taseISIN: '1129543',
        foreignISIN: 'US68375N1037',
      },
      {
        hebrewName: 'אורמד פארמ',
        englishName: 'Oramed Pharmaceuticals',
        taseISIN: '1141324',
        foreignISIN: 'US68403P2039',
      },
      {
        hebrewName: 'אורמת טכנו',
        englishName: 'Ormat Technologies',
        taseISIN: '1134402',
        foreignISIN: 'US6866881021',
      },
      {
        hebrewName: 'איי.סי.אל',
        englishName: 'ICL',
        taseISIN: '281014',
        foreignISIN: 'IL0002810146',
      },
      {
        hebrewName: 'אינטרקיור',
        englishName: 'Intercure',
        taseISIN: '1106376',
        foreignISIN: 'IL0011063760',
      },
      {
        hebrewName: 'אלארום',
        englishName: 'Alarum',
        taseISIN: '1083856',
        foreignISIN: 'US78643B5003',
      },
      {
        hebrewName: 'אלביט מערכות',
        englishName: 'Elbit Systems',
        taseISIN: '1081124',
        foreignISIN: 'IL0010811243',
      },
      {
        hebrewName: 'אלוט',
        englishName: 'Allot',
        taseISIN: '1099654',
        foreignISIN: 'IL0010996549',
      },
      {
        hebrewName: 'אלומיי',
        englishName: 'Alumay',
        taseISIN: '1082635',
        foreignISIN: 'IL0010826357',
      },
      {
        hebrewName: 'אנלייבקס',
        englishName: 'Enlivex',
        taseISIN: '1158997',
        foreignISIN: 'IL0011319527',
      },
      {
        hebrewName: 'אנלייט אנרגיה',
        englishName: 'Enlight Renewable Energy',
        taseISIN: '720011',
        foreignISIN: 'IL0007200111',
      },
      {
        hebrewName: "אנרג'יאן",
        englishName: 'Energean',
        taseISIN: '1155290',
        foreignISIN: 'GB00BG12Y042',
      },
      {
        hebrewName: 'אקס טי אל',
        englishName: 'XTL',
        taseISIN: '1085497',
        foreignISIN: 'IL0010854979',
      },
      {
        hebrewName: 'ארבה רובוטיקס',
        englishName: 'Arbe Robotics',
        taseISIN: '1179662',
        foreignISIN: 'IL0011796625',
      },
      {
        hebrewName: 'באטמ',
        englishName: 'BATM',
        taseISIN: '1158823',
        foreignISIN: 'IL0010849045',
      },
      {
        hebrewName: 'ביוליין',
        englishName: 'BioLineRx',
        taseISIN: '1101518',
        foreignISIN: 'US09071M3043',
      },
      {
        hebrewName: 'בריינסוויי',
        englishName: 'Brainsway',
        taseISIN: '1100718',
        foreignISIN: 'US10501L1061',
      },
      {
        hebrewName: 'גילת',
        englishName: 'Gilat Satellite Networks',
        taseISIN: '1082510',
        foreignISIN: 'IL0010825102',
      },
      {
        hebrewName: 'ויליפוד אינטרנש',
        englishName: 'Willifood International',
        taseISIN: '1082858',
        foreignISIN: 'IL0010828585',
      },
      {
        hebrewName: 'זוז אסטרטגיה',
        englishName: 'Zooz Power',
        taseISIN: '1174184',
        foreignISIN: 'IL0011741845',
      },
      {
        hebrewName: 'טאואר',
        englishName: 'Tower Semiconductor',
        taseISIN: '1082379',
        foreignISIN: 'IL0010823792',
      },
      {
        hebrewName: 'טבע',
        englishName: 'Teva Pharmaceutical Industries',
        taseISIN: '629014',
        foreignISIN: 'US8816242098',
      },
      {
        hebrewName: "יו.אמ.איץ'",
        englishName: 'UMH Properties',
        taseISIN: '1184282',
        foreignISIN: 'US9030021037',
      },
      {
        hebrewName: 'כן פייט ביופרמה',
        englishName: 'Can-Fite BioPharma',
        taseISIN: '1094473',
        foreignISIN: 'US13471N3008',
      },
      {
        hebrewName: 'לייבפרסון',
        englishName: 'LivePerson',
        taseISIN: '1123017',
        foreignISIN: 'US5381461012',
      },
      {
        hebrewName: 'ליניאג תרפיוטיק',
        englishName: 'Lineage Cell Therapeutics',
        taseISIN: '1136365',
        foreignISIN: 'US53366P1093',
      },
      {
        hebrewName: "מג'יק",
        englishName: 'Magic Software Enterprises',
        taseISIN: '1082312',
        foreignISIN: 'IL0010823123',
      },
      {
        hebrewName: 'נאייקס',
        englishName: 'Nayax',
        taseISIN: '1175116',
        foreignISIN: 'IL0011751166',
      },
      {
        hebrewName: 'נובה',
        englishName: 'Nova Measuring Instruments',
        taseISIN: '1084557',
        foreignISIN: 'IL0010845571',
      },
      {
        hebrewName: 'נייס',
        englishName: 'NICE Ltd.',
        taseISIN: '273011',
        foreignISIN: 'US6536561086',
      },
      {
        hebrewName: 'סאפיינס',
        englishName: 'Sapiens International Corporation',
        taseISIN: '1087659',
        foreignISIN: 'KYG7T16G1039',
      },
      {
        hebrewName: 'סטרוברי אינק',
        englishName: 'Strawberry Inc.',
        taseISIN: '1205913',
        foreignISIN: 'US8631821019',
      },
      {
        hebrewName: 'סיאון',
        englishName: 'Sion',
        taseISIN: '1194000',
        foreignISIN: 'US17259U2042',
      },
      {
        hebrewName: 'סייברוואן',
        englishName: 'CyberOne',
        taseISIN: '1166693',
        foreignISIN: 'IL0011666935',
      },
      {
        hebrewName: 'פורמולה מערכות',
        englishName: 'Formula Systems',
        taseISIN: '256016',
        foreignISIN: 'US3464141056',
      },
      {
        hebrewName: 'פורסייט',
        englishName: 'Foresight Autonomous Holdings',
        taseISIN: '199018',
        foreignISIN: 'US3455232039',
      },
      {
        hebrewName: 'פלאזה סנטר -ס',
        englishName: 'Plaza Centers - S',
        taseISIN: '1109917',
        foreignISIN: 'NL0011882741',
      },
      {
        hebrewName: 'פלורי',
        englishName: 'Flory',
        taseISIN: '1121730',
        foreignISIN: 'US72942G2030',
      },
      {
        hebrewName: 'פריון נטוורק',
        englishName: 'Perion Network',
        taseISIN: '1095819',
        foreignISIN: 'IL0010958192',
      },
      {
        hebrewName: 'פרפל ביוטק',
        englishName: 'Purple Biotech',
        taseISIN: '765016',
        foreignISIN: 'US74638P2083',
      },
      {
        hebrewName: 'קומפיוגן',
        englishName: 'Compugen',
        taseISIN: '1085208',
        foreignISIN: 'IL0010852080',
      },
      {
        hebrewName: 'קמהדע',
        englishName: 'Kamada',
        taseISIN: '1094119',
        foreignISIN: 'IL0010941198',
      },
      {
        hebrewName: 'קמטק',
        englishName: 'Camtek',
        taseISIN: '1095264',
        foreignISIN: 'IL0010952641',
      },
      {
        hebrewName: 'קנון',
        englishName: 'Kenon Holdings',
        taseISIN: '1134139',
        foreignISIN: 'SG9999012629',
      },
      {
        hebrewName: 'שרין טכנו',
        englishName: 'Sharin Techno',
        taseISIN: '1092725',
        foreignISIN: 'IL0010927254',
      },
      {
        hebrewName: 'תאת טכנו',
        englishName: 'TAT Technologies',
        taseISIN: '1082726',
        foreignISIN: 'IL0010827264',
      },
    ]

    // Process each dual-listed stock
    for (const dualStock of dualStocksMapping) {
      try {
        // Find the TASE stock
        let taseStock = null

        // If the TASE ISIN starts with IL, find by stockId (removing IL and leading zeros)
        if (dualStock.taseISIN) {
          // Remove 'IL' and leading zeros to get the stockId
          const stockId = dualStock.taseISIN
          taseStock = await getStockByStockId(payload, stockId, 1)
        }

        // If not found by ISIN or ISIN doesn't start with IL, find by name
        if (!taseStock) {
          const stocksByName = await payload.find({
            collection: 'stocks',
            where: {
              name: {
                equals: dualStock.hebrewName,
              },
              origin: {
                equals: 'TASE',
              },
            },
            depth: 1,
            limit: 1,
          })

          if (stocksByName.docs.length > 0) {
            taseStock = stocksByName.docs[0]
          }
        }

        if (!taseStock) {
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: dualStock.taseISIN,
            comments: `Could not find TASE stock for dual-listed stock ${dualStock.hebrewName} (${dualStock.englishName})`,
          })
          continue
        }

        // Create the Foreign Stock with the Foreign Exchange ISIN
        let foreignStock = await getStockByStockId(payload, dualStock.foreignISIN)

        if (!foreignStock) {
          // Create a new Foreign Stock
          const foreignStockId = (await upsertStockFromImport(
            null,
            {
              stockID: dualStock.foreignISIN,
              name: dualStock.englishName,
              symbol: taseStock.symbol as string,
              type: taseStock.type as StockType,
              longName: dualStock.englishName,
              isDual: true,
            } as ImportStock,
            req,
            true, // tradable
            'Foreign', // origin
            true, // active
            `Created as dual-listed stock for ${dualStock.hebrewName}`,
          )) as string

          if (foreignStockId) {
            foreignStock = await payload.findByID({
              collection: 'stocks',
              id: foreignStockId,
            })
          }
        } else {
          await payload.update({
            collection: 'stocks',
            id: foreignStock.id,
            data: {
              isDual: true,
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateForeign' },
            },
          })
        }

        if (!foreignStock) {
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: dualStock.foreignISIN,
            comments: `Failed to create Foreign Stock for dual-listed stock ${dualStock.hebrewName} (${dualStock.englishName})`,
          })
          continue
        }

        // Mark the TASE stock as having a dual listing and point to the Foreign Stock
        await payload.update({
          collection: 'stocks',
          id: taseStock.id,
          data: {
            hasDual: true,
            dualStock: foreignStock.id,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration', process: 'migrateForeign' },
          },
        })

        // Process related stocks with English names
        if (taseStock.relations && taseStock.relations.docs) {
          for (const relatedStock of taseStock.relations.docs) {
            // Check if the related stock's name is in English
            // This is a simple check - if the name matches the pattern of English characters
            const stockName = (relatedStock as Stock).name as string
            if (stockName && /^[A-Za-z0-9\s\-]+$/.test(stockName)) {
              const relatedStockId = getIdOfRelationField(relatedStock)
              // Update the related stock to point to the Foreign Stock
              if (relatedStockId)
                await payload.update({
                  collection: 'stocks',
                  id: relatedStockId,
                  data: {
                    relatedStock: foreignStock.id,
                  },
                  req: {
                    ...req,
                    context: { ...req.context, from: 'migration', process: 'migrateForeign' },
                  },
                })
            }
          }
        }

        console.log(
          `Successfully processed dual-listed stock ${dualStock.hebrewName} (${dualStock.englishName})`,
        )
      } catch (error) {
        await logMigrationFault({
          payload,
          type: 'stock',
          comments: `Failed to process dual-listed stock ${dualStock.hebrewName} (${dualStock.englishName}): ${JSON.stringify(error)}`,
          typeId: dualStock.taseISIN,
        })
      }
    }

    console.log('Dual-listed stocks migration completed successfully')
  } catch (error) {
    console.error('Error during dual-listed stocks migration:', error)
    throw error
  }
}
