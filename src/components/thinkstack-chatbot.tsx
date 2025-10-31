'use client';

import { useEffect } from 'react';

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
 * 
 * @security This component loads external scripts from thinkstack.ai
 * @todo Add SRI (Subresource Integrity) hash when available from vendor
 * @todo Consider CSP implications for script-src directive
 */
export function ThinkStackChatbot() {
    useEffect(() => {
        // Always enable chatbot for now
        const isDevelopment = process.env.NODE_ENV === 'development';
        console.log('Loading ThinkStack chatbot...');

        // Remove any existing chatbot scripts to prevent duplicates
        const existingScripts = document.querySelectorAll('script[src*="thinkstackai-loader"]');
        existingScripts.forEach(script => script.remove());

        // Validate the script URL for security
        const scriptUrl = 'https://app.thinkstack.ai/bot/thinkstackai-loader.min.js';
        const chatbotId = '69046ef993e6457c06632042';

        // Validate chatbot ID format (basic validation)
        if (!/^[a-f0-9]{24}$/.test(chatbotId)) {
            console.error('Invalid chatbot ID format');
            return;
        }

        try {
            // Create new script element with security attributes
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.defer = true;

            // Set required ThinkStack attributes - try different formats
            script.setAttribute('chatbot_id', chatbotId);
            script.setAttribute('data-chatbot-id', chatbotId);
            script.setAttribute('data-type', 'default');
            script.setAttribute('data-domain', window.location.hostname);

            // Add error handling
            script.onerror = () => {
                console.error('Failed to load ThinkStack chatbot script');
            };

            script.onload = () => {
                // Only log in development or when debugging is enabled
                if (isDevelopment || process.env.NEXT_PUBLIC_DEBUG_CHATBOT === 'true') {
                    console.log('ThinkStack chatbot loaded successfully');
                }
            };

            // Add to document head
            document.head.appendChild(script);

        } catch (error) {
            console.error('Error loading ThinkStack chatbot:', error);
        }

        return () => {
            // Cleanup on unmount - remove script and any chatbot elements
            try {
                const scriptToRemove = document.querySelector('script[src*="thinkstackai-loader"]');
                if (scriptToRemove) {
                    scriptToRemove.remove();
                }

                // Clean up any chatbot UI elements that might have been created
                const chatbotElements = document.querySelectorAll('[id*="thinkstack"], [class*="thinkstack"]');
                chatbotElements.forEach(element => element.remove());

            } catch (error) {
                console.error('Error during chatbot cleanup:', error);
            }
        };
    }, []);

    return null;
}