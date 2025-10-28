// Validation schemas for API endpoints

import { z } from 'zod';

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // Search
  search: z.object({
    query: z.string().min(1).max(100),
    fields: z.array(z.string()).optional(),
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().min(1),
  }),

  // Email
  email: z.string().email('Invalid email format'),

  // Password
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),

  // GitHub repository
  githubRepo: z.object({
    owner: z.string().min(1).max(100),
    repo: z.string().min(1).max(100),
    branch: z.string().min(1).max(100).optional(),
  }),

  // User preferences
  userPreferences: z.object({
    githubRepoId: z.string().optional(),
    githubOwner: z.string().min(1).max(100).optional(),
    githubRepo: z.string().min(1).max(100).optional(),
    slackToken: z.string().min(20).optional(),
  }),
};

// GitHub API schemas
export const githubSchemas = {
  // Repository selection
  selectRepo: z.object({
    owner: z.string().min(1, 'Repository owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    branch: z.string().optional(),
  }),

  // Repository info
  repoInfo: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    fullName: z.string(),
    owner: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean(),
    updatedAt: z.string(),
    defaultBranch: z.string(),
  }),

  // Activity item
  activityItem: z.object({
    id: z.string(),
    type: z.enum(['commit', 'pull_request', 'issue', 'release']),
    title: z.string(),
    description: z.string().optional(),
    author: z.string(),
    authorAvatar: z.string().url().optional(),
    url: z.string().url(),
    createdAt: z.string(),
    repository: z.string(),
  }),
};

// Auth API schemas
export const authSchemas = {
  // Sign in
  signIn: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),

  // Sign up
  signUp: z
    .object({
      name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters'),
      email: z.string().email('Invalid email format'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          'Password must contain uppercase, lowercase, and number'
        ),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),

  // Password reset
  passwordReset: z.object({
    email: z.string().email('Invalid email format'),
  }),

  // Password reset confirm
  passwordResetConfirm: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase, and number'
      ),
  }),
};

// Integration API schemas
export const integrationSchemas = {
  // GitHub connection
  githubConnection: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
  }),

  // Slack integration
  slackIntegration: z.object({
    token: z.string().min(20, 'Slack token must be at least 20 characters'),
    channelId: z.string().min(1, 'Channel ID is required'),
  }),
};

// Activity API schemas
export const activitySchemas = {
  // Activity feed request
  activityFeed: z.object({
    repository: z.string().optional(),
    type: z
      .enum(['all', 'commits', 'pull_requests', 'issues', 'releases'])
      .default('all'),
    ...commonSchemas.pagination.shape,
    ...commonSchemas.dateRange.shape,
  }),

  // Activity summary
  activitySummary: z.object({
    repository: z.string().optional(),
    period: z.enum(['today', 'week', 'month', 'year']).default('today'),
  }),
};

// Error response schemas
export const errorSchemas = {
  // Validation error
  validationError: z.object({
    success: z.literal(false),
    error: z.object({
      type: z.literal('VALIDATION_ERROR'),
      message: z.string(),
      code: z.string(),
      statusCode: z.number(),
      details: z.object({
        issues: z.array(
          z.object({
            field: z.string(),
            message: z.string(),
            code: z.string(),
          })
        ),
      }),
      timestamp: z.string(),
      requestId: z.string(),
    }),
  }),

  // Generic error
  genericError: z.object({
    success: z.literal(false),
    error: z.object({
      type: z.string(),
      message: z.string(),
      code: z.string(),
      statusCode: z.number(),
      details: z.any().optional(),
      timestamp: z.string(),
      requestId: z.string(),
    }),
  }),
};

// Success response schemas
export const successSchemas = {
  // Generic success
  genericSuccess: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
    timestamp: z.string(),
    requestId: z.string(),
  }),

  // Paginated response
  paginatedResponse: z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(z.any()),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
    message: z.string().optional(),
    timestamp: z.string(),
    requestId: z.string(),
  }),
};

// Utility functions
export function createPaginatedResponse<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  requestId?: string
) {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true as const,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
    timestamp: new Date().toISOString(),
    requestId:
      requestId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): T {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): T {
  return schema.parse(body);
}
