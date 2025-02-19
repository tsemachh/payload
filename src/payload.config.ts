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

import { Users } from './collections/Users'
import { Document } from './collections/Document'
import { Stocks } from '@/collections/stocks/Stocks'
import { StockValues } from '@/collections/stocks/StockValues'
import { Meetings } from './collections/meetings/Meetings'
import { Roles } from '@shefing/authorization'

import MigrationFaults   from '@/collections/migration/MigrationFaults'
/*import mongoose from 'mongoose';
mongoose.set('debug', true);*/

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)


export default buildConfig({
  i18n: {
    supportedLanguages: { en, he },
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Stocks,StockValues, Meetings, Users, Roles,Document,MigrationFaults],
  globals: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
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
