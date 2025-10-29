import * as ts from 'typescript';
import {
  LeakDetectionResult,
  LeakType,
} from './memory-leak-detection-patterns';
import { createEventListenerFixGenerator } from './event-listener-fix-generator';
import { createTimerCleanupFixGenerator } from './timer-cleanup-fix-generator';
import { createConnectionCleanupFixGenerator } from './connection-cleanup-fix-generator';

export interface Fix {
  id: string;
  type: LeakType;
  file: string;
  originalCode: string;
  fixedCode: string;
  description: string;
  confidence: number; // 0-1
  requiresManualReview: boolean;
}

export interface FixGenerationResult {
  success: boolean;
  fix?: Fix;
  error?: string;
}

export interface CodeTransformation {
  start: number;
  end: number;
  replacement: string;
}

export class MemoryLeakFixGenerator {
  private sourceFile: ts.SourceFile;
  private sourceCode: string;
  private fileName: string;

  constructor(sourceCode: string, fileName: string) {
    this.sourceCode = sourceCode;
    this.fileName = fileName;
    this.sourceFile = ts.createSourceFile(
      fileName,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
  }

  generateFix(leak: LeakDetectionResult): FixGenerationResult {
    try {
      switch (leak.type) {
        case 'missing-useeffect-cleanup':
          return this.generateUseEffectCleanupFix(leak);
        case 'uncleaned-event-listener':
          return this.delegateToEventListenerGenerator(leak);
        case 'uncleaned-interval':
        case 'uncleaned-timeout':
          return this.delegateToTimerGenerator(leak);
        case 'unclosed-eventsource':
        case 'unclosed-websocket':
        case 'uncleaned-subscription':
          return this.delegateToConnectionGenerator(leak);
        default:
          return {
            success: false,
            error: `Unsupported leak type: ${leak.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error generating fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private delegateToEventListenerGenerator(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const eventListenerGenerator = createEventListenerFixGenerator(
      this.sourceCode,
      this.fileName
    );
    return eventListenerGenerator.generateEventListenerCleanupFix(leak);
  }

  private delegateToTimerGenerator(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const timerGenerator = createTimerCleanupFixGenerator(
      this.sourceCode,
      this.fileName
    );
    return timerGenerator.generateTimerCleanupFix(leak);
  }

  private delegateToConnectionGenerator(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const connectionGenerator = createConnectionCleanupFixGenerator(
      this.sourceCode,
      this.fileName
    );
    return connectionGenerator.generateConnectionCleanupFix(leak);
  }

  private generateUseEffectCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const useEffectNode = this.findNodeAtPosition(leak.line, leak.column);
    if (!useEffectNode || !ts.isCallExpression(useEffectNode)) {
      return { success: false, error: 'Could not find useEffect call' };
    }

    const effectCallback = useEffectNode.arguments[0];
    if (
      !ts.isArrowFunction(effectCallback) &&
      !ts.isFunctionExpression(effectCallback)
    ) {
      return { success: false, error: 'useEffect callback is not a function' };
    }

    // Analyze what needs cleanup in the effect
    const cleanupItems = this.analyzeEffectForCleanup(effectCallback);
    if (cleanupItems.length === 0) {
      return { success: false, error: 'No cleanup items found in useEffect' };
    }

    // Generate cleanup function
    const cleanupCode = this.generateCleanupFunction(cleanupItems);

    // Transform the useEffect to include cleanup
    const transformation = this.addCleanupToUseEffect(
      effectCallback,
      cleanupCode
    );
    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `useeffect-cleanup-${Date.now()}`,
        type: 'missing-useeffect-cleanup',
        file: this.fileName,
        originalCode: this.getNodeText(useEffectNode),
        fixedCode: fixedCode,
        description: `Added cleanup function to useEffect with ${cleanupItems.length} cleanup items`,
        confidence: 0.9,
        requiresManualReview: cleanupItems.some(
          item => item.requiresManualReview
        ),
      },
    };
  }

  private generateEventListenerCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const addEventListenerNode = this.findNodeAtPosition(
      leak.line,
      leak.column
    );
    if (!addEventListenerNode || !ts.isCallExpression(addEventListenerNode)) {
      return { success: false, error: 'Could not find addEventListener call' };
    }

    // Extract event listener details
    const listenerDetails =
      this.extractEventListenerDetails(addEventListenerNode);
    if (!listenerDetails) {
      return {
        success: false,
        error: 'Could not extract event listener details',
      };
    }

    // Find the containing useEffect or component
    const container = this.findContainingFunction(addEventListenerNode);
    if (!container) {
      return { success: false, error: 'Could not find containing function' };
    }

    // Generate cleanup code
    const cleanupCode = this.generateEventListenerCleanup(listenerDetails);

    // Apply the fix based on context
    let transformation: CodeTransformation;
    if (this.isInUseEffect(container)) {
      transformation = this.addCleanupToExistingUseEffect(
        container,
        cleanupCode
      );
    } else {
      transformation = this.wrapInUseEffectWithCleanup(
        addEventListenerNode,
        cleanupCode
      );
    }

    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `event-listener-cleanup-${Date.now()}`,
        type: 'uncleaned-event-listener',
        file: this.fileName,
        originalCode: this.getNodeText(addEventListenerNode),
        fixedCode: fixedCode,
        description: `Added removeEventListener cleanup for ${listenerDetails.event} event`,
        confidence: 0.95,
        requiresManualReview: false,
      },
    };
  }

  private generateTimerCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const timerNode = this.findNodeAtPosition(leak.line, leak.column);
    if (!timerNode || !ts.isCallExpression(timerNode)) {
      return { success: false, error: 'Could not find timer call' };
    }

    const timerDetails = this.extractTimerDetails(timerNode);
    if (!timerDetails) {
      return { success: false, error: 'Could not extract timer details' };
    }

    // Generate cleanup code
    const cleanupCode = this.generateTimerCleanup(timerDetails);

    // Find containing function and apply fix
    const container = this.findContainingFunction(timerNode);
    if (!container) {
      return { success: false, error: 'Could not find containing function' };
    }

    let transformation: CodeTransformation;
    if (this.isInUseEffect(container)) {
      transformation = this.addCleanupToExistingUseEffect(
        container,
        cleanupCode
      );
    } else {
      transformation = this.wrapInUseEffectWithCleanup(timerNode, cleanupCode);
    }

    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `timer-cleanup-${Date.now()}`,
        type: leak.type,
        file: this.fileName,
        originalCode: this.getNodeText(timerNode),
        fixedCode: fixedCode,
        description: `Added ${timerDetails.clearFunction} cleanup for ${timerDetails.timerFunction}`,
        confidence: 0.95,
        requiresManualReview: false,
      },
    };
  }

  private generateEventSourceCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const eventSourceNode = this.findNodeAtPosition(leak.line, leak.column);
    if (!eventSourceNode || !ts.isNewExpression(eventSourceNode)) {
      return { success: false, error: 'Could not find EventSource creation' };
    }

    // Extract variable name if assigned
    const variableName = this.extractVariableName(eventSourceNode);
    if (!variableName) {
      return {
        success: false,
        error: 'EventSource must be assigned to a variable for cleanup',
      };
    }

    // Generate cleanup code
    const cleanupCode = `${variableName}.close();`;

    // Find containing function and apply fix
    const container = this.findContainingFunction(eventSourceNode);
    if (!container) {
      return { success: false, error: 'Could not find containing function' };
    }

    let transformation: CodeTransformation;
    if (this.isInUseEffect(container)) {
      transformation = this.addCleanupToExistingUseEffect(
        container,
        cleanupCode
      );
    } else {
      transformation = this.wrapInUseEffectWithCleanup(
        eventSourceNode,
        cleanupCode
      );
    }

    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `eventsource-cleanup-${Date.now()}`,
        type: 'unclosed-eventsource',
        file: this.fileName,
        originalCode: this.getNodeText(eventSourceNode),
        fixedCode: fixedCode,
        description: `Added EventSource.close() cleanup for ${variableName}`,
        confidence: 0.9,
        requiresManualReview: false,
      },
    };
  }

  private generateWebSocketCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const webSocketNode = this.findNodeAtPosition(leak.line, leak.column);
    if (!webSocketNode || !ts.isNewExpression(webSocketNode)) {
      return { success: false, error: 'Could not find WebSocket creation' };
    }

    // Extract variable name if assigned
    const variableName = this.extractVariableName(webSocketNode);
    if (!variableName) {
      return {
        success: false,
        error: 'WebSocket must be assigned to a variable for cleanup',
      };
    }

    // Generate cleanup code with readyState check
    const cleanupCode = `if (${variableName}.readyState === WebSocket.OPEN || ${variableName}.readyState === WebSocket.CONNECTING) {
      ${variableName}.close();
    }`;

    // Find containing function and apply fix
    const container = this.findContainingFunction(webSocketNode);
    if (!container) {
      return { success: false, error: 'Could not find containing function' };
    }

    let transformation: CodeTransformation;
    if (this.isInUseEffect(container)) {
      transformation = this.addCleanupToExistingUseEffect(
        container,
        cleanupCode
      );
    } else {
      transformation = this.wrapInUseEffectWithCleanup(
        webSocketNode,
        cleanupCode
      );
    }

    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `websocket-cleanup-${Date.now()}`,
        type: 'unclosed-websocket',
        file: this.fileName,
        originalCode: this.getNodeText(webSocketNode),
        fixedCode: fixedCode,
        description: `Added WebSocket.close() cleanup for ${variableName}`,
        confidence: 0.9,
        requiresManualReview: false,
      },
    };
  }

  private generateSubscriptionCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    const subscribeNode = this.findNodeAtPosition(leak.line, leak.column);
    if (!subscribeNode || !ts.isCallExpression(subscribeNode)) {
      return { success: false, error: 'Could not find subscribe call' };
    }

    // Check if subscribe call is already assigned to a variable
    const variableName = this.extractVariableName(subscribeNode);
    let transformation: CodeTransformation;
    let cleanupCode: string;

    if (variableName) {
      // Already assigned, just add cleanup
      cleanupCode = `${variableName}();`;
    } else {
      // Need to assign to variable and add cleanup
      const unsubscribeVar = 'unsubscribe';
      const subscribeText = this.getNodeText(subscribeNode);
      const newCode = `const ${unsubscribeVar} = ${subscribeText};`;
      cleanupCode = `${unsubscribeVar}();`;

      // Replace the subscribe call with assignment
      transformation = {
        start: subscribeNode.getFullStart(),
        end: subscribeNode.getEnd(),
        replacement: newCode,
      };
    }

    // Find containing function and apply cleanup
    const container = this.findContainingFunction(subscribeNode);
    if (!container) {
      return { success: false, error: 'Could not find containing function' };
    }

    if (this.isInUseEffect(container)) {
      const cleanupTransformation = this.addCleanupToExistingUseEffect(
        container,
        cleanupCode
      );
      if (!transformation) {
        transformation = cleanupTransformation;
      }
    } else {
      transformation = this.wrapInUseEffectWithCleanup(
        subscribeNode,
        cleanupCode
      );
    }

    const fixedCode = this.applyTransformation(transformation);

    return {
      success: true,
      fix: {
        id: `subscription-cleanup-${Date.now()}`,
        type: 'uncleaned-subscription',
        file: this.fileName,
        originalCode: this.getNodeText(subscribeNode),
        fixedCode: fixedCode,
        description: `Added unsubscribe cleanup for subscription`,
        confidence: 0.85,
        requiresManualReview: !variableName, // Requires review if we had to create variable
      },
    };
  }

  // Helper methods for analysis and transformation
  private findNodeAtPosition(line: number, column: number): ts.Node | null {
    const position = this.sourceFile.getPositionOfLineAndCharacter(
      line - 1,
      column - 1
    );

    function findNode(node: ts.Node): ts.Node | null {
      if (node.getStart() <= position && position < node.getEnd()) {
        return ts.forEachChild(node, findNode) || node;
      }
      return null;
    }

    return findNode(this.sourceFile);
  }

  private analyzeEffectForCleanup(
    effectCallback: ts.ArrowFunction | ts.FunctionExpression
  ): CleanupItem[] {
    const cleanupItems: CleanupItem[] = [];

    const visit = (node: ts.Node) => {
      // Check for EventSource
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'EventSource'
      ) {
        const varName = this.extractVariableName(node);
        if (varName) {
          cleanupItems.push({
            type: 'eventsource',
            code: `${varName}.close();`,
            requiresManualReview: false,
          });
        }
      }

      // Check for WebSocket
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'WebSocket'
      ) {
        const varName = this.extractVariableName(node);
        if (varName) {
          cleanupItems.push({
            type: 'websocket',
            code: `if (${varName}.readyState === WebSocket.OPEN || ${varName}.readyState === WebSocket.CONNECTING) { ${varName}.close(); }`,
            requiresManualReview: false,
          });
        }
      }

      // Check for addEventListener
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'addEventListener'
      ) {
        const details = this.extractEventListenerDetails(node);
        if (details) {
          cleanupItems.push({
            type: 'eventlistener',
            code: this.generateEventListenerCleanup(details),
            requiresManualReview: false,
          });
        }
      }

      // Check for timers
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'setInterval' ||
          node.expression.text === 'setTimeout')
      ) {
        const details = this.extractTimerDetails(node);
        if (details) {
          cleanupItems.push({
            type: 'timer',
            code: this.generateTimerCleanup(details),
            requiresManualReview: false,
          });
        }
      }

      // Check for subscriptions
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'subscribe'
      ) {
        const varName = this.extractVariableName(node);
        if (varName) {
          cleanupItems.push({
            type: 'subscription',
            code: `${varName}();`,
            requiresManualReview: false,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    if (effectCallback.body) {
      visit(effectCallback.body);
    }

    return cleanupItems;
  }

  private generateCleanupFunction(cleanupItems: CleanupItem[]): string {
    const cleanupCode = cleanupItems
      .map(item => `      ${item.code}`)
      .join('\n');
    return `return () => {
${cleanupCode}
    };`;
  }

  private addCleanupToUseEffect(
    effectCallback: ts.ArrowFunction | ts.FunctionExpression,
    cleanupCode: string
  ): CodeTransformation {
    if (!effectCallback.body) {
      throw new Error('Effect callback has no body');
    }

    let insertPosition: number;
    let indentation = '    ';

    if (ts.isBlock(effectCallback.body)) {
      // Block body - insert before closing brace
      insertPosition = effectCallback.body.getEnd() - 1;
      const bodyText = this.getNodeText(effectCallback.body);
      const lines = bodyText.split('\n');
      if (lines.length > 1) {
        const lastLine = lines[lines.length - 2] || '';
        const match = lastLine.match(/^(\s*)/);
        if (match) {
          indentation = match[1];
        }
      }
    } else {
      // Expression body - need to convert to block
      const expressionText = this.getNodeText(effectCallback.body);
      const newBody = `{
    ${expressionText};
    ${cleanupCode}
  }`;

      return {
        start: effectCallback.body.getFullStart(),
        end: effectCallback.body.getEnd(),
        replacement: newBody,
      };
    }

    return {
      start: insertPosition,
      end: insertPosition,
      replacement: `\n${indentation}${cleanupCode}\n${indentation.slice(0, -2)}`,
    };
  }

  private addCleanupToExistingUseEffect(
    container: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    // Find existing return statement or add new one
    let returnStatement: ts.ReturnStatement | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node)) {
        returnStatement = node;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(container);

    if (returnStatement && returnStatement.expression) {
      // Add to existing cleanup function
      if (
        ts.isArrowFunction(returnStatement.expression) ||
        ts.isFunctionExpression(returnStatement.expression)
      ) {
        const cleanupFunction = returnStatement.expression;
        if (cleanupFunction.body && ts.isBlock(cleanupFunction.body)) {
          const insertPosition = cleanupFunction.body.getEnd() - 1;
          return {
            start: insertPosition,
            end: insertPosition,
            replacement: `\n      ${cleanupCode}\n    `,
          };
        }
      }
    }

    // Add new return statement
    const insertPosition = container.getEnd() - 1;
    return {
      start: insertPosition,
      end: insertPosition,
      replacement: `\n    ${cleanupCode.includes('return') ? cleanupCode : `return () => { ${cleanupCode} };`}\n  `,
    };
  }

  private wrapInUseEffectWithCleanup(
    node: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    const nodeText = this.getNodeText(node);
    const wrappedCode = `useEffect(() => {
    ${nodeText};
    return () => {
      ${cleanupCode}
    };
  }, []);`;

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: wrappedCode,
    };
  }

  private extractEventListenerDetails(
    node: ts.CallExpression
  ): EventListenerDetails | null {
    if (node.arguments.length < 2) return null;

    const target = ts.isPropertyAccessExpression(node.expression)
      ? this.getNodeText(node.expression.expression)
      : 'element';

    const event = ts.isStringLiteral(node.arguments[0])
      ? node.arguments[0].text
      : this.getNodeText(node.arguments[0]);

    const handler = this.getNodeText(node.arguments[1]);
    const options = node.arguments[2]
      ? this.getNodeText(node.arguments[2])
      : undefined;

    return { target, event, handler, options };
  }

  private generateEventListenerCleanup(details: EventListenerDetails): string {
    const optionsStr = details.options ? `, ${details.options}` : '';
    return `${details.target}.removeEventListener('${details.event}', ${details.handler}${optionsStr});`;
  }

  private extractTimerDetails(node: ts.CallExpression): TimerDetails | null {
    if (!ts.isIdentifier(node.expression)) return null;

    const timerFunction = node.expression.text;
    const clearFunction =
      timerFunction === 'setInterval' ? 'clearInterval' : 'clearTimeout';
    const variableName = this.extractVariableName(node);

    return {
      timerFunction,
      clearFunction,
      variableName: variableName || 'timer',
    };
  }

  private generateTimerCleanup(details: TimerDetails): string {
    return `${details.clearFunction}(${details.variableName});`;
  }

  private extractVariableName(node: ts.Node): string | null {
    let current = node.parent;

    while (current) {
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
        return current.name.text;
      }
      if (
        ts.isBinaryExpression(current) &&
        current.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        if (ts.isIdentifier(current.left)) {
          return current.left.text;
        }
      }
      current = current.parent;
    }

    return null;
  }

  private findContainingFunction(node: ts.Node): ts.Node | null {
    let current = node.parent;
    while (current) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private isInUseEffect(container: ts.Node): boolean {
    // Check if the container is a useEffect callback
    let current = container.parent;
    while (current) {
      if (
        ts.isCallExpression(current) &&
        ts.isIdentifier(current.expression) &&
        current.expression.text === 'useEffect'
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private applyTransformation(transformation: CodeTransformation): string {
    const before = this.sourceCode.substring(0, transformation.start);
    const after = this.sourceCode.substring(transformation.end);
    return before + transformation.replacement + after;
  }

  private getNodeText(node: ts.Node): string {
    return this.sourceCode.substring(node.getFullStart(), node.getEnd()).trim();
  }
}

// Supporting interfaces
interface CleanupItem {
  type:
    | 'eventsource'
    | 'websocket'
    | 'eventlistener'
    | 'timer'
    | 'subscription';
  code: string;
  requiresManualReview: boolean;
}

interface EventListenerDetails {
  target: string;
  event: string;
  handler: string;
  options?: string;
}

interface TimerDetails {
  timerFunction: string;
  clearFunction: string;
  variableName: string;
}

// Factory function
export function createMemoryLeakFixGenerator(
  sourceCode: string,
  fileName: string
): MemoryLeakFixGenerator {
  return new MemoryLeakFixGenerator(sourceCode, fileName);
}
