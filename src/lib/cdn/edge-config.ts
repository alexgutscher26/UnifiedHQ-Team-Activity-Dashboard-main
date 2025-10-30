// Vercel Edge Network Configuration
// Manages CDN caching rules and optimization settings

export interface EdgeCacheRule {
  pattern: string;
  maxAge: number;
  staleWhileRevalidate?: number;
  sMaxAge?: number;
  immutable?: boolean;
  public?: boolean;
  tags?: string[];
}

export interface AssetOptimization {
  webp: boolean;
  avif: boolean;
  quality: number;
  progressive: boolean;
  lossless?: boolean;
}

export class EdgeConfig {
  // Static asset cache rules
  static readonly STATIC_ASSETS: EdgeCacheRule[] = [
    {
      pattern: '/static/**/*',
      maxAge: 31536000, // 1 year
      immutable: true,
      public: true,
      tags: ['static'],
    },
    {
      pattern: '**/*.{css,js}',
      maxAge: 31536000, // 1 year
      immutable: true,
      public: true,
      tags: ['assets', 'versioned'],
    },
    {
      pattern: '**/*.{woff,woff2,eot,ttf,otf}',
      maxAge: 31536000, // 1 year
      immutable: true,
      public: true,
      tags: ['fonts'],
    },
  ];

  // Image cache rules
  static readonly IMAGE_ASSETS: EdgeCacheRule[] = [
    {
      pattern: '**/*.{jpg,jpeg,png,gif,webp,avif,svg,ico}',
      maxAge: 86400, // 24 hours
      staleWhileRevalidate: 604800, // 7 days
      public: true,
      tags: ['images'],
    },
    {
      pattern: '/placeholder-*',
      maxAge: 2592000, // 30 days
      public: true,
      tags: ['images', 'placeholders'],
    },
  ];

  // API cache rules
  static readonly API_ROUTES: EdgeCacheRule[] = [
    {
      pattern: '/api/github/**',
      maxAge: 300, // 5 minutes
      staleWhileRevalidate: 900, // 15 minutes
      sMaxAge: 60, // 1 minute CDN cache
      public: true,
      tags: ['api', 'github'],
    },
    {
      pattern: '/api/slack/**',
      maxAge: 180, // 3 minutes
      staleWhileRevalidate: 600, // 10 minutes
      sMaxAge: 30, // 30 seconds CDN cache
      public: true,
      tags: ['api', 'slack'],
    },
    {
      pattern: '/api/ai-summary/**',
      maxAge: 1800, // 30 minutes
      staleWhileRevalidate: 3600, // 1 hour
      sMaxAge: 300, // 5 minutes CDN cache
      public: true,
      tags: ['api', 'ai-summary'],
    },
    {
      pattern: '/api/user/**',
      maxAge: 300, // 5 minutes
      public: false, // Private user data
      tags: ['api', 'user'],
    },
    {
      pattern: '/api/health',
      maxAge: 0, // No cache
      public: true,
      tags: ['api', 'health'],
    },
  ];

  // Page cache rules
  static readonly PAGE_ROUTES: EdgeCacheRule[] = [
    {
      pattern: '/',
      maxAge: 60, // 1 minute
      staleWhileRevalidate: 300, // 5 minutes
      sMaxAge: 60, // 1 minute CDN cache
      public: true,
      tags: ['pages', 'dashboard'],
    },
    {
      pattern: '/dashboard/**',
      maxAge: 60, // 1 minute
      staleWhileRevalidate: 300, // 5 minutes
      sMaxAge: 30, // 30 seconds CDN cache
      public: false, // Requires auth
      tags: ['pages', 'dashboard'],
    },
    {
      pattern: '/auth/**',
      maxAge: 0, // No cache
      public: true,
      tags: ['pages', 'auth'],
    },
  ];

  // Asset optimization settings
  static readonly OPTIMIZATION: Record<string, AssetOptimization> = {
    images: {
      webp: true,
      avif: true,
      quality: 85,
      progressive: true,
    },
    thumbnails: {
      webp: true,
      avif: true,
      quality: 75,
      progressive: false,
    },
    avatars: {
      webp: true,
      avif: false,
      quality: 90,
      progressive: false,
    },
  };

  /**
   * Generate Cache-Control header value from rule
   */
  static generateCacheControl(rule: EdgeCacheRule): string {
    const directives: string[] = [];

    if (rule.public !== false) {
      directives.push('public');
    } else {
      directives.push('private');
    }

    if (rule.maxAge !== undefined) {
      directives.push(`max-age=${rule.maxAge}`);
    }

    if (rule.sMaxAge !== undefined) {
      directives.push(`s-maxage=${rule.sMaxAge}`);
    }

    if (rule.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${rule.staleWhileRevalidate}`);
    }

    if (rule.immutable) {
      directives.push('immutable');
    }

    return directives.join(', ');
  }

  /**
   * Generate CDN-Cache-Control header for Vercel Edge
   */
  static generateCDNCacheControl(rule: EdgeCacheRule): string {
    const directives: string[] = [];

    if (rule.public !== false) {
      directives.push('public');
    }

    const cdnMaxAge = rule.sMaxAge || rule.maxAge || 0;
    directives.push(`max-age=${cdnMaxAge}`);

    return directives.join(', ');
  }

  /**
   * Get cache rule for a given path
   */
  static getCacheRule(pathname: string): EdgeCacheRule | null {
    const allRules = [
      ...this.STATIC_ASSETS,
      ...this.IMAGE_ASSETS,
      ...this.API_ROUTES,
      ...this.PAGE_ROUTES,
    ];

    for (const rule of allRules) {
      if (this.matchesPattern(pathname, rule.pattern)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if pathname matches pattern (simple glob matching)
   */
  private static matchesPattern(pathname: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any segment
      .replace(/\{([^}]+)\}/g, '($1)') // {a,b,c} becomes (a|b|c)
      .replace(/,/g, '|');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  }

  /**
   * Get optimization settings for asset type
   */
  static getOptimization(assetType: string): AssetOptimization {
    return this.OPTIMIZATION[assetType] || this.OPTIMIZATION.images;
  }

  /**
   * Generate cache tags for invalidation
   */
  static generateCacheTags(rule: EdgeCacheRule, pathname: string): string[] {
    const tags = [...(rule.tags || [])];

    // Add path-based tags
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      tags.push(`path:${pathSegments[0]}`);
    }

    // Add specific tags based on path patterns
    if (pathname.startsWith('/api/')) {
      tags.push('api');
    }
    if (pathname.includes('github')) {
      tags.push('github');
    }
    if (pathname.includes('slack')) {
      tags.push('slack');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Check if path should be cached
   */
  static shouldCache(pathname: string, method = 'GET'): boolean {
    // Only cache GET requests
    if (method !== 'GET') {
      return false;
    }

    // Don't cache auth endpoints
    if (pathname.startsWith('/api/auth/')) {
      return false;
    }

    // Don't cache health checks
    if (pathname === '/api/health') {
      return false;
    }

    // Don't cache real-time endpoints
    if (pathname.includes('/live') || pathname.includes('/stream')) {
      return false;
    }

    return true;
  }

  /**
   * Get edge regions configuration
   */
  static getEdgeRegions(): string[] {
    return [
      'iad1', // US East (Virginia)
      'sfo1', // US West (San Francisco)
      'lhr1', // Europe (London)
      'hnd1', // Asia (Tokyo)
      'syd1', // Oceania (Sydney)
    ];
  }

  /**
   * Get edge function configuration
   */
  static getEdgeFunctionConfig() {
    return {
      runtime: 'edge',
      regions: this.getEdgeRegions(),
      maxDuration: 30,
    };
  }
}

