import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { addAuthorsFields } from '@shefing/authors-info'
import { addAccess } from '@shefing/authorization'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { en } from '@payloadcms/translations/languages/en'
import { he } from '@payloadcms/translations/languages/he'
//Logging
import pino from 'pino'
import logtailTransport from '@logtail/pino' // Direct ES Module import
import os from 'os'

import { Users } from './collections/Users'
import { Document } from './collections/Document'
import { Stocks } from '@/collections/stocks/Stocks'
import { StockValues } from '@/collections/stocks/StockValues'
import { Meetings } from './collections/meetings/Meetings'
import { Roles } from '@shefing/authorization'

import MigrationFaults from '@/collections/migration/MigrationFaults'
/*import mongoose from 'mongoose';
mongoose.set('debug', true);*/
const transport = await logtailTransport({
  sourceToken: process.env.LOGTAIL_SOURCE_TOKEN || 'B5p5aFX1cPDdGdzaKHFu1Vss',
  options: {
    endpoint: process.env.LOGTAIL_ENDPOINT || 'https://s1214463.eu-nbg-2.betterstackdata.com',
  },
})
let username
try {
  username = os.userInfo().username
} catch (error) {
  username = process.env.USER || process.env.USERNAME || 'unknown'
}
const logger = pino(
  {
    base: {
      user: username,
      hostname: os.hostname(), // Adds the computer name to every log
      env: process.env.NODE_ENV || 'development', // Optionally include NODE_ENV
    },
    level: 'info',
  },
  transport,
)

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
  collections: [Stocks, StockValues, Meetings, Users, Roles, Document, MigrationFaults],
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
  ],
})
