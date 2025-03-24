import { mongooseAdapter } from '@payloadcms/db-mongodb'
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
import logger from './lib/logger'
import { gcsStorage } from '@payloadcms/storage-gcs'
import { Users } from './collections/Users'
import { Documents } from './collections/Documents'
import { Stocks } from './collections/stocks/Stocks'
import { Companies } from '@/collections/companies/Companies'
import { Accounts } from '@/collections/accounts/Accounts'
import { StockValues } from '@/collections/stocks/StockValues'
import { Meetings } from './collections/meetings/Meetings'
import { Holdings } from '@/collections/holdings/Holdings'
import { HoldingsFeed } from '@/collections/holdings/feeds/HoldingsFeed'
import { Roles } from '@shefing/authorization'
import { StocksFeed } from './collections/stocks/feeds/StocksFeed'

import MigrationFaults from './collections/migration/MigrationFaults'
import StockMigrationMapping from './collections/stocks/StockMigrationMapping'
/*import mongoose from 'mongoose';
mongoose.set('debug', true);*/
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  i18n: {
    supportedLanguages: { he, en },
  },
  admin: {
    dateFormat:"HH:mm dd/MM/yyyy",
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
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
  },
  collections: [Stocks, StockValues, Meetings, Users, Roles, Documents, MigrationFaults, Companies, Accounts, Holdings, StockMigrationMapping, StocksFeed, HoldingsFeed],
  globals: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  logger,
  plugins: [
    importExportPlugin({
      collections: ['stocks','meetings','companies'],
      overrideExportCollection: (collection) => {
        collection.admin.group = 'ניהול'
        collection.labels = {plural:'יצוא קבצים',singular:'יצוא קובץ'}
        collection.upload.staticDir = path.resolve(dirname, 'uploads')
        return collection
      },
      disableJobsQueue: true,
    }),
    payloadCloudPlugin(),
    // storage-adapter-placeholder
    addAccess({
      rolesCollection: 'roles', // name of the collection defining the roles
      permissionsField: 'permissions', // name of the field within the role collection
      excludedCollections: [], // enable to exclude some collections from permission control
    }),
    addAuthorsFields({
      excludedCollections: [], //array of collections names to exclude
      excludedGlobals: [], // array of globals names to exclude
      usernameField: 'name', //name field to use from Users collection, 'user' by default
    }),
    gcsStorage({
      collections: {
        documents: true,
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
