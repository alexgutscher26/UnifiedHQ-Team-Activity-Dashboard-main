# UnifiedHQ - Team Activity Dashboard

<div align="center">
  <img src="public/placeholder-logo.svg" alt="UnifiedHQ Logo" width="120" height="120">
  
  **One dashboard to see everything your team did today**
  
  Connect Slack, GitHub, and more — get a unified feed and daily AI summary.
  
  [![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-6.17.1-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.14-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
  [![Bun](https://img.shields.io/badge/Bun-Latest-000000?style=flat-square&logo=bun)](https://bun.sh/)
  [![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
</div>

## 🌟 Overview

UnifiedHQ is a comprehensive team activity dashboard that aggregates data from multiple sources (GitHub, Slack, and more) to provide teams with a unified view of their daily activities. Powered by AI, it generates intelligent summaries and insights to help teams stay informed and productive.

### ✨ Key Benefits

- **🎯 Centralized Visibility**: See all team activities in one place
- **🤖 AI-Powered Insights**: Get intelligent summaries and productivity trends
- **⚡ Real-time Updates**: Live activity feeds with instant notifications
- **🔒 Enterprise Security**: OAuth integration with secure session management
- **📱 Responsive Design**: Works seamlessly across all devices
- **🎨 Modern UI**: Beautiful dark/light theme with accessibility support

## 🚀 Features

### 🔗 **Integrations**
- **GitHub** - Track commits, pull requests, issues, and repository activity
- **Slack** - Monitor messages, channels, and team communications
- **Coming Soon** - Microsoft Teams, Google Workspace, Jira, Trello, Discord, Linear, Asana

### 🤖 **AI-Powered Insights**
- **Daily Summaries** - Automated daily team activity summaries
- **Smart Categorization** - Intelligent activity classification and filtering
- **Productivity Analytics** - Trends, patterns, and performance insights
- **Predictive Notifications** - Smart alerts based on team behavior
- **Custom Insights** - Personalized recommendations and suggestions

### 📊 **Dashboard & Analytics**
- **Real-time Activity Feed** - Live updates with WebSocket connections
- **Customizable Views** - Select repositories, channels, and time ranges
- **Team Statistics** - Comprehensive team performance metrics
- **Historical Data** - Track progress over time with detailed analytics
- **Export Capabilities** - Download reports and data for external analysis

### 🔐 **Security & Compliance**
- **OAuth 2.0 Authentication** - Secure integration with GitHub and Slack
- **Session Management** - Advanced session security with IP tracking
- **Rate Limiting** - API protection against abuse and DDoS attacks
- **Data Encryption** - End-to-end encryption for sensitive data
- **GDPR Compliance** - Privacy controls and data protection measures
- **Audit Logging** - Comprehensive activity tracking and monitoring

### 🎨 **User Experience**
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Dark/Light Themes** - Automatic theme switching with user preferences
- **Accessibility** - WCAG 2.1 AA compliant with screen reader support
- **Performance Optimized** - Fast loading with image optimization and caching
- **Intuitive Navigation** - Clean, modern interface with easy-to-use controls

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript 5.0** - Type-safe development
- **Tailwind CSS 4.1** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Smooth animations and transitions

### **Backend & Database**
- **PostgreSQL** - Robust relational database
- **Prisma 6.17** - Type-safe database ORM
- **Better Auth** - Modern authentication library
- **Redis** - Caching and session storage
- **WebSocket** - Real-time communication

### **Integrations & Services**
- **GitHub API** - Repository and activity data
- **Slack API** - Team communication data
- **OpenAI API** - AI-powered summaries and insights
- **Sentry** - Error monitoring and performance tracking

### **Development & Deployment**
- **Bun** - Fast package manager and runtime
- **Vercel** - Deployment and hosting platform
- **ESLint & Prettier** - Code quality and formatting
- **Playwright** - End-to-end testing
- **GitHub Actions** - CI/CD pipeline

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** or **Bun** (recommended)
- **PostgreSQL 14+** database
- **GitHub OAuth App** for authentication
- **Slack App** for team integration (optional)
- **OpenAI API Key** for AI features (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/unifiedhq.git
   cd unifiedhq
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/unifiedhq"
   
   # Authentication
   BETTER_AUTH_SECRET="your-secret-key-here"
   BETTER_AUTH_URL="http://localhost:3000"
   
   # GitHub OAuth
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   
   # Slack Integration
   SLACK_CLIENT_ID="your-slack-client-id"
   SLACK_CLIENT_SECRET="your-slack-client-secret"
   
   # AI Services
   OPENAI_API_KEY="your-openai-api-key"
   OPENROUTER_API_KEY="your-openrouter-api-key"
    
   # Security
   ENCRYPTION_KEY="your-32-character-encryption-key"
   CRON_SECRET_TOKEN="your-cron-secret-token"
   ```

4. **Set up the database**
   ```bash
   bun prisma migrate dev
   bun prisma generate
   ```

5. **Start the development server**
   ```bash
   bun dev
   # or
   bun run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Documentation

### **Setup Guides**
- [GitHub Integration Setup](docs/GITHUB_INTEGRATION_SETUP.md) - Connect GitHub repositories
- [Slack Integration Setup](docs/SLACK_INTEGRATION_SETUP.md) - Connect Slack workspace
- [AI Summary Setup](docs/AI_SUMMARY_SETUP.md) - Configure AI-powered summaries

### **Development**
- [Performance Optimizations](docs/PERFORMANCE_OPTIMIZATIONS.md) - Performance best practices
- [Accessibility Implementation](docs/ACCESSIBILITY_IMPLEMENTATION.md) - Accessibility guidelines
- [Component Styling Standards](docs/COMPONENT_STYLING_STANDARDS.md) - UI/UX guidelines
- [Git Workflow Guide](docs/GIT_WORKFLOW_QUICK_START.md) - Development workflow

### **Security & Compliance**
- [Security Policy](SECURITY.md) - Security policies and procedures
- [Security Documentation](docs/SECURITY.md) - Technical security implementation
- [Security Best Practices](docs/SECURITY_BEST_PRACTICES.md) - Development security guidelines
- [Incident Response Plan](docs/INCIDENT_RESPONSE.md) - Security incident procedures

### **Operations**
- [GitHub Caching](docs/GITHUB_CACHING.md) - API caching implementation
- [Retry Mechanisms](docs/RETRY_MECHANISMS.md) - Error handling and retry logic
- [Image Optimization](docs/IMAGE_OPTIMIZATION.md) - WebP and image optimization
- [Scroll Optimization](docs/SCROLL_OPTIMIZATION.md) - Performance optimizations

## 🎯 Project Status

### **Overall Progress**: ~75% Complete

| Feature | Status | Progress | Notes |
|---------|--------|----------|-------|
| **GitHub Integration** | ✅ Complete | 100% | Full OAuth, caching, and activity tracking |
| **Slack Integration** | ✅ Complete | 100% | Complete workspace and channel integration |
| **Authentication** | ✅ Complete | 100% | Better Auth with OAuth 2.0 and session management |
| **UI/UX** | ✅ Complete | 95% | Modern design with accessibility support |
| **AI Features** | 🚧 In Progress | 60% | Daily summaries implemented, more features planned |
| **Security** | ✅ Complete | 95% | Comprehensive security implementation |
| **Performance** | ✅ Complete | 90% | Optimized with caching and monitoring |
| **Documentation** | ✅ Complete | 85% | Comprehensive docs and guides |

### **Recent Updates**
- ✅ **Team Activity Dashboard** - Complete implementation with real-time updates
- ✅ **GitHub Caching System** - Advanced caching for improved performance
- ✅ **Security Framework** - Comprehensive security policies and procedures
- ✅ **Error Handling** - Robust error handling with retry mechanisms
- ✅ **Accessibility** - WCAG 2.1 AA compliance implementation

## 🛠️ Available Scripts

### **Development**
```bash
bun dev              # Start development server
bun build            # Build for production
bun start            # Start production server
bun lint             # Run ESLint
bun format           # Format code with Prettier
bun format:check     # Check code formatting
```

### **Database**
```bash
bun prisma migrate dev    # Run database migrations
bun prisma generate       # Generate Prisma client
bun prisma studio         # Open Prisma Studio
bun prisma db seed        # Seed database with sample data
```

### **Branch Management**
```bash
bun run branch:create     # Create new feature branch
bun run branch:list       # List all branches
bun run branch:cleanup    # Clean up merged branches
bun run branch:health     # Check branch health
bun run branch:validate   # Validate branch structure
```

### **Release Management**
```bash
bun run release:create    # Create new release
bun run release:bump      # Bump version number
bun run release:changelog # Generate changelog
bun run release:notes     # Generate release notes
bun run release:tag       # Create release tag
```

### **Performance & Monitoring**
```bash
bun run perf:monitor      # Monitor performance metrics
bun run perf:analyze      # Analyze performance data
bun run perf:compare      # Compare performance metrics
bun run review:check      # Run comprehensive code review
bun run review:analyze    # Analyze code quality
```

### **AI & Analytics**
```bash
bun run ai-summary:setup  # Setup AI summary system
bun run ai-summary:test   # Test AI summary functionality
```

## 🏗️ Architecture

### **Project Structure**
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes and endpoints
│   │   ├── auth/          # Authentication endpoints
│   │   ├── integrations/  # Third-party integrations
│   │   ├── ai-summary/    # AI-powered features
│   │   └── ...           # Other API routes
│   ├── dashboard/         # Main dashboard pages
│   ├── auth/             # Authentication pages
│   └── ...               # Other pages
├── components/            # React components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   ├── forms/            # Form components
│   ├── charts/           # Data visualization components
│   └── ...               # Feature-specific components
├── lib/                  # Utility libraries
│   ├── integrations/    # Integration services (GitHub, Slack)
│   ├── auth/            # Authentication utilities
│   ├── db/              # Database utilities
│   └── ...              # Other utilities
├── hooks/               # Custom React hooks
├── contexts/            # React contexts
├── types/               # TypeScript type definitions
└── styles/              # Global styles and CSS
```

### **Key Components**

#### **Authentication System**
- **Better Auth** with OAuth 2.0 providers
- **Session management** with secure cookies
- **Role-based access control** (RBAC)
- **Multi-factor authentication** support

#### **Integration Layer**
- **GitHub Integration** - Repository and activity tracking
- **Slack Integration** - Team communication monitoring
- **Caching System** - Redis-based API response caching
- **Rate Limiting** - Protection against API abuse

#### **AI & Analytics**
- **OpenAI Integration** - AI-powered summaries and insights
- **Sentry Monitoring** - Error tracking and performance monitoring
- **Custom Analytics** - Team productivity metrics

#### **Database Schema**
- **User Management** - Authentication and preferences
- **Integration Data** - GitHub and Slack connection data
- **Activity Tracking** - Team activity and engagement data
- **AI Summaries** - Generated insights and recommendations
- **Caching Tables** - Performance optimization data

## 🔧 Configuration

### **Environment Variables**

#### **Required Variables**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/unifiedhq"
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"
```

#### **GitHub Integration**
```env
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### **Slack Integration**
```env
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
```

#### **AI Services**
```env
OPENAI_API_KEY="your-openai-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

### **Database Configuration**

#### **Prisma Schema**
The project uses Prisma ORM with PostgreSQL. Key models include:
- **User** - User accounts and preferences
- **Connection** - OAuth connections to external services
- **Activity** - Team activity data
- **AISummary** - AI-generated insights
- **GitHubCache/SlackCache** - API response caching

#### **Migrations**
```bash
# Create a new migration
bun prisma migrate dev --name your-migration-name

# Apply migrations to production
bun prisma migrate deploy

# Reset database (development only)
bun prisma migrate reset
```

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information.

### **Development Workflow**

1. **Fork the repository**
2. **Create a feature branch**: `bun run branch:create`
3. **Make your changes** following our coding standards
4. **Run tests**: `bun run review:check`
5. **Commit your changes** with descriptive messages
6. **Push to your fork**
7. **Create a Pull Request**

### **Code Standards**

- **TypeScript** - Strict mode enabled, no `any` types
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting
- **Testing** - Unit and integration tests required
- **Documentation** - JSDoc comments for all functions

### **Pull Request Process**

1. **Update documentation** for any new features
2. **Add tests** for new functionality
3. **Ensure all tests pass** and code coverage is maintained
4. **Update CHANGELOG.md** with your changes
5. **Request review** from maintainers

## 🐛 Troubleshooting

### **Common Issues**

#### **Database Connection Issues**
```bash
# Check database connection
bun prisma db push

# Reset database
bun prisma migrate reset
```

#### **Authentication Issues**
- Verify OAuth app configuration
- Check environment variables
- Ensure redirect URLs are correct

#### **Integration Issues**
- Verify API keys and secrets
- Check rate limits and quotas
- Review error logs in Sentry

#### **Performance Issues**
- Check Redis cache status
- Monitor database query performance

### **Getting Help**

- 📧 **Email**: support@unifiedhq.com
- 💬 **Discord**: [Join our community](https://discord.gg/unifiedhq)
- 📖 **Documentation**: [docs.unifiedhq.com](https://docs.unifiedhq.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/unifiedhq/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/your-username/unifiedhq/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

### **Core Technologies**
- [Next.js](https://nextjs.org/) - The React framework for production
- [Prisma](https://www.prisma.io/) - Next-generation ORM for Node.js and TypeScript
- [Radix UI](https://www.radix-ui.com/) - Low-level UI primitives
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Better Auth](https://www.better-auth.com/) - Modern authentication library

### **Integrations**
- [GitHub API](https://docs.github.com/en/rest) - Repository and activity data
- [Slack API](https://api.slack.com/) - Team communication platform
- [OpenAI API](https://openai.com/api/) - AI-powered insights
- [Sentry](https://sentry.io/) - Error monitoring and performance tracking

### **Community**
- **Contributors** - Thank you to all contributors who help improve UnifiedHQ
- **Beta Testers** - Early adopters who provide valuable feedback
- **Open Source Community** - For the amazing tools and libraries we use

## 📞 Support & Contact

### **Technical Support**
- 📧 **Email**: support@unifiedhq.com
- 💬 **Discord**: [Join our community](https://discord.gg/unifiedhq)
- 📖 **Documentation**: [docs.unifiedhq.com](https://docs.unifiedhq.com)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-username/unifiedhq/issues)

### **Business Inquiries**
- 📧 **Email**: business@unifiedhq.com
- 💼 **LinkedIn**: [UnifiedHQ Company](https://linkedin.com/company/unifiedhq)
- 🐦 **Twitter**: [@UnifiedHQ](https://twitter.com/unifiedhq)

### **Security**
- 🔒 **Security Issues**: security@unifiedhq.com
- 📋 **Security Policy**: [SECURITY.md](SECURITY.md)
- 🛡️ **Vulnerability Reporting**: Use GitHub's private vulnerability reporting

---

<div align="center">
  <strong>Made with ❤️ by the UnifiedHQ Team</strong>
  
  [![GitHub stars](https://img.shields.io/github/stars/your-username/unifiedhq?style=social)](https://github.com/your-username/unifiedhq)
  [![GitHub forks](https://img.shields.io/github/forks/your-username/unifiedhq?style=social)](https://github.com/your-username/unifiedhq)
  [![Twitter Follow](https://img.shields.io/twitter/follow/unifiedhq?style=social)](https://twitter.com/unifiedhq)
</div>