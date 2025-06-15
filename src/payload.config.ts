import { Args, mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { addAuthorsFields } from '@shefing/authors-info'
import { addAccess } from '@shefing/authorization'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { en } from '@payloadcms/translations/languages/en'
import { he } from '@payloadcms/translations/languages/he'
//Logging
import { gcsStorage } from '@payloadcms/storage-gcs'
import { Users } from './collections/Users'
import { Documents } from './collections/Documents'
import { RecommendationReasons } from './collections/meetings/RecommendationReasons'
import { Stocks } from './collections/stocks/Stocks'
import { Companies } from '@/collections/companies/Companies'
import { StockValues } from '@/collections/stocks/StockValues'
import { Meetings } from './collections/meetings/Meetings'
import { Holdings } from '@/collections/holdings/Holdings'
import { HoldingsFeed } from '@/collections/holdings/feeds/HoldingsFeed'
import { Roles } from '@shefing/authorization'
import { StocksFeed } from './collections/stocks/feeds/StocksFeed'
import { SilencedStocks } from '@/collections/silenced-stocks/SilencedStocks'
import { Votes } from '@/collections/votes/Votes'
import { ResearchDocument } from '@/collections/research-documents/ResearchDocument'
import { AdminNotifications } from '@/collections/admin-notifications/AdminNotifications'

import MigrationFaults from './collections/migration/MigrationFaults'
import StockMigrationMapping from './collections/stocks/StockMigrationMapping'
import { logger } from './lib/logger'
import { MeetingsFeed } from '@/collections/meetings/feeds/MeetingsFeed'
import { scheduleDailyTasks } from './tasks/scheduleDailyTasks'
import { checkNotificationsHandler } from '@/tasks/checkNotifications'
import { processMeetingStateHandler } from '@/tasks/processMeetingState'
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

if (process.env.MONGO_USE_TX !== 'true') {
  dbArgs.transactionOptions = false
}

export default buildConfig({
  i18n: {
    supportedLanguages: { he, en },
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
      defaultJobsCollection.admin.defaultColumns = ['taskSlug', 'updatedAt', 'taskStatus']
      defaultJobsCollection.admin.group = 'ניהול'
      defaultJobsCollection.labels = {
        plural: 'תהליכי מערכת',
        singular: 'תהליף מערכת',
      }
      return defaultJobsCollection
    },
    deleteJobOnComplete: false,
    tasks: [
      {
        slug: 'checkNotifications',
        handler: checkNotificationsHandler,
      },
      {
        slug: 'processMeetingState',
        handler: processMeetingStateHandler,
      },
    ],
    // autoRun can optionally be a function that receives payload as an argument
    autoRun: [
      {
        cron: '00 09 * * *', // every day at 22:40
        limit: 10, // limit jobs to process each run
        queue: 'daily', // name of the queue
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
      providers: ['/providers/CustomContext#CustomContextProvider'],
      graphics: {
        Logo: '/graphics/Logo',
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
        { label: '(GMT+3) Israel Standard Time', value: 'Asia/Jerusalem' },
      ],
      defaultTimezone: 'Asia/Jerusalem',
    },
  },

  collections: [
    Stocks,
    StockValues,
    Meetings,
    Companies,
    Users,
    Roles,
    Documents,
    RecommendationReasons,
    MigrationFaults,
    Holdings,
    StockMigrationMapping,
    StocksFeed,
    HoldingsFeed,
    MeetingsFeed,
    SilencedStocks,
    Votes,
    ResearchDocument,
    AdminNotifications,
  ],
  globals: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter(dbArgs as Args),
  logger: logger,
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
    addAccess({
      rolesCollection: 'roles',
      permissionsField: 'permissions',
      excludedCollections: [],
    }),
    addAuthorsFields({
      excludedCollections: [],
      excludedGlobals: [],
      usernameField: 'name',
    }),
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
  ],
})
