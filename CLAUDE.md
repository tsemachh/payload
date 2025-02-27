# CLAUDE.md - Code Guidelines for emda-dev

## Build/Run/Lint Commands
```
pnpm dev                # Start development server with init-fetch script
pnpm devturbo           # Development server with type generation (faster)
pnpm build              # Lint and build for production
pnpm lint               # Run eslint
pnpm generate:types     # Generate TypeScript definitions
pnpm payload            # Run Payload CMS commands
```

## Code Style Guidelines
- **Formatting**: Single quotes, trailing commas, no semicolons, 100 char line width
- **Imports**: Use absolute paths with aliases (@/components/*) defined in tsconfig
- **Components**: Use functional components with TypeScript types
- **Styling**: Tailwind CSS with class-variance-authority for variants
- **Error Handling**: Add type safety with proper error handling in async functions
- **State Management**: React hooks, context for shared state
- **TypeScript**: Strict mode enabled, avoid `any` types when possible
- **Naming**: PascalCase for components/types, camelCase for variables/functions

## Structure
- Frontend code in src/app/(frontend)
- UI components in src/app/(frontend)/components/ui
- Payload CMS in src/app/(payload)