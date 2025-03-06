import payload from 'payload';

const privateStocks = [56085, 1159037];

const notActiveStocks = [
  45609, 601762, 625872, 1082650, 1102458, 1139179, 1141118, 1141712,
  1142512, 1145598, 1151141, 1181734, 1182583, 3730504, 4220349,
  5760244, 8230252, 11571556, 32075814, 70105475, 70110254, 70166004,
  70457460, 70504378, 71408660, 72896020, 75461160, 791233340,
  892134503, 983134727
];

const nonTradableStocks = [
  1095025, 1095942, 1098300, 1099944, 1099951, 1099969, 1100833,
  1101567, 1102482, 1102854, 1104355, 1107531, 1109180, 1110378,
  1110980, 1112911, 1113398, 1113562, 1116755, 1118496, 1120740,
  1120880, 1124346, 1124650, 1125624, 1127679, 1128347, 1128396,
  1131184, 1131614, 1134394, 1137041, 1138999, 1139575, 1139781,
  1140136, 1141274, 1142009, 1143270, 1143304, 1162205, 1167212,
  1169614, 1175868, 1178813, 1179225, 1182963, 1320118, 1790054,
  1790062, 3180361, 3390044, 3520046, 3570025, 3720075, 3720109,
  3720117, 3780038, 3780079, 3780087, 3980018, 4150090, 4150124,
  4550042, 5050240, 5050265, 5740022, 6110365, 6110431, 6110480,
  6380083, 7509938, 7980154, 7980337
];

const foreignStocks = [
  { stockId: 1104845, isin: 'IL0012008152' },
  { stockId: 1120609, isin: 'US74365A3095' },
  { stockId: 1160829, isin: 'US73931J1097' },
  { stockId: 1170901, isin: 'US0412421085' },
  { stockId: 7653211, isin: 'IL0010951403' },
  { stockId: 32048639, isin: 'IL0010807209' },
  { stockId: 32079436, isin: 'IL0011582033' },
  { stockId: 70100173, isin: 'IL0011741688' },
  { stockId: 70102583, isin: 'IL0011762130' },
  { stockId: 70105160, isin: 'US81730H1095' },
  { stockId: 70115449, isin: 'US5738741041' },
  { stockId: 70121637, isin: 'US5771281012' },
  { stockId: 70128129, isin: 'IL0011974909' },
  { stockId: 70182514, isin: 'US23725P2092' },
  { stockId: 70199989, isin: 'US6974351057' },
  { stockId: 70215199, isin: 'US92343X1000' },
  { stockId: 70237995, isin: 'US83417M1045' },
  { stockId: 70240049, isin: 'US24665A1034' },
  { stockId: 70242383, isin: 'IL0065100930' },
  { stockId: 70268123, isin: 'US03044L2043' },
  { stockId: 70327168, isin: 'US7080621045' },
  { stockId: 70393681, isin: 'IL0010818685' },
  { stockId: 70404645, isin: 'IL0010826928' },
  { stockId: 70486147, isin: 'US4595061015' },
  { stockId: 70523568, isin: 'IL0010855885' },
  { stockId: 70592613, isin: 'IL0011326795' },
  { stockId: 70596317, isin: 'US1572101053' },
  { stockId: 70679923, isin: 'GI000A0F6407' },
  { stockId: 70696034, isin: 'US72815L1070' },
  { stockId: 70822143, isin: 'IL0011316309' },
  { stockId: 70830054, isin: 'GG00B1Z5FH87' },
  { stockId: 70875653, isin: 'US86771W1053' },
  { stockId: 74708702, isin: 'IL0011267213' },
  { stockId: 74753625, isin: 'US7574683014' },
  { stockId: 74963778, isin: 'US9222801022' },
  { stockId: 75178756, isin: 'IL0011216723' },
  { stockId: 75486521, isin: 'IL0011794802' },
  { stockId: 75550034, isin: 'IL0011754137' },
  { stockId: 75550037, isin: 'US4335392027' },
  { stockId: 77177210, isin: 'US52567D1072' },
  { stockId: 77553329, isin: 'US0412421085' },
  { stockId: 77841211, isin: 'IL0011751653' },
  { stockId: 77905396, isin: 'US70451X1046' },
  { stockId: 77944569, isin: 'US69002R1032' },
  { stockId: 78325479, isin: 'IL0011786154' },
  { stockId: 78543634, isin: 'IL0011858912' },
  { stockId: 555001706, isin: 'US02156U2006' },
  { stockId: 555001845, isin: 'IL0011796880' },
  { stockId: 706341910, isin: 'IL0011745804' },
  { stockId: 791233323, isin: 'IL0011691438' },
  { stockId: 791233423, isin: 'US52661A1088' }
];

export async function seedStockMigrationMapping() {
  try {
    // Create Private stocks
    for (const stockId of privateStocks) {
      await payload.create({
        collection: 'stock-migration-mapping',
        data: {
          stockId,
          type: 'Private'
        }
      });
    }

    // Create NotActive stocks
    for (const stockId of notActiveStocks) {
      await payload.create({
        collection: 'stock-migration-mapping',
        data: {
          stockId,
          type: 'NotActive'
        }
      });
    }

    // Create NonTradable stocks
    for (const stockId of nonTradableStocks) {
      await payload.create({
        collection: 'stock-migration-mapping',
        data: {
          stockId,
          type: 'NonTradable'
        }
      });
    }

    // Create Foreign stocks
    for (const stock of foreignStocks) {
      await payload.create({
        collection: 'stock-migration-mapping',
        data: {
          stockId: stock.stockId,
          type: 'Foreign',
          isin: stock.isin
        }
      });
    }

    console.log('Successfully seeded stock-migration-mapping collection');
  } catch (error) {
    console.error('Error seeding stock-migration-mapping:', error);
    throw error;
  }
}