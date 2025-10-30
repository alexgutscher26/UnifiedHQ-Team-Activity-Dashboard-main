/**
 * ESLint rules for memory leak prevention
 * Custom rules to detect and auto-fix common memory leak patterns
 */

/**
 * Rule: require-useeffect-cleanup
 * Detects useEffect hooks that add event listeners, intervals, or subscriptions without cleanup
 */
const requireUseEffectCleanup = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require cleanup functions in useEffect hooks that create subscriptions or listeners',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            missingCleanup: 'useEffect hook with {{type}} should return a cleanup function',
            missingCleanupGeneric: 'useEffect hook should return a cleanup function for proper resource management',
        },
    },

    create(context) {
        const sourceCode = context.getSourceCode();

        function hasCleanupReturn(effectBody) {
            if (!effectBody || effectBody.type !== 'BlockStatement') {
                return false;
            }

            // Check if there's a return statement
            const returnStatements = effectBody.body.filter(stmt => stmt.type === 'ReturnStatement');
            if (returnStatements.length === 0) {
                return false;
            }

            // Check if the return statement returns a function
            const lastReturn = returnStatements[returnStatements.length - 1];
            return lastReturn.argument &&
                (lastReturn.argument.type === 'FunctionExpression' ||
                    lastReturn.argument.type === 'ArrowFunctionExpression');
        }

        function detectLeakPatterns(effectBody) {
            const patterns = [];

            if (!effectBody || effectBody.type !== 'BlockStatement') {
                return patterns;
            }

            // Walk through the effect body to find leak patterns
            function walkNode(node) {
                if (!node) return;

                // Detect addEventListener calls
                if (node.type === 'CallExpression' &&
                    node.callee &&
                    node.callee.property &&
                    node.callee.property.name === 'addEventListener') {
                    patterns.push('event listener');
                }

                // Detect setInterval/setTimeout calls
                if (node.type === 'CallExpression' &&
                    node.callee &&
                    node.callee.name &&
                    (node.callee.name === 'setInterval' || node.callee.name === 'setTimeout')) {
                    patterns.push(node.callee.name === 'setInterval' ? 'interval' : 'timeout');
                }

                // Detect subscription patterns (.subscribe, .on, etc.)
                if (node.type === 'CallExpression' &&
                    node.callee &&
                    node.callee.property &&
                    (node.callee.property.name === 'subscribe' ||
                        node.callee.property.name === 'on' ||
                        node.callee.property.name === 'addListener')) {
                    patterns.push('subscription');
                }

                // Detect EventSource/WebSocket creation
                if (node.type === 'NewExpression' &&
                    node.callee &&
                    node.callee.name &&
                    (node.callee.name === 'EventSource' || node.callee.name === 'WebSocket')) {
                    patterns.push(node.callee.name);
                }

                // Recursively walk child nodes
                for (const key in node) {
                    if (key !== 'parent' && node[key] && typeof node[key] === 'object') {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(walkNode);
                        } else {
                            walkNode(node[key]);
                        }
                    }
                }
            }

            effectBody.body.forEach(walkNode);
            return patterns;
        }

        function generateCleanupFix(effectBody, patterns) {
            if (!effectBody || effectBody.type !== 'BlockStatement') {
                return null;
            }

            const cleanupStatements = [];

            // Generate cleanup based on detected patterns
            patterns.forEach(pattern => {
                switch (pattern) {
                    case 'event listener':
                        cleanupStatements.push('    // Remove event listeners');
                        cleanupStatements.push('    // element.removeEventListener(\'event\', handler);');
                        break;
                    case 'interval':
                        cleanupStatements.push('    // Clear interval');
                        cleanupStatements.push('    // clearInterval(intervalId);');
                        break;
                    case 'timeout':
                        cleanupStatements.push('    // Clear timeout');
                        cleanupStatements.push('    // clearTimeout(timeoutId);');
                        break;
                    case 'subscription':
                        cleanupStatements.push('    // Unsubscribe from subscription');
                        cleanupStatements.push('    // subscription.unsubscribe();');
                        break;
                    case 'EventSource':
                        cleanupStatements.push('    // Close EventSource connection');
                        cleanupStatements.push('    // eventSource.close();');
                        break;
                    case 'WebSocket':
                        cleanupStatements.push('    // Close WebSocket connection');
                        cleanupStatements.push('    // webSocket.close();');
                        break;
                }
            });

            if (cleanupStatements.length === 0) {
                cleanupStatements.push('    // Add cleanup logic here');
            }

            const cleanupFunction = `
    return () => {
${cleanupStatements.join('\n')}
    };`;

            return cleanupFunction;
        }

        return {
            CallExpression(node) {
                // Check if this is a useEffect call
                if (node.callee &&
                    node.callee.name === 'useEffect' &&
                    node.arguments &&
                    node.arguments.length > 0) {

                    const effectCallback = node.arguments[0];
                    let effectBody = null;

                    // Handle different callback types
                    if (effectCallback.type === 'ArrowFunctionExpression') {
                        effectBody = effectCallback.body.type === 'BlockStatement'
                            ? effectCallback.body
                            : null;
                    } else if (effectCallback.type === 'FunctionExpression') {
                        effectBody = effectCallback.body;
                    }

                    if (effectBody) {
                        const patterns = detectLeakPatterns(effectBody);

                        if (patterns.length > 0 && !hasCleanupReturn(effectBody)) {
                            const primaryPattern = patterns[0];

                            context.report({
                                node,
                                messageId: 'missingCleanup',
                                data: { type: primaryPattern },
                                fix(fixer) {
                                    const cleanupCode = generateCleanupFix(effectBody, patterns);
                                    if (cleanupCode) {
                                        const lastStatement = effectBody.body[effectBody.body.length - 1];
                                        const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                                        return fixer.insertTextAfterRange([insertPosition, insertPosition], cleanupCode);
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            }
        };
    }
};

export { requireUseEffectCleanup };
/*
*
 * Rule: require-event-listener-cleanup
 * Detects addEventListener calls without corresponding removeEventListener
 */
const requireEventListenerCleanup = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require removeEventListener for every addEventListener call',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            missingRemoveListener: 'addEventListener call should have corresponding removeEventListener in cleanup',
            missingMediaQueryCleanup: 'MediaQueryList.addListener should have corresponding removeListener in cleanup',
        },
    },

    create(context) {
        const sourceCode = context.getSourceCode();
        const eventListeners = new Map(); // Track addEventListener calls

        function isInReactComponent(node) {
            let current = node.parent;
            while (current) {
                // Check if we're inside a React component (function starting with capital letter)
                if (current.type === 'FunctionDeclaration' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name)) {
                    return true;
                }
                // Check for arrow function components
                if (current.type === 'VariableDeclarator' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name) &&
                    current.init &&
                    (current.init.type === 'ArrowFunctionExpression' ||
                        current.init.type === 'FunctionExpression')) {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function isInUseEffect(node) {
            let current = node.parent;
            while (current) {
                if (current.type === 'CallExpression' &&
                    current.callee &&
                    current.callee.name === 'useEffect') {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function generateEventListenerCleanupFix(node, eventType, target, handler) {
            const cleanupCode = `
    return () => {
      ${sourceCode.getText(target)}.removeEventListener('${eventType}', ${sourceCode.getText(handler)});
    };`;

            return cleanupCode;
        }

        function generateMediaQueryCleanupFix(node, target, handler) {
            const cleanupCode = `
    return () => {
      ${sourceCode.getText(target)}.removeListener(${sourceCode.getText(handler)});
    };`;

            return cleanupCode;
        }

        return {
            CallExpression(node) {
                // Detect addEventListener calls
                if (node.callee &&
                    node.callee.property &&
                    node.callee.property.name === 'addEventListener' &&
                    node.arguments &&
                    node.arguments.length >= 2) {

                    const target = node.callee.object;
                    const eventType = node.arguments[0];
                    const handler = node.arguments[1];

                    // Only flag if we're in a React component and useEffect
                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const key = `${sourceCode.getText(target)}_${sourceCode.getText(eventType)}_${sourceCode.getText(handler)}`;
                        eventListeners.set(key, {
                            node,
                            target,
                            eventType: eventType.value || eventType.raw,
                            handler,
                            type: 'addEventListener'
                        });

                        context.report({
                            node,
                            messageId: 'missingRemoveListener',
                            fix(fixer) {
                                // Find the useEffect block and add cleanup
                                let useEffectNode = node.parent;
                                while (useEffectNode &&
                                    !(useEffectNode.type === 'CallExpression' &&
                                        useEffectNode.callee &&
                                        useEffectNode.callee.name === 'useEffect')) {
                                    useEffectNode = useEffectNode.parent;
                                }

                                if (useEffectNode && useEffectNode.arguments[0]) {
                                    const effectCallback = useEffectNode.arguments[0];
                                    let effectBody = null;

                                    if (effectCallback.type === 'ArrowFunctionExpression') {
                                        effectBody = effectCallback.body.type === 'BlockStatement'
                                            ? effectCallback.body
                                            : null;
                                    } else if (effectCallback.type === 'FunctionExpression') {
                                        effectBody = effectCallback.body;
                                    }

                                    if (effectBody) {
                                        const cleanupCode = generateEventListenerCleanupFix(
                                            node,
                                            eventType.value || eventType.raw,
                                            target,
                                            handler
                                        );
                                        const lastStatement = effectBody.body[effectBody.body.length - 1];
                                        const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                                        return fixer.insertTextAfterRange([insertPosition, insertPosition], cleanupCode);
                                    }
                                }
                                return null;
                            }
                        });
                    }
                }

                // Detect MediaQueryList.addListener calls
                if (node.callee &&
                    node.callee.property &&
                    node.callee.property.name === 'addListener' &&
                    node.arguments &&
                    node.arguments.length >= 1) {

                    const target = node.callee.object;
                    const handler = node.arguments[0];

                    // Check if target looks like a MediaQueryList (has matchMedia in the chain)
                    let isMediaQuery = false;
                    if (target.type === 'CallExpression' &&
                        target.callee &&
                        target.callee.property &&
                        target.callee.property.name === 'matchMedia') {
                        isMediaQuery = true;
                    }

                    if (isMediaQuery && isInReactComponent(node) && isInUseEffect(node)) {
                        context.report({
                            node,
                            messageId: 'missingMediaQueryCleanup',
                            fix(fixer) {
                                // Find the useEffect block and add cleanup
                                let useEffectNode = node.parent;
                                while (useEffectNode &&
                                    !(useEffectNode.type === 'CallExpression' &&
                                        useEffectNode.callee &&
                                        useEffectNode.callee.name === 'useEffect')) {
                                    useEffectNode = useEffectNode.parent;
                                }

                                if (useEffectNode && useEffectNode.arguments[0]) {
                                    const effectCallback = useEffectNode.arguments[0];
                                    let effectBody = null;

                                    if (effectCallback.type === 'ArrowFunctionExpression') {
                                        effectBody = effectCallback.body.type === 'BlockStatement'
                                            ? effectCallback.body
                                            : null;
                                    } else if (effectCallback.type === 'FunctionExpression') {
                                        effectBody = effectCallback.body;
                                    }

                                    if (effectBody) {
                                        const cleanupCode = generateMediaQueryCleanupFix(node, target, handler);
                                        const lastStatement = effectBody.body[effectBody.body.length - 1];
                                        const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                                        return fixer.insertTextAfterRange([insertPosition, insertPosition], cleanupCode);
                                    }
                                }
                                return null;
                            }
                        });
                    }
                }
            }
        };
    }
};

export { requireUseEffectCleanup, requireEventListenerCleanup };
const requireTimerCleanup = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require clearInterval/clearTimeout for timer functions in React components',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            missingClearInterval: 'setInterval call should have corresponding clearInterval in cleanup',
            missingClearTimeout: 'setTimeout call should have corresponding clearTimeout in cleanup',
        },
    },

    create(context) {
        const sourceCode = context.getSourceCode();

        function isInReactComponent(node) {
            let current = node.parent;
            while (current) {
                // Check if we're inside a React component (function starting with capital letter)
                if (current.type === 'FunctionDeclaration' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name)) {
                    return true;
                }
                // Check for arrow function components
                if (current.type === 'VariableDeclarator' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name) &&
                    current.init &&
                    (current.init.type === 'ArrowFunctionExpression' ||
                        current.init.type === 'FunctionExpression')) {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function isInUseEffect(node) {
            let current = node.parent;
            while (current) {
                if (current.type === 'CallExpression' &&
                    current.callee &&
                    current.callee.name === 'useEffect') {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function generateTimerCleanupFix(node, timerType, variableName) {
            const clearFunction = timerType === 'setInterval' ? 'clearInterval' : 'clearTimeout';
            const cleanupCode = `
    return () => {
      if (${variableName}) {
        ${clearFunction}(${variableName});
      }
    };`;

            return cleanupCode;
        }

        function findTimerVariable(node) {
            // Check if the timer call is assigned to a variable
            let current = node.parent;
            while (current) {
                if (current.type === 'VariableDeclarator' && current.init === node) {
                    return current.id.name;
                }
                if (current.type === 'AssignmentExpression' && current.right === node) {
                    if (current.left.type === 'Identifier') {
                        return current.left.name;
                    }
                }
                current = current.parent;
            }
            return null;
        }

        return {
            CallExpression(node) {
                // Detect setInterval calls
                if (node.callee &&
                    node.callee.name === 'setInterval' &&
                    node.arguments &&
                    node.arguments.length >= 2) {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findTimerVariable(node);

                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingClearInterval',
                                fix(fixer) {
                                    // Find the useEffect block and add cleanup
                                    let useEffectNode = node.parent;
                                    while (useEffectNode &&
                                        !(useEffectNode.type === 'CallExpression' &&
                                            useEffectNode.callee &&
                                            useEffectNode.callee.name === 'useEffect')) {
                                        useEffectNode = useEffectNode.parent;
                                    }

                                    if (useEffectNode && useEffectNode.arguments[0]) {
                                        const effectCallback = useEffectNode.arguments[0];
                                        let effectBody = null;

                                        if (effectCallback.type === 'ArrowFunctionExpression') {
                                            effectBody = effectCallback.body.type === 'BlockStatement'
                                                ? effectCallback.body
                                                : null;
                                        } else if (effectCallback.type === 'FunctionExpression') {
                                            effectBody = effectCallback.body;
                                        }

                                        if (effectBody) {
                                            const cleanupCode = generateTimerCleanupFix(node, 'setInterval', variableName);
                                            const lastStatement = effectBody.body[effectBody.body.length - 1];
                                            const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                                            return fixer.insertTextAfterRange([insertPosition, insertPosition], cleanupCode);
                                        }
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }

                // Detect setTimeout calls (only if they're stored in a variable for cleanup)
                if (node.callee &&
                    node.callee.name === 'setTimeout' &&
                    node.arguments &&
                    node.arguments.length >= 2) {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findTimerVariable(node);

                        // Only flag setTimeout if it's assigned to a variable (indicating intent to clear)
                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingClearTimeout',
                                fix(fixer) {
                                    // Find the useEffect block and add cleanup
                                    let useEffectNode = node.parent;
                                    while (useEffectNode &&
                                        !(useEffectNode.type === 'CallExpression' &&
                                            useEffectNode.callee &&
                                            useEffectNode.callee.name === 'useEffect')) {
                                        useEffectNode = useEffectNode.parent;
                                    }

                                    if (useEffectNode && useEffectNode.arguments[0]) {
                                        const effectCallback = useEffectNode.arguments[0];
                                        let effectBody = null;

                                        if (effectCallback.type === 'ArrowFunctionExpression') {
                                            effectBody = effectCallback.body.type === 'BlockStatement'
                                                ? effectCallback.body
                                                : null;
                                        } else if (effectCallback.type === 'FunctionExpression') {
                                            effectBody = effectCallback.body;
                                        }

                                        if (effectBody) {
                                            const cleanupCode = generateTimerCleanupFix(node, 'setTimeout', variableName);
                                            const lastStatement = effectBody.body[effectBody.body.length - 1];
                                            const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                                            return fixer.insertTextAfterRange([insertPosition, insertPosition], cleanupCode);
                                        }
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            }
        };
    }
};

export { requireUseEffectCleanup, requireEventListenerCleanup, requireTimerCleanup };

const requireSubscriptionCleanup = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require cleanup for subscriptions, EventSource, and WebSocket connections',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            missingUnsubscribe: 'Subscription should have corresponding unsubscribe in cleanup',
            missingEventSourceClose: 'EventSource should be closed in cleanup',
            missingWebSocketClose: 'WebSocket should be closed in cleanup',
            missingObserverDisconnect: 'Observer should be disconnected in cleanup',
        },
    },

    create(context) {
        const sourceCode = context.getSourceCode();

        function isInReactComponent(node) {
            let current = node.parent;
            while (current) {
                // Check if we're inside a React component (function starting with capital letter)
                if (current.type === 'FunctionDeclaration' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name)) {
                    return true;
                }
                // Check for arrow function components
                if (current.type === 'VariableDeclarator' &&
                    current.id &&
                    current.id.name &&
                    /^[A-Z]/.test(current.id.name) &&
                    current.init &&
                    (current.init.type === 'ArrowFunctionExpression' ||
                        current.init.type === 'FunctionExpression')) {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function isInUseEffect(node) {
            let current = node.parent;
            while (current) {
                if (current.type === 'CallExpression' &&
                    current.callee &&
                    current.callee.name === 'useEffect') {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        function findAssignedVariable(node) {
            // Check if the call is assigned to a variable
            let current = node.parent;
            while (current) {
                if (current.type === 'VariableDeclarator' && current.init === node) {
                    return current.id.name;
                }
                if (current.type === 'AssignmentExpression' && current.right === node) {
                    if (current.left.type === 'Identifier') {
                        return current.left.name;
                    }
                }
                current = current.parent;
            }
            return null;
        }

        function generateSubscriptionCleanupFix(node, cleanupMethod, variableName) {
            const cleanupCode = `
    return () => {
      if (${variableName}) {
        ${variableName}.${cleanupMethod}();
      }
    };`;

            return cleanupCode;
        }

        function addCleanupToUseEffect(node, cleanupCode) {
            // Find the useEffect block and add cleanup
            let useEffectNode = node.parent;
            while (useEffectNode &&
                !(useEffectNode.type === 'CallExpression' &&
                    useEffectNode.callee &&
                    useEffectNode.callee.name === 'useEffect')) {
                useEffectNode = useEffectNode.parent;
            }

            if (useEffectNode && useEffectNode.arguments[0]) {
                const effectCallback = useEffectNode.arguments[0];
                let effectBody = null;

                if (effectCallback.type === 'ArrowFunctionExpression') {
                    effectBody = effectCallback.body.type === 'BlockStatement'
                        ? effectCallback.body
                        : null;
                } else if (effectCallback.type === 'FunctionExpression') {
                    effectBody = effectCallback.body;
                }

                if (effectBody) {
                    const lastStatement = effectBody.body[effectBody.body.length - 1];
                    const insertPosition = lastStatement ? lastStatement.range[1] : effectBody.range[1] - 1;
                    return [insertPosition, insertPosition];
                }
            }
            return null;
        }

        return {
            CallExpression(node) {
                // Detect subscription calls (.subscribe, .on, .addListener)
                if (node.callee &&
                    node.callee.property &&
                    (node.callee.property.name === 'subscribe' ||
                        node.callee.property.name === 'on' ||
                        node.callee.property.name === 'addListener')) {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findAssignedVariable(node);

                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingUnsubscribe',
                                fix(fixer) {
                                    const insertRange = addCleanupToUseEffect(node);
                                    if (insertRange) {
                                        const cleanupMethod = node.callee.property.name === 'subscribe' ? 'unsubscribe' :
                                            node.callee.property.name === 'on' ? 'off' : 'removeListener';
                                        const cleanupCode = generateSubscriptionCleanupFix(node, cleanupMethod, variableName);
                                        return fixer.insertTextAfterRange(insertRange, cleanupCode);
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            },

            NewExpression(node) {
                // Detect EventSource creation
                if (node.callee &&
                    node.callee.name === 'EventSource') {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findAssignedVariable(node);

                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingEventSourceClose',
                                fix(fixer) {
                                    const insertRange = addCleanupToUseEffect(node);
                                    if (insertRange) {
                                        const cleanupCode = generateSubscriptionCleanupFix(node, 'close', variableName);
                                        return fixer.insertTextAfterRange(insertRange, cleanupCode);
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }

                // Detect WebSocket creation
                if (node.callee &&
                    node.callee.name === 'WebSocket') {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findAssignedVariable(node);

                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingWebSocketClose',
                                fix(fixer) {
                                    const insertRange = addCleanupToUseEffect(node);
                                    if (insertRange) {
                                        const cleanupCode = generateSubscriptionCleanupFix(node, 'close', variableName);
                                        return fixer.insertTextAfterRange(insertRange, cleanupCode);
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }

                // Detect Observer creation (IntersectionObserver, MutationObserver, etc.)
                if (node.callee &&
                    node.callee.name &&
                    node.callee.name.endsWith('Observer')) {

                    if (isInReactComponent(node) && isInUseEffect(node)) {
                        const variableName = findAssignedVariable(node);

                        if (variableName) {
                            context.report({
                                node,
                                messageId: 'missingObserverDisconnect',
                                fix(fixer) {
                                    const insertRange = addCleanupToUseEffect(node);
                                    if (insertRange) {
                                        const cleanupCode = generateSubscriptionCleanupFix(node, 'disconnect', variableName);
                                        return fixer.insertTextAfterRange(insertRange, cleanupCode);
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            }
        };
    }
};

export {
    requireUseEffectCleanup,
    requireEventListenerCleanup,
    requireTimerCleanup,
    requireSubscriptionCleanup
};