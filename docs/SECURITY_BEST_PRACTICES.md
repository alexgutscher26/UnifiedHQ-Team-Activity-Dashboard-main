# Security Best Practices

## Overview

This document outlines security best practices for the UnifiedHQ project, covering development, deployment, and operational security guidelines.

## Development Security

### Code Security

#### TypeScript Best Practices
```typescript
// ✅ GOOD: Use strict typing
interface UserData {
  id: string;
  name: string;
  email: string;
}

// ❌ BAD: Avoid any type
const userData: any = getUserData();

// ✅ GOOD: Use unknown for truly unknown data
const unknownData: unknown = fetchData();
if (typeof unknownData === 'object' && unknownData !== null) {
  // Type guard to narrow the type
}
```

#### Input Validation
```typescript
// ✅ GOOD: Always validate input with Zod
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(120)
});

const validatedUser = userSchema.parse(userInput);
```

#### SQL Injection Prevention
```typescript
// ✅ GOOD: Use Prisma ORM (prevents SQL injection)
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// ❌ BAD: Never use raw SQL with user input
const query = `SELECT * FROM users WHERE id = '${userId}'`;
```

#### XSS Prevention
```typescript
// ✅ GOOD: Sanitize user input
import DOMPurify from 'dompurify';

const sanitizedContent = DOMPurify.sanitize(userContent);

// ✅ GOOD: Use React's built-in XSS protection
const userMessage = <div>{userInput}</div>; // React escapes by default
```

### Authentication Security

#### Session Management
```typescript
// ✅ GOOD: Secure session configuration
const sessionConfig = {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // 1 day
  cookie: {
    name: 'unifiedhq.session',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  }
};
```

#### Password Security
```typescript
// ✅ GOOD: Use strong password requirements
const passwordSchema = z.string()
  .min(8)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);

// ✅ GOOD: Hash passwords with bcrypt
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 12);
const isValid = await bcrypt.compare(password, hashedPassword);
```

#### OAuth Security
```typescript
// ✅ GOOD: Minimal OAuth scopes
const githubScopes = [
  'read:user',
  'read:org',
  'repo:status'
];

// ✅ GOOD: Validate OAuth state parameter
const state = crypto.randomBytes(32).toString('hex');
const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}`;
```

### API Security

#### Authentication Middleware
```typescript
// ✅ GOOD: Consistent authentication check
export async function authenticateRequest(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  
  return session.user;
}
```

#### Rate Limiting
```typescript
// ✅ GOOD: Implement rate limiting
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // limit to 500 requests per minute
});

export async function POST(request: NextRequest) {
  try {
    await limiter.check(request, 10, 'CACHE_TOKEN'); // 10 requests per minute
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
}
```

#### Error Handling
```typescript
// ✅ GOOD: Secure error handling
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    // Log error for monitoring
    console.error('API Error:', error);
    
    // Return generic error message
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Data Security

### Database Security

#### Connection Security
```typescript
// ✅ GOOD: Secure database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?sslmode=require'
    }
  }
});
```

#### Data Encryption
```typescript
// ✅ GOOD: Encrypt sensitive data
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  cipher.setAAD(Buffer.from('unifiedhq', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}
```

#### Query Security
```typescript
// ✅ GOOD: Use Prisma's type-safe queries
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true,
    // Explicitly exclude sensitive fields
  }
});

// ❌ BAD: Don't select all fields
const user = await prisma.user.findUnique({
  where: { id: userId }
  // This includes all fields including sensitive ones
});
```

### Cache Security

#### User-Specific Caching
```typescript
// ✅ GOOD: User-specific cache keys
const cacheKey = `activities:${userId}:${selectedRepos
  .map(r => r.repoId)
  .sort()
  .join(',')}`;

// ❌ BAD: Global cache keys
const cacheKey = 'activities:all';
```

#### Cache TTL
```typescript
// ✅ GOOD: Appropriate TTL for different data types
const cacheConfig = {
  userData: 60 * 60 * 1000, // 1 hour (stable data)
  activityData: 5 * 60 * 1000, // 5 minutes (frequently changing)
  rateLimit: 60 * 1000, // 1 minute (frequently changing)
  repositoryData: 30 * 60 * 1000 // 30 minutes (moderately stable)
};
```

## Third-Party Integration Security

### GitHub Integration

#### Token Management
```typescript
// ✅ GOOD: Secure token storage
const connection = await prisma.connection.create({
  data: {
    userId,
    type: 'github',
    accessToken: encryptToken(githubToken),
    refreshToken: encryptToken(refreshToken),
    expiresAt: new Date(Date.now() + 3600 * 1000)
  }
});
```

#### Repository Access Control
```typescript
// ✅ GOOD: Validate user access to repositories
async function validateRepositoryAccess(userId: string, repoId: number) {
  const githubClient = new CachedGitHubClient(accessToken, userId);
  
  try {
    const repo = await githubClient.getRepository(repoId);
    return repo !== null;
  } catch (error) {
    if (error.status === 404) {
      return false; // User doesn't have access
    }
    throw error;
  }
}
```

### Slack Integration

#### Bot Token Security
```typescript
// ✅ GOOD: Secure bot token storage
const slackConnection = await prisma.connection.create({
  data: {
    userId,
    type: 'slack',
    accessToken: encryptToken(userToken),
    botToken: encryptToken(botToken),
    teamId: teamId,
    teamName: teamName
  }
});
```

#### Channel Access Validation
```typescript
// ✅ GOOD: Validate channel access
async function validateChannelAccess(userId: string, channelId: string) {
  const slackClient = new SlackClient(botToken);
  
  try {
    const channel = await slackClient.conversations.info({ channel: channelId });
    return channel.ok && channel.channel;
  } catch (error) {
    return false;
  }
}
```

#### Event Sanitization
```typescript
// ✅ GOOD: Sanitize events before sending
function sanitizeEvent(event: string, properties: Record<string, unknown>) {
  const sanitizedProperties = { ...properties };
  
  // Remove sensitive fields
  delete sanitizedProperties.password;
  delete sanitizedProperties.token;
  delete sanitizedProperties.email;
  
  // Sanitize URLs
  if (sanitizedProperties.url) {
    sanitizedProperties.url = sanitizedProperties.url.replace(/[?&]token=[^&]+/g, '');
  }
  
  return { event, properties: sanitizedProperties };
}
```

## Deployment Security

### Environment Variables

#### Secure Configuration
```bash
# ✅ GOOD: Use strong, unique secrets
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
ENCRYPTION_KEY="32-character-random-string-here"
GITHUB_CLIENT_SECRET="github-client-secret-here"
SLACK_CLIENT_SECRET="slack-client-secret-here"
SENTRY_DSN="sentry-dsn-here"
```

#### Environment Separation
```typescript
// ✅ GOOD: Environment-specific configuration
const config = {
  development: {
    database: process.env.DATABASE_URL_DEV,
    encryption: process.env.ENCRYPTION_KEY_DEV,
  },
  production: {
    database: process.env.DATABASE_URL,
    encryption: process.env.ENCRYPTION_KEY,
  }
}[process.env.NODE_ENV];
```

### HTTPS Configuration

#### SSL/TLS Settings
```typescript
// ✅ GOOD: Secure HTTPS configuration
const httpsOptions = {
  minVersion: 'TLSv1.2',
  ciphers: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256'
  ].join(':'),
  honorCipherOrder: true,
  secureProtocol: 'TLSv1_2_method'
};
```

### Security Headers

#### Next.js Security Headers
```typescript
// ✅ GOOD: Configure security headers
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];
```

## Monitoring Security

### Error Tracking

#### Sentry Configuration
```typescript
// ✅ GOOD: Secure Sentry configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter sensitive data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    
    // Filter sensitive tags
    if (event.tags) {
      delete event.tags.password;
      delete event.tags.token;
    }
    
    return event;
  }
});
```

### Logging Security

#### Secure Logging
```typescript
// ✅ GOOD: Secure logging practices
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  const sanitizedDetails = { ...details };
  
  // Remove sensitive information
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.email;
  
  console.log(`[SECURITY] ${event}`, sanitizedDetails);
}
```

## Operational Security

### Access Control

#### Principle of Least Privilege
```typescript
// ✅ GOOD: Minimal required permissions
const githubScopes = [
  'read:user',        // Read user profile
  'read:org',         // Read organization membership
  'repo:status'       // Read repository status
  // Don't include 'repo' or 'admin' unless absolutely necessary
];
```

#### Role-Based Access
```typescript
// ✅ GOOD: Implement role-based access control
enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.USER]: 1,
    [UserRole.MODERATOR]: 2,
    [UserRole.ADMIN]: 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
```

### Incident Response

#### Security Incident Detection
```typescript
// ✅ GOOD: Monitor for security incidents
function detectSecurityIncident(request: NextRequest) {
  const suspiciousPatterns = [
    /script.*src/i,
    /javascript:/i,
    /<script/i,
    /union.*select/i,
    /drop.*table/i
  ];
  
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || '';
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(userAgent)) {
      logSecurityEvent('SUSPICIOUS_REQUEST', {
        url,
        userAgent,
        ip: request.ip,
        timestamp: new Date().toISOString()
      });
      return true;
    }
  }
  
  return false;
}
```

## Compliance

### GDPR Compliance

#### Data Minimization
```typescript
// ✅ GOOD: Only collect necessary data
const userRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  // Don't collect unnecessary fields like age, gender, etc.
});
```

#### Consent Management
```typescript
// ✅ GOOD: Track user consent
const consentSchema = z.object({
  userId: z.string(),
  consentType: z.enum(['analytics', 'marketing', 'data_processing']),
  granted: z.boolean(),
  timestamp: z.date(),
  version: z.string() // Consent version for tracking changes
});
```

### Data Retention

#### Automated Cleanup
```typescript
// ✅ GOOD: Automated data cleanup
async function cleanupExpiredData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  await prisma.activity.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo
      }
    }
  });
  
  await prisma.githubCache.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo
      }
    }
  });
}
```

## Security Testing

### Unit Testing

#### Security Test Cases
```typescript
// ✅ GOOD: Test security functions
describe('Authentication', () => {
  it('should reject invalid tokens', async () => {
    const invalidToken = 'invalid-token';
    await expect(authenticateToken(invalidToken)).rejects.toThrow('Invalid token');
  });
  
  it('should validate password strength', () => {
    const weakPassword = '123456';
    expect(validatePassword(weakPassword)).toBe(false);
    
    const strongPassword = 'MyStr0ng!P@ssw0rd';
    expect(validatePassword(strongPassword)).toBe(true);
  });
});
```

### Integration Testing

#### API Security Tests
```typescript
// ✅ GOOD: Test API security
describe('API Security', () => {
  it('should require authentication for protected endpoints', async () => {
    const response = await fetch('/api/team-activity');
    expect(response.status).toBe(401);
  });
  
  it('should rate limit excessive requests', async () => {
    const requests = Array(20).fill(null).map(() => 
      fetch('/api/team-activity', {
        headers: { 'Authorization': 'Bearer valid-token' }
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

## Security Checklist

### Development Checklist
- [ ] All user input is validated with Zod schemas
- [ ] No sensitive data in error messages
- [ ] Authentication required for all protected endpoints
- [ ] Rate limiting implemented on all API endpoints
- [ ] SQL injection prevention (using Prisma ORM)
- [ ] XSS prevention (React's built-in protection)
- [ ] CSRF protection enabled
- [ ] Secure session configuration
- [ ] Environment variables properly secured

### Deployment Checklist
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] Environment variables secured
- [ ] Database connections encrypted
- [ ] Error tracking configured (Sentry)
- [ ] Logging configured without sensitive data
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery procedures tested

### Operational Checklist
- [ ] Security monitoring active
- [ ] Incident response procedures documented
- [ ] Regular security updates scheduled
- [ ] Access controls reviewed
- [ ] Data retention policies implemented
- [ ] Compliance requirements met
- [ ] Security training completed
- [ ] Penetration testing scheduled

---

**Last Updated**: January 2025  
**Next Review**: April 2025  
**Document Owner**: Security Team
