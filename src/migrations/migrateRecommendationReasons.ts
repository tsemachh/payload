import { MigrateUpArgs } from '@payloadcms/db-mongodb'

/**
 * Migration to insert predefined recommendation reasons into the recommendation-reasons collection
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting recommendation reasons migration process...')

  // Array of recommendation reason texts to insert
  const recommendationReasons = [
    'אנו סבורים כי תנאי התגמול הינם סבירים ביחס לפעילות החברה וביחס לנושאי משרה בחברות דומות.',
    'אנו סבורים כי תנאי התגמול אינם סבירים ביחס לפעילות החברה וביחס לנושאי משרה בחברות דומות.',
    'להערכתנו, בדירקטוריון החברה שיעור סביר של דירקטורים שאינם תלויים וזאת בשים לב למבנה הבעלות בחברה.',
    'להערכתנו, בדירקטוריון החברה שיעור שאינו סביר של דב"ת וזאת בשים לב למבנה השליטה והרכב הדירקטוריון',
    'לאחר המלצת ועדת מינוי הדירקטורים כפי שפורטה לעיל, אין אנו מוצאים לנכון להמליץ על מקצת המועמדים ככאלו שעדיפים על היתר, וזאת במיוחד לאור הליך האיתור על ידי הועדה והקריטריונים שנבחנו על ידם, אשר מצאו את כלל הדירקטורים כעומדים בהם.',
    'כפל כהונה של נושא משרה כדירקטור',
    'מינוי דירקטור בהתאם למנגנון של דירקטוריון מדורג',
    'בבחינת כתבי הפטור של החברה, עולה כי הם עומדים בקריטריונים המקובלים בשוק, לרבות החרגת עניין אישי',
    'בבחינת כתבי השיפוי של החברה, עולה כי הם עומדים בקריטריונים המקובלים בשוק, לרבות הגבלת היקף השיפוי',
    'לאחר בחינת היקף הכיסוי הביטוחי של החברה,  אנו סבורים כי בהתאם לפעילותה ואמצעיה, חברות דומות וכמקובל בשוק, הרי שתנאי הפוליסה הינם סבירים.',
    'לאחר בחינת רצינואל העסקה והכדאיות הכלכלית ובשים לב לנימוקי הדירקטריון, להערכתנו פוחת החשש לניצול מבנה השליטה בחברה, על חשבון בעלי מניות המיעוט',
    'אנו סבורים כי הגמול המוצע כאמור הינו סביר ביחס לגמול דירקטורים בהתאם לתקנות וביחס לחברות דומות בשוק',
    'תיקונים טכניים של התקנון והתאמתו לחוק החברות',
    'לאחר בחינת הצהרות הדירקטוריון לעניין חלוקת הדיבידנד, תוצאות החברה, בחינת יחסים פיננסים ותגובת השוק להכרזה על חלוקת הדיבידנד, אנו סבורים כי יש לאפשר את החלוקה האמורה.',
    'המינוי כאמור הינו בהתאם לתיקון פקודת השותפויות ובהתאם להוראותיו',
    'הגדלת ההון כאמור, נועדה לאפשר לחברה גמישות פיננסית ואפשרות ו/או יכולת של גיוס הון עתידית לחברה, כחלק מהסדר החוב של החברה ובמהלך עסקיה של החברה.',
    'בבחינת שכר טרחה בגין שירותים שאינם ביקורת נמצא כי אינו עולה על גובה שכר טרחה של ביקורת שנתיות, לרבות שירותי מס.',
    'דחייה טכנית למניעת מחיקת ני"ע מהמסחר',
    'אחר',
  ]

  let successCount = 0
  let errorCount = 0

  // Process each recommendation reason
  for (const content of recommendationReasons) {
    try {
      // Check if the recommendation reason already exists
      const existingReasons = await payload.find({
        collection: 'recommendation-reasons',
        where: {
          content: {
            equals: content,
          },
        },
        limit: 1,
      })

      if (existingReasons.docs.length > 0) {
        console.log(`✓ Recommendation reason already exists: "${content.substring(0, 30)}..."`)
        successCount++
        continue
      }

      // Create the recommendation reason
      await payload.create({
        collection: 'recommendation-reasons',
        data: {
          content,
        },
      })

      successCount++
      console.log(`✓ Created recommendation reason: "${content.substring(0, 30)}..."`)
    } catch (error: any) {
      errorCount++
      console.error(
        `✗ Failed to create recommendation reason: "${content.substring(0, 30)}..."`,
        error.message,
      )
    }
  }

  // Print migration summary
  console.log('\nMigration Summary:')
  console.log(`✓ Successfully processed recommendation reasons: ${successCount}`)
  console.log(`✗ Failed migrations: ${errorCount}`)
  console.log(`Total processed: ${recommendationReasons.length}`)
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
  // This could delete all the recommendation reasons created by this migration
}
