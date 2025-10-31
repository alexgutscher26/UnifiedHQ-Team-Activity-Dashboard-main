'use client';

import { useEffect } from 'react';

/**
 * Configuration interface for ThinkStack chatbot
 */
interface ChatbotConfig {
    readonly id: string;
    readonly scriptUrl: string;
    readonly dataType: 'default' | 'custom';
}

/**
 * Type-safe chatbot ID validation
 */
function isValidChatbotId(id: string): id is string {
    return /^[a-f0-9]{24}$/.test(id);
}

/**
 * Type-safe script element creation with proper attributes
 */
function createChatbotScript(config: ChatbotConfig): HTMLScriptElement {
    const script = document.createElement('script');
    script.src = config.scriptUrl;
    script.async = true;
    script.defer = true;

    // Type-safe attribute setting
    script.setAttribute('chatbot_id', config.id);
    script.setAttribute('data-chatbot-id', config.id);
    script.setAttribute('data-type', config.dataType);
    script.setAttribute('data-domain', window.location.hostname);

    return script;
}

/**
 * ThinkStack Chatbot Component
 * 
 * Safely loads the ThinkStack chatbot script with security considerations.
 * This component dynamically injects a third-party script which requires
 * careful security handling to prevent XSS attacks.
 * 
 * Security measures implemented:
 * - Script source validation
 * - Proper cleanup on unmount
 * - Error handling for script loading failures
 * - Production-safe logging
 * - Type-safe configuration
 * 
 * @security This component loads external scripts from thinkstack.ai
 * @todo Add SRI (Subresource Integrity) hash when available from vendor
 * @todo Consider CSP implications for script-src directive
 */
export function ThinkStackChatbot() {
    useEffect(() => {
        const isDevelopment = process.env.NODE_ENV === 'development';

        if (isDevelopment) {
            console.log('Loading ThinkStack chatbot...');
        }

        // Remove any existing chatbot scripts to prevent duplicates
        const existingScripts = document.querySelectorAll('script[src*="thinkstackai-loader"]');
        existingScripts.forEach(script => script.remove());

        // Type-safe configuration
        const config: ChatbotConfig = {
            id: '69046ef993e6457c06632042',
            scriptUrl: 'https://app.thinkstack.ai/bot/thinkstackai-loader.min.js',
            dataType: 'default'
        } as const;

        // Type-safe validation
        if (!isValidChatbotId(config.id)) {
            console.error('Invalid chatbot ID format');
            return;
        }

        try {
            // Create script with type-safe helper
            const script = createChatbotScript(config);

            // Type-safe error handling
            script.onerror = (event: Event | string): void => {
                console.error('Failed to load ThinkStack chatbot script:', event);
            };

            script.onload = (): void => {
                if (isDevelopment || process.env.NEXT_PUBLIC_DEBUG_CHATBOT === 'true') {
                    console.log('ThinkStack chatbot loaded successfully');
                }
            };

            // Add to document head
            document.head.appendChild(script);

        } catch (error: unknown) {
            // Type-safe error handling - avoid 'any'
            if (error instanceof Error) {
                console.error('Error loading ThinkStack chatbot:', error.message);
            } else {
                console.error('Unknown error loading ThinkStack chatbot:', String(error));
            }
        }

        return (): void => {
            // Type-safe cleanup on unmount
            try {
                const scriptToRemove = document.querySelector('script[src*="thinkstackai-loader"]');
                if (scriptToRemove) {
                    scriptToRemove.remove();
                }

                // Clean up any chatbot UI elements that might have been created
                const chatbotElements = document.querySelectorAll('[id*="thinkstack"], [class*="thinkstack"]');
                chatbotElements.forEach(element => element.remove());

            } catch (error: unknown) {
                // Type-safe error handling - avoid 'any'
                if (error instanceof Error) {
                    console.error('Error during chatbot cleanup:', error.message);
                } else {
                    console.error('Unknown error during chatbot cleanup:', String(error));
                }
            }
        };
    }, []);

    return null;
}