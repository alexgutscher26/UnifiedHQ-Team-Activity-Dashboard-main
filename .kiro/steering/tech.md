# Technology Stack

## Core Framework
- **Next.js 15** - React framework with App Router architecture
- **React 19** - Latest React with concurrent features
- **TypeScript 5.0** - Strict mode enabled, no `any` types allowed

## Build System & Package Management
- **Bun** - Primary package manager and runtime (preferred over npm/yarn)
- **ESLint** - Code quality with Next.js and Prettier integration
- **Prettier** - Code formatting with specific project configuration

## Database & ORM
- **PostgreSQL** - Primary database
- **Prisma 6.17** - Type-safe ORM with generated client in `src/generated/prisma`
- **Redis** - Caching and session storage

## Authentication & Security
- **Better Auth** - Modern authentication library with OAuth 2.0
- **Sentry** - Error monitoring and performance tracking
- **Rate limiting** - API protection against abuse

## UI & Styling
- **Tailwind CSS 4.1** - Utility-first styling with custom design system
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Component library (New York style variant)
- **Lucide React** - Icon library
- **CSS Variables** - Theme system with dark/light mode support

## Integrations
- **GitHub API** - Repository and activity data via Octokit
- **Slack API** - Team communication data
- **OpenAI/OpenRouter** - AI-powered summaries and insights

## Common Commands

### Development
```bash
bun dev              # Start development server
bun build            # Build for production  
bun start            # Start production server
bun lint             # Run ESLint
bun format           # Format code with Prettier
bun format:check     # Check code formatting
```

### Database
```bash
bun prisma migrate dev    # Run database migrations
bun prisma generate       # Generate Prisma client
bun prisma studio         # Open Prisma Studio
```

### Branch & Release Management
```bash
bun run branch:create     # Create new feature branch
bun run branch:cleanup    # Clean up merged branches
bun run release:create    # Create new release
bun run perf:monitor      # Monitor performance metrics
```

## Performance & Monitoring
- **Image Optimization** - WebP/AVIF formats with Next.js Image component
- **Caching Strategy** - Redis for API responses, database query optimization
- **Memory Leak Prevention** - Built-in monitoring and prevention utilities
- **WebSocket** - Real-time communication for live updates