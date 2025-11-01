'use client';

import { useEffect } from 'react';

export function UserJotInline() {
    useEffect(() => {
        const projectId = process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID;

        if (!projectId) {
            console.log('No UserJot project ID found');
            return;
        }

        console.log('Loading UserJot with project ID:', projectId);

        // Inline script approach - exactly as provided
        const script1 = `
            window.$ujq=window.$ujq||[];
            window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});
            document.head.appendChild(Object.assign(document.createElement('script'),{
                src:'https://cdn.userjot.com/sdk/v2/uj.js',
                type:'module',
                async:true
            }));
        `;

        const script2 = `
            window.uj.init('${projectId}', {
                widget: true,
                position: 'right',
                theme: 'auto'
            });
        `;

        // Execute the first script
        try {
            eval(script1);
            console.log('UserJot SDK script injected');

            // Wait a bit then execute initialization
            setTimeout(() => {
                try {
                    eval(script2);
                    console.log('UserJot widget initialized');
                } catch (error) {
                    console.error('UserJot init error:', error);
                }
            }, 1000);
        } catch (error) {
            console.error('UserJot script error:', error);
        }
    }, []);

    return null;
}