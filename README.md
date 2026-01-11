# EMDA - Corporate Governance & Voting System

A comprehensive corporate governance platform built with Next.js and Payload CMS for managing company meetings, voting processes, and holdings tracking with Hebrew RTL support.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Available Commands](#available-commands)
- [Key Features](#key-features)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

## Architecture Overview

This application follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│         Frontend (Next.js 15 + React 19)        │
│  /src/app/(frontend) - Pages, Components, UI    │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│          Next.js API Routes & Middleware        │
│     Authentication, Route Guards, Proxies       │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│        Payload CMS 3 (Backend & Admin)          │
│  /src/collections - Data Models & Business Logic│
│  /src/plugins - Custom Functionality            │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│              MongoDB Database                    │
│     Collections, Indexes, Transactions          │
└─────────────────────────────────────────────────┘
```

### Core Components

**Frontend Layer**
- Next.js App Router with server and client components
- React 19 with Context API for state management
- Radix UI components with Tailwind CSS styling
- SWR for client-side data fetching and caching
- Multi-theme support (light, dark, blue, red, purple, green, pink)

**Backend Layer**
- Payload CMS 3 with 17 primary collections
- Custom REST endpoints for business logic
- Collection hooks for data validation and processing
- Background jobs via Payload Jobs API
- GraphQL API with playground

**Data Layer**
- MongoDB with Mongoose adapter
- Audit logging for compliance
- Transaction support for data integrity
- Optimized read preferences for production

## Tech Stack

### Core Framework
- **Next.js 15.4.8** - React framework with App Router
- **React 19.2.1** - UI library
- **Payload CMS 3.67.0** - Headless CMS and admin panel
- **TypeScript 5.7.3** - Type safety

### Database & Storage
- **MongoDB 6.13.0** - Primary database
- **Google Cloud Storage** - Document and media storage via `@payloadcms/storage-gcs`

### UI & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives (24+ components)
- **Lucide React** - Icon library
- **Framer Motion** - Animation library
- **class-variance-authority** - Component variant management

### Data Management
- **TanStack React Table** - Advanced data tables
- **React Hook Form** - Form state management
- **SWR** - Data fetching and caching
- **date-fns** - Date manipulation

### Authentication & Security
- **NextAuth.js 4.24.11** - Authentication framework
- **Speakeasy** - Two-factor authentication (TOTP)
- **Next Turnstile** - CAPTCHA integration

### Document Processing
- **ExcelJS** - Excel generation
- **jsPDF** - PDF generation
- **xlsx** - Excel parsing

### Email & Logging
- **Nodemailer** - Email delivery
- **Pino** - High-performance logging
- **Logtail** - Centralized log management

### Developer Tools
- **pnpm 10.16.1** - Package manager
- **ESLint** - Code linting
- **Prettier** - Code formatting

### Custom Plugins
- `@shefing/quickfilter` - Fast list filtering
- `@shefing/authors-info` - Track content authors
- `@shefing/custom-version-view` - Version history UI
- `@shefing/field-type-component-override` - Dynamic field customization
- `@shefing/reset-list-view` - Clear saved preferences

## Project Structure

```
emda-dev/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # Frontend application
│   │   │   ├── account/         # User account management
│   │   │   ├── auth/            # Authentication pages (signin, recovery)
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── holdings/        # Holdings management
│   │   │   ├── meetings/        # Meetings listing
│   │   │   ├── vote-meeting/    # Voting interface
│   │   │   ├── components/      # Reusable UI components
│   │   │   │   └── ui/          # Base UI components (Radix + custom)
│   │   │   ├── contexts/        # React contexts (Auth, Companies, Errors)
│   │   │   └── helpers/         # Frontend utilities
│   │   ├── (payload)/           # Payload CMS admin panel
│   │   └── api/                 # Next.js API routes
│   ├── collections/             # Payload collections (data models)
│   │   ├── Users.ts             # User management with 2FA
│   │   ├── companies/           # Company hierarchy
│   │   ├── meetings/            # Meeting and voting
│   │   ├── stocks/              # Stock information
│   │   ├── holdings/            # Fund holdings
│   │   ├── votes/               # Vote tracking
│   │   ├── research-documents/  # Research documents
│   │   ├── audit-logs/          # Audit trail
│   │   └── [collection]/endpoints/  # Custom REST endpoints
│   ├── lib/                     # Shared libraries
│   │   ├── logger.ts            # Logging setup
│   │   ├── pdf-generator.ts    # PDF utilities
│   │   └── excel-generator.ts  # Excel utilities
│   ├── utils/                   # Helper functions
│   ├── plugins/                 # Custom Payload plugins
│   │   └── impersonate/        # Admin impersonation plugin
│   ├── tasks/                   # Background job handlers
│   ├── migrations/              # Database migrations
│   ├── middleware.ts            # Next.js middleware
│   └── payload.config.ts        # Payload CMS configuration
├── public/                      # Static assets
├── scripts/                     # Build and utility scripts
├── .env                         # Environment variables (not in repo)
├── next.config.mjs              # Next.js configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
└── CLAUDE.md                    # Code style guidelines

```

## Prerequisites

Before setting up the development environment, ensure you have:

- **Node.js**: Version 18.20.2+ or 20.9.0+
- **pnpm**: Version 9 or 10 (package manager)
- **MongoDB**: Local instance or MongoDB Atlas connection
- **Git**: For version control

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd emda-dev
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URI=mongodb://localhost:27017/emda
MONGO_USE_TX=true

# Server
NODE_ENV=development
PUBLIC_SERVER_URL=http://localhost:3000

# Payload CMS
PAYLOAD_SECRET=your-secret-key-here

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM_ADDRESS=noreply@emda.org.il
EMAIL_FROM_NAME=EMDA System

# Google Cloud Storage (optional)
GCS_BUCKET=your-bucket-name
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILENAME=/path/to/key.json

# Logging (optional)
LOGTAIL_SOURCE_TOKEN=your-logtail-token

# Jobs (for background tasks)
JOB_LEADER=true

# App Versioning
APP_VERSION=dev
BUILD_TIME=local
```

### 4. Generate TypeScript Types

Generate TypeScript definitions from Payload collections:

```bash
pnpm generate:types
```

### 5. Run Database Migrations

Apply database migrations to set up the schema:

```bash
pnpm migrate
```

### 6. Start Development Server

```bash
# Standard development mode
pnpm dev

# Development with Turbopack (faster)
pnpm devturbo

# Safe mode (clears .next directory first)
pnpm devsafe
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **GraphQL Playground**: http://localhost:3000/api/graphql-playground

### 7. Create Admin User

On first run, Payload will prompt you to create an admin user. You can also create one via:

```bash
pnpm payload create-first-user
```

## Available Commands

### Development
```bash
pnpm dev                # Start dev server with init-fetch script
pnpm devturbo           # Start dev server with Turbopack (faster)
pnpm devsafe            # Clear .next and start dev server
pnpm devg               # Generate types + importmap, then start with Turbopack
```

### Building
```bash
pnpm build              # Lint and build for production
pnpm start              # Start production server
```

### Code Quality
```bash
pnpm lint               # Run ESLint
pnpm lint:fix           # Run ESLint with auto-fix
pnpm format:check       # Check code formatting with Prettier
```

### Payload CMS
```bash
pnpm payload            # Run Payload CLI commands
pnpm generate:types     # Generate TypeScript types from collections
pnpm generate:importmap # Generate import map
```

### Database
```bash
pnpm migrate            # Run database migrations
pnpm migrated           # Run migrations with increased memory
```

### Utilities
```bash
pnpm reinstall          # Clean reinstall of dependencies
```

## Key Features

### Authentication & Security
- **Two-Factor Authentication (2FA)**: TOTP-based with backup codes
- **Role-Based Access Control**: Admin and regular user roles
- **Admin Impersonation**: Admins can view the system as other users
- **Audit Logging**: Complete audit trail of all data changes
- **IP-based Access Control**: Optional IP validation

### Meeting Management
- **Meeting Lifecycle**: Draft → Open → Closed → Archived states
- **Voting System**: Track votes across companies and holdings
- **Notification System**: Email alerts for meetings and deadlines
- **Research Documents**: Attach and manage research materials
- **Excel Exports**: Export meeting data and participation reports

### Data Management
- **Company Hierarchy**: Parent/child company relationships
- **Holdings Tracking**: Historical fund holdings with date calculations
- **Stock Information**: Stock data with automated feeds
- **Bulk Operations**: CSV import/export capabilities

### Background Jobs
- Meeting state transitions
- Notification dispatch (admin, company, daily digests)
- Holdings change processing
- Automated data checks

### Internationalization
- **Hebrew RTL Support**: Full right-to-left layout
- Hebrew admin interface
- Localized date and number formatting

### Developer Experience
- Hot module replacement in development
- TypeScript strict mode
- Path aliases for clean imports (@/components/*, @/collections/*, etc.)
- Source maps in production for debugging
- Comprehensive error handling

## Testing

This project uses Vitest for unit and component testing, and Playwright for End-to-End (E2E) testing.

For detailed information, see the [Testing Guide](tests/README.md).

```bash
# Run unit and component tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## Environment Variables

### Required Variables
- `DATABASE_URI` - MongoDB connection string
- `PAYLOAD_SECRET` - Secret key for Payload CMS (minimum 32 characters)
- `PUBLIC_SERVER_URL` - Public URL of the application

### Optional Variables
- `NODE_ENV` - Environment (development/production)
- `SMTP_*` - Email configuration for notifications
- `GCS_*` - Google Cloud Storage configuration
- `LOGTAIL_SOURCE_TOKEN` - Centralized logging
- `JOB_LEADER` - Enable background job processing
- `MONGO_USE_TX` - Enable MongoDB transactions
- `APP_VERSION` - Application version for cache busting
- `BUILD_TIME` - Build timestamp

## Code Style Guidelines

See [CLAUDE.md](./CLAUDE.md) for detailed code style guidelines including:
- Single quotes, trailing commas, no semicolons
- 100 character line width
- Absolute imports with path aliases
- Functional components with TypeScript
- Tailwind CSS for styling
- Proper error handling in async functions

## Database

- **Type**: MongoDB
- **Adapter**: Mongoose
- **Storage**: Google Cloud Storage (GCS) for media files

## Support & Documentation

- **Payload CMS Docs**: https://payloadcms.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Project Issues**: Report bugs and request features via your issue tracker

---

Built with ❤️ using Next.js and Payload CMS
