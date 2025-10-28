import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@/generated/prisma';
import { dymoEmailPlugin } from '@dymo-api/better-auth';
import {
  openAPI,
  haveIBeenPwned,
  lastLoginMethod,
  multiSession,
  mcp,
} from 'better-auth/plugins';

const prisma = new PrismaClient();
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GH_CLIENT_ID as string,
      clientSecret: process.env.GH_CLIENT_SECRET as string,
      scope: ['read:user', 'repo', 'read:org'],
    },
    // slack: {
    //     clientId: process.env.SLACK_CLIENT_ID as string,
    //     clientSecret: process.env.SLACK_CLIENT_SECRET as string,
    // },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      updateUserInfoOnLink: true,
    },
  },
  events: {
    async signInSuccess({ user, account }: { user: any; account: any }) {
      if (account?.provider === 'github' && account?.accessToken) {
        await prisma.connection.upsert({
          where: {
            userId_type: {
              userId: user.id,
              type: 'github',
            },
          },
          update: {
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            expiresAt: account.accessTokenExpiresAt,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            type: 'github',
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            expiresAt: account.accessTokenExpiresAt,
          },
        });
      }
    },
  },
  plugins: [
    // Temporarily disabled Dymo plugin due to API plan limitations
    // dymoEmailPlugin({
    //   apiKey: process.env.DYMO_API_KEY as string,
    //   applyToLogin: true, // recommended
    //   applyToOAuth: true, // validate OAuth emails
    //   emailRules: {
    //     // These are the default rules defined for email validation.
    //     deny: ['FRAUD', 'INVALID', 'NO_MX_RECORDS', 'NO_REPLY_EMAIL'],
    //   },
    // }),
    openAPI(),
    multiSession(),
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        'This password has been found in a data breach. Please choose a more secure password.',
    }),
    lastLoginMethod({
      storeInDatabase: true,
    }),
    mcp({
      loginPage: '/auth/signin',
    }),
  ],
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    window: 60, // 60 seconds
    max: 100, // 100 requests per window
    storage: 'database',
    customRules: {
      '/sign-in/email': {
        window: 10,
        max: 3,
      },
      '/sign-up/email': {
        window: 10,
        max: 3,
      },
      '/get-session': false, // Disable rate limiting for session checks
    },
  },
  advanced: {
    cookiePrefix: 'my-app',
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookies: {
      session_token: {
        name: 'session_token',
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
      },
      session_data: {
        name: 'session_data',
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
      },
      dont_remember: {
        name: 'dont_remember',
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Uncomment and configure if you need cross-subdomain cookies
    // crossSubDomainCookies: {
    //     enabled: true,
    //     domain: process.env.COOKIE_DOMAIN || "localhost", // Set your domain
    // },
    // trustedOrigins: [
    //     process.env.BETTER_AUTH_URL || "http://localhost:3000",
    //     // Add other trusted origins
    // ],
  },
  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
});
