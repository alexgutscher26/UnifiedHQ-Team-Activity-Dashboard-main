/**
 * Safe logging utility for Node.js scripts to prevent log injection and sensitive data exposure
 */

/**
 * Sanitizes a value for safe logging by removing potentially dangerous content
 * and limiting the size of logged data
 */
function sanitizeForLogging(value) {
    if (value === null || value === undefined) {
        return String(value);
    }

    let sanitized;

    if (typeof value === 'string') {
        sanitized = value;
    } else if (typeof value === 'object') {
        try {
            // Remove potentially sensitive fields before stringifying
            const cleaned = removeSensitiveFields(value);
            sanitized = JSON.stringify(cleaned, null, 2);
        } catch (error) {
            sanitized = '[Object - could not serialize]';
        }
    } else {
        sanitized = String(value);
    }

    // Remove control characters and limit length
    sanitized = sanitized
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\r/g, '\\r') // Escape carriage returns
        .replace(/\t/g, '\\t'); // Escape tabs

    // Limit length to prevent log flooding
    if (sanitized.length > 1000) {
        sanitized = sanitized.substring(0, 997) + '...';
    }

    return sanitized;
}

/**
 * Removes potentially sensitive fields from an object before logging
 */
function removeSensitiveFields(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => removeSensitiveFields(item));
    }

    const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'key',
        'auth',
        'authorization',
        'cookie',
        'session',
        'csrf',
        'api_key',
        'apikey',
        'access_token',
        'refresh_token',
        'private_key',
        'client_secret',
    ];

    const cleaned = {};

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Check if this is a sensitive field
        const isSensitive = sensitiveKeys.some(sensitiveKey =>
            lowerKey.includes(sensitiveKey)
        );

        if (isSensitive) {
            cleaned[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
            cleaned[key] = removeSensitiveFields(value);
        } else {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

/**
 * Safe logger that sanitizes inputs before logging
 */
const safeLogger = {
    log: (...args) => {
        const sanitizedArgs = args.map(sanitizeForLogging);
        console.log(...sanitizedArgs);
    },

    error: (...args) => {
        const sanitizedArgs = args.map(sanitizeForLogging);
        console.error(...sanitizedArgs);
    },

    warn: (...args) => {
        const sanitizedArgs = args.map(sanitizeForLogging);
        console.warn(...sanitizedArgs);
    },

    info: (...args) => {
        const sanitizedArgs = args.map(sanitizeForLogging);
        console.info(...sanitizedArgs);
    },

    debug: (...args) => {
        const sanitizedArgs = args.map(sanitizeForLogging);
        console.debug(...sanitizedArgs);
    },
};

/**
 * Sanitizes error objects for safe logging
 */
function sanitizeError(error) {
    if (error instanceof Error) {
        return sanitizeForLogging({
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
        });
    }

    return sanitizeForLogging(error);
}

/**
 * Creates a safe logging context with a prefix
 */
function createSafeLogger(prefix) {
    const sanitizedPrefix = sanitizeForLogging(prefix);

    return {
        log: (...args) => safeLogger.log(`[${sanitizedPrefix}]`, ...args),
        error: (...args) => safeLogger.error(`[${sanitizedPrefix}]`, ...args),
        warn: (...args) => safeLogger.warn(`[${sanitizedPrefix}]`, ...args),
        info: (...args) => safeLogger.info(`[${sanitizedPrefix}]`, ...args),
        debug: (...args) => safeLogger.debug(`[${sanitizedPrefix}]`, ...args),
    };
}

module.exports = {
    safeLogger,
    sanitizeError,
    createSafeLogger,
    sanitizeForLogging,
};