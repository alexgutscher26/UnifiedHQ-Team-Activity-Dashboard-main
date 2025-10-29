# Project Structure & Organization

## Root Directory Structure
```
├── src/                    # Source code
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── docs/                   # Documentation
├── scripts/                # Automation scripts
├── .kiro/                  # Kiro configuration and steering
└── .github/                # GitHub workflows and templates
```

## Source Code Organization (`src/`)

### App Router Structure (`src/app/`)
- **Next.js 15 App Router** - File-based routing system
- **API Routes** - `/api/*` for backend endpoints
- **Page Components** - Route-specific UI components
- **Layout Components** - Shared layouts and templates

Key directories:
- `api/` - Backend API endpoints and integrations
- `dashboard/` - Main dashboard pages
- `auth/` - Authentication pages
- `integrations/` - Integration setup pages
- `settings/` - User settings and preferences

### Component Architecture (`src/components/`)
- **UI Components** - `ui/` folder contains shadcn/ui components
- **Feature Components** - Domain-specific components
- **Accessibility** - Components prefixed with `accessible-*`
- **Performance** - Optimized components for memory and scroll performance

### Library Structure (`src/lib/`)
- **Integrations** - `integrations/` folder for external API services
- **Authentication** - Auth utilities and configuration
- **Database** - Prisma client and database utilities
- **Services** - Business logic and data processing
- **Utilities** - Helper functions and shared utilities

### Type Definitions (`src/types/`)
- **Component Types** - UI component prop definitions
- **API Types** - Request/response interfaces
- **Database Types** - Prisma-generated types in `src/generated/`

## Database Schema (`prisma/`)
- **schema.prisma** - Main database schema
- **migrations/** - Database migration files
- **Generated Client** - Output to `src/generated/prisma/`

## Key Architectural Patterns

### File Naming Conventions
- **kebab-case** for files and directories
- **PascalCase** for React components
- **camelCase** for functions and variables
- **SCREAMING_SNAKE_CASE** for constants

### Component Organization
- One component per file
- Co-locate related components in feature folders
- Separate UI components from business logic
- Use TypeScript interfaces for all props

### API Structure
- RESTful endpoints under `/api/`
- Consistent error handling with middleware
- Rate limiting and validation on all endpoints
- Separate integration logic in `src/lib/integrations/`

### Import Patterns
- Use path aliases: `@/components`, `@/lib`, `@/hooks`
- Absolute imports preferred over relative imports
- Group imports: external libraries, internal modules, relative imports

### State Management
- React Context for global state
- Custom hooks for component logic
- Server state managed by API calls
- Local state with useState/useReducer

## Configuration Files
- **TypeScript** - `tsconfig.json` with strict mode
- **Tailwind** - `tailwind.config.ts` with custom design system
- **Prettier** - `.prettierrc` with project-specific formatting
- **ESLint** - `eslint.config.js` with Next.js and Prettier integration
- **Components** - `components.json` for shadcn/ui configuration