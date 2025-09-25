import { Args, mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { addAuthorsFields } from '@shefing/authors-info'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { he } from '@payloadcms/translations/languages/he'
import { nodemailerAdapter, NodemailerAdapterArgs } from '@payloadcms/email-nodemailer'
//Logging
import { gcsStorage } from '@payloadcms/storage-gcs'
import { CollectionQuickFilterPlugin } from '@shefing/quickfilter'
import { Users } from './collections/Users'
import { Documents } from './collections/Documents'
import { RecommendationReasons } from './collections/meetings/RecommendationReasons'
import { Stocks } from './collections/stocks/Stocks'
import { Companies } from '@/collections/companies/Companies'
import { StockValues } from '@/collections/stocks/StockValues'
import { Meetings } from './collections/meetings/Meetings'
import { Holdings } from '@/collections/holdings/Holdings'
import { HoldingsFeed } from '@/collections/holdings/feeds/HoldingsFeed'
import { StocksFeed } from './collections/stocks/feeds/StocksFeed'
import { SilencedStocks } from '@/collections/silenced-stocks/SilencedStocks'
import { impersonatePlugin } from './plugins/impersonate'
import { Votes } from '@/collections/votes/Votes'
import { ResearchDocument } from '@/collections/research-documents/ResearchDocument'
import { AdminNotifications } from '@/collections/admin-notifications/AdminNotifications'
import { CompanyMeetingNotifications } from '@/collections/company-meeting-notifications/CompanyMeetingNotifications'
import DynamicFieldOverrides from '@shefing/field-type-component-override'
import MigrationFaults from './collections/migration/MigrationFaults'
import StockMigrationMapping from './collections/stocks/StockMigrationMapping'
import { logger } from './lib/logger'
import { MeetingsFeed } from '@/collections/meetings/feeds/MeetingsFeed'
import { scheduleDailyTasks } from './tasks/scheduleDailyTasks'
import { checkAdminNotificationsHandler } from '@/tasks/checkAdminNotifications'
import { processMeetingStateHandler } from '@/tasks/processMeetingState'
import { adminMailNotificationsHandler } from '@/tasks/adminMailNotifications'
import { processHoldingsChangeHandler } from '@/tasks/processHoldingsChange'
import { checkCompanyNotificationsHandler } from '@/tasks/checkCompanyNotifications'
import { sendCompanyMeetingNotificationsHandler } from '@/tasks/sendCompanyMeetingNotifications'
import { sendDailyMeetingNotificationsHandler } from '@/tasks/sendDailyMeetingNotifications'
import { openapi, swaggerUI } from 'payload-oapi'
import { handleImpersonationEnd, handleImpersonationStart } from './plugins/impersonate/hooks'
import { CollectionResetPreferencesPlugin } from '@shefing/reset-list-view'
import versionsPlugin from '@shefing/custom-version-view'
// import mongoose from 'mongoose';
// mongoose.set('debug', true);
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const isProduction = process.env.NODE_ENV === 'production'
const dbArgs: Args = {
  url: process.env.DATABASE_URI || '',
  ...(isProduction && {
    connectOptions: {
      readPreference: 'secondaryPreferred',
      autoIndex: false,
      autoCreate: false,
      maxPoolSize: 50,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
    },
  }),
}

const emailArgs: NodemailerAdapterArgs = process.env.SMTP_HOST
  ? {
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@emda.org.il',
      defaultFromName: process.env.EMAIL_FROM_NAME || 'EMDA System',
    }
  : ({} as NodemailerAdapterArgs)

if (process.env.MONGO_USE_TX !== 'true') {
  dbArgs.transactionOptions = false
}

export default buildConfig({
  debug: process.env.NODE_ENV === 'development',
  serverURL:
    process.env.PUBLIC_SERVER_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''),
  i18n: {
    supportedLanguages: { he },
    translations: {
      he: {
        // or any other locale you're using
        authentication: {
          youAreReceivingResetPassword:
            ':קיבלת הודעה זו מכיוון שאתה ביקשת לאפס את הסיסמה שלך במערכת. אנא לחץ על הקישור כדי להשלים את התהליך',
          youDidNotRequestPassword:
            '<br><br>אם לא ביקשת זאת, פנה למנהל המערכת עמדה מיידית<br><br>מערכת עמדה',
          resetYourPassword: 'איפוס סיסמה',
        },
        general: {
          successfullyCreated: 'אובייקט ה{{label}} נוצר בהצלחה.',
        },
      },
    },
  },
  onInit: async (payload) => {
    // Schedule daily tasks when payload initializes
    await scheduleDailyTasks(payload)
  },
  jobs: {
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {}
      }
      defaultJobsCollection.admin.hidden = false
      defaultJobsCollection.admin.defaultColumns = ['taskSlug', 'queue', 'updatedAt', 'taskStatus']
      defaultJobsCollection.custom = {
        filterList: [['updatedAt', 'createdAt', 'taskSlug', 'taskStatus']],
      }
      defaultJobsCollection.admin.group = 'ניהול'
      defaultJobsCollection.labels = {
        plural: 'תהליכי מערכת',
        singular: 'תהליך מערכת',
      }
      return defaultJobsCollection
    },
    deleteJobOnComplete: false,
    tasks: [
      {
        slug: 'checkAdminNotifications',
        handler: checkAdminNotificationsHandler,
      },
      {
        slug: 'processMeetingState',
        handler: processMeetingStateHandler,
      },
      {
        slug: 'adminMailNotifications',
        handler: adminMailNotificationsHandler,
      },
      {
        slug: 'processHoldingsChange',
        handler: processHoldingsChangeHandler,
        inputSchema: [{ name: 'holdingId', type: 'text', label: 'מזהה החזקה' }],
      },
      {
        slug: 'checkCompanyNotifications',
        handler: checkCompanyNotificationsHandler,
      },
      {
        slug: 'sendCompanyMeetingNotifications',
        handler: sendCompanyMeetingNotificationsHandler,
      },
      {
        slug: 'sendDailyMeetingNotifications',
        handler: sendDailyMeetingNotificationsHandler,
        inputSchema: [
          {
            name: 'agendaUpdatedMeetingIds',
            type: 'array',
            label: 'מזהי אסיפות עם עדכוני סדר יום',
            fields: [
              {
                name: 'id',
                type: 'text',
                label: 'מזהה אסיפה',
              },
            ],
          },
        ],
      },
    ],
    // autoRun can optionally be a function that receives payload as an argument
    autoRun: process.env.NOJOBS
      ? []
      : [
          {
            cron: '00 19 * * *', // every day at 19:00
            limit: 10, // limit jobs to process each run
            queue: 'daily07pm', // name of the queue
          },
          {
            cron: '00 22 * * *', // every day at 22:00
            limit: 10, // limit jobs to process each run
            queue: 'daily10pm', // name of the queue
          },
          {
            cron: '00 08 * * *', // every day at 08:00
            limit: 10, // limit jobs to process each run
            queue: 'daily08am', // name of the queue
          },
          {
            cron: '*/30 * * * *', // every 30 minutes
            limit: 100, // limit jobs to process each run
            queue: 'holdings', // name of the queue
          },
          {
            cron: '*/02 * * * *', // every 1 minutes
            limit: 100, // limit jobs to process each run
            queue: 'now', // name of the queue
          },
          // add as many cron jobs as you want
        ],
  },
  admin: {
    dateFormat: 'HH:mm dd/MM/yyyy',
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },

    components: {
      afterLogin: ['/admincomponents/auth/LoginCaptcha'],
      providers: ['/providers/CustomContext#CustomContextProvider'],
      graphics: {
        Logo: '/graphics/Logo',
      },
      Nav: '@shefing/quickfilter/nav',
      views: {
        CustomView: {
          Component: '/admincomponents/custom-views/VotePage',
          path: '/grouped-votes',
        },
        dashboard: {
          Component: '@shefing/quickfilter/Dashboard',
        },
      },
    },
    meta: {
      title: 'עמדה',
      titleSuffix: '- ניהול',
      icons: [
        {
          rel: 'icon',
          type: 'image/png',
          url: '/favicon.png',
        },
      ],
    },
    timezones: {
      supportedTimezones: ({ defaultTimezones }) => [
        ...defaultTimezones,
        { label: 'Israel Standard Time', value: 'Asia/Jerusalem' },
      ],
      defaultTimezone: 'Asia/Jerusalem',
    },
  },

  collections: [
    // פעילות
    AdminNotifications,
    Meetings,
    Stocks,
    Holdings,
    // ניהול
    Companies,
    Users,
    StocksFeed,
    MeetingsFeed,
    RecommendationReasons,
    // תחזוקה
    CompanyMeetingNotifications,
    Votes,
    HoldingsFeed,
    // מסמכים
    ResearchDocument,
    Documents,
    // פיתוח
    SilencedStocks,
    StockMigrationMapping,
    MigrationFaults,
    // Hidden collections
    StockValues,
  ],

  globals: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter(dbArgs as Args),
  logger: logger as any,
  email: nodemailerAdapter(emailArgs),
  plugins: [
    importExportPlugin({
      collections: ['stocks', 'meetings'],
      overrideExportCollection: (collection) => {
        collection.admin.group = 'ניהול'
        collection.labels = { plural: 'יצוא קבצים', singular: 'יצוא קובץ' }
        collection.upload.staticDir = path.resolve(dirname, 'uploads')
        return collection
      },
      disableJobsQueue: true,
    }),
    payloadCloudPlugin(),
    DynamicFieldOverrides({
      overrides: [
        {
          fieldTypes: ['checkbox'],
          overrides: {
            admin: {
              components: {
                Cell: '/admincomponents/cell/YesNoCell',
              },
            },
          },
        },
        {
          fieldTypes: ['select'],
          overrides: {
            admin: {
              components: {
                Cell: '/admincomponents/cell/TruncatedSelectCell',
              },
            },
          },
        },
        {
          fieldTypes: ['date'],
          overrides: {
            admin: {
              components: {
                Cell: '/admincomponents/cell/TruncatedDateCell',
              },
            },
          },
        },
        {
          fieldTypes: ['text'],
          overrides: {
            admin: {
              components: {
                Cell: '/admincomponents/cell/TruncatedCell',
              },
            },
          },
        },
      ],
      excludedCollections: [],
    }),

    openapi({ openapiVersion: '3.0', metadata: { title: 'Dev API', version: '0.0.1' } }),
    swaggerUI({}),
    addAuthorsFields({
      excludedCollections: [],
      excludedGlobals: [],
      usernameField: 'name',
    }),
    CollectionQuickFilterPlugin({}),
    gcsStorage({
      collections: {
        documents: true,
        'research-documents': true,
        'holdings-feed': true,
        'meetings-feed': true,
        'stocks-feed': true,
      },
      enabled: !!process.env.GCS_BUCKET,
      bucket: process.env.GCS_BUCKET || '',
      options: {
        apiEndpoint: process.env.GCS_ENDPOINT,
        projectId: process.env.GCS_PROJECT_ID,
      },
    }),
    impersonatePlugin({
      enabled: true,
      authCollection: 'users',
      onImpersonate: async ({ req, impersonateUserId }) => {
        await handleImpersonationStart({ req, impersonateUserId: impersonateUserId as string })
      },
      onUnImpersonate: async ({ req, originalUserId }) => {
        await handleImpersonationEnd({ req, originalUserId: originalUserId as string })
      },
    }),
    CollectionResetPreferencesPlugin({
      // Plugin options here
    }),
    versionsPlugin({}),
  ],
})
