import * as ts from 'typescript';
import {
  FixGenerationResult,
  CodeTransformation,
} from './memory-leak-fix-generator';
import { LeakDetectionResult } from './memory-leak-detection-patterns';

export interface ConnectionPattern {
  connectionType: 'EventSource' | 'WebSocket' | 'Subscription';
  variableName?: string;
  isAssigned: boolean;
  constructorArgs: string[];
  isInUseEffect: boolean;
  isInComponent: boolean;
  hasExistingCleanup: boolean;
  subscriptionManager?: string; // For subscription patterns
  subscriptionMethod?: string; // subscribe, on, addEventListener, etc.
}

export class ConnectionCleanupFixGenerator {
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

  generateConnectionCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
    try {
      const connectionNode = this.findNodeAtPosition(leak.line, leak.column);
      if (!connectionNode) {
        return { success: false, error: 'Could not find connection node' };
      }

      // Analyze the connection pattern
      const pattern = this.analyzeConnectionPattern(connectionNode, leak.type);
      if (!pattern) {
        return {
          success: false,
          error: 'Could not analyze connection pattern',
        };
      }

      // Generate appropriate cleanup transformation
      const transformation = this.generateConnectionCleanupTransformation(
        connectionNode,
        pattern
      );
      const fixedCode = this.applyTransformation(transformation);

      return {
        success: true,
        fix: {
          id: `connection-cleanup-${Date.now()}`,
          type: leak.type,
          file: this.fileName,
          originalCode: this.getNodeText(connectionNode),
          fixedCode: fixedCode,
          description: this.generateFixDescription(pattern),
          confidence: this.calculateConfidence(pattern),
          requiresManualReview: this.requiresManualReview(pattern),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error generating connection cleanup fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private analyzeConnectionPattern(
    node: ts.Node,
    leakType: string
  ): ConnectionPattern | null {
    if (ts.isNewExpression(node)) {
      return this.analyzeConstructorPattern(node, leakType);
    } else if (ts.isCallExpression(node)) {
      return this.analyzeSubscriptionPattern(node, leakType);
    }

    return null;
  }

  private analyzeConstructorPattern(
    node: ts.NewExpression,
    leakType: string
  ): ConnectionPattern | null {
    if (!ts.isIdentifier(node.expression)) return null;

    const connectionType = node.expression.text as 'EventSource' | 'WebSocket';
    if (connectionType !== 'EventSource' && connectionType !== 'WebSocket') {
      return null;
    }

    // Extract constructor arguments
    const constructorArgs =
      node.arguments?.map(arg => this.getNodeText(arg)) || [];

    // Check if assigned to variable
    const variableName = this.extractVariableName(node);
    const isAssigned = Boolean(variableName);

    // Analyze context
    const containingFunction = this.findContainingFunction(node);
    const isInUseEffect = this.isInUseEffect(containingFunction);
    const isInComponent = this.isInReactComponent(containingFunction);
    const hasExistingCleanup = this.hasExistingCleanup(containingFunction);

    return {
      connectionType,
      variableName: variableName || undefined,
      isAssigned,
      constructorArgs,
      isInUseEffect,
      isInComponent,
      hasExistingCleanup,
    };
  }

  /**
   * Analyzes a subscription pattern from a CallExpression node.
   */
  private analyzeSubscriptionPattern(
    node: ts.CallExpression,
    leakType: string
  ): ConnectionPattern | null {
    if (
      !ts.isPropertyAccessExpression(node.expression) ||
      !ts.isIdentifier(node.expression.name)
    ) {
      return null;
    }

    const subscriptionMethod = node.expression.name.text;
    const subscriptionManager = this.getNodeText(node.expression.expression);

    // Check if assigned to variable (for unsubscribe function)
    const variableName = this.extractVariableName(node);
    const isAssigned = Boolean(variableName);

    // Analyze context
    const containingFunction = this.findContainingFunction(node);
    const isInUseEffect = this.isInUseEffect(containingFunction);
    const isInComponent = this.isInReactComponent(containingFunction);
    const hasExistingCleanup = this.hasExistingCleanup(containingFunction);

    return {
      connectionType: 'Subscription',
      variableName: variableName || undefined,
      isAssigned,
      constructorArgs: [],
      isInUseEffect,
      isInComponent,
      hasExistingCleanup,
      subscriptionManager,
      subscriptionMethod,
    };
  }

  private generateConnectionCleanupTransformation(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    switch (pattern.connectionType) {
      case 'EventSource':
        return this.generateEventSourceCleanup(node, pattern);
      case 'WebSocket':
        return this.generateWebSocketCleanup(node, pattern);
      case 'Subscription':
        return this.generateSubscriptionCleanup(node, pattern);
      default:
        throw new Error(
          `Unsupported connection type: ${pattern.connectionType}`
        );
    }
  }

  private generateEventSourceCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    if (!pattern.isAssigned) {
      // Need to assign to variable first
      return this.createEventSourceWithVariableAndCleanup(node, pattern);
    }

    const cleanupCode = this.generateEventSourceCleanupCode(pattern);

    if (pattern.isInUseEffect) {
      if (pattern.hasExistingCleanup) {
        return this.addToExistingCleanup(node, cleanupCode);
      } else {
        return this.createCleanupFunction(node, cleanupCode);
      }
    }

    if (pattern.isInComponent) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode, pattern);
    }

    return this.addCleanupComment(node, cleanupCode);
  }

  private generateWebSocketCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    if (!pattern.isAssigned) {
      // Need to assign to variable first
      return this.createWebSocketWithVariableAndCleanup(node, pattern);
    }

    const cleanupCode = this.generateWebSocketCleanupCode(pattern);

    if (pattern.isInUseEffect) {
      if (pattern.hasExistingCleanup) {
        return this.addToExistingCleanup(node, cleanupCode);
      } else {
        return this.createCleanupFunction(node, cleanupCode);
      }
    }

    if (pattern.isInComponent) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode, pattern);
    }

    return this.addCleanupComment(node, cleanupCode);
  }

  private generateSubscriptionCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    if (!pattern.isAssigned) {
      // Need to assign unsubscribe function to variable
      return this.createSubscriptionWithVariableAndCleanup(node, pattern);
    }

    const cleanupCode = this.generateSubscriptionCleanupCode(pattern);

    if (pattern.isInUseEffect) {
      if (pattern.hasExistingCleanup) {
        return this.addToExistingCleanup(node, cleanupCode);
      } else {
        return this.createCleanupFunction(node, cleanupCode);
      }
    }

    if (pattern.isInComponent) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode, pattern);
    }

    return this.addCleanupComment(node, cleanupCode);
  }

  private createEventSourceWithVariableAndCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    const eventSourceVar = 'eventSource';
    const nodeText = this.getNodeText(node);

    let replacement: string;

    if (pattern.isInUseEffect) {
      replacement = `const ${eventSourceVar} = ${nodeText};
    
    return () => {
      if (${eventSourceVar}.readyState !== EventSource.CLOSED) {
        ${eventSourceVar}.close();
      }
    };`;
    } else if (pattern.isInComponent) {
      replacement = `useEffect(() => {
    const ${eventSourceVar} = ${nodeText};
    
    return () => {
      if (${eventSourceVar}.readyState !== EventSource.CLOSED) {
        ${eventSourceVar}.close();
      }
    };
  }, []);`;
    } else {
      replacement = `const ${eventSourceVar} = ${nodeText};
  // TODO: Call ${eventSourceVar}.close() when cleanup is needed`;
    }

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: replacement,
    };
  }

  private createWebSocketWithVariableAndCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    const webSocketVar = 'webSocket';
    const nodeText = this.getNodeText(node);

    let replacement: string;

    if (pattern.isInUseEffect) {
      replacement = `const ${webSocketVar} = ${nodeText};
    
    return () => {
      if (${webSocketVar}.readyState === WebSocket.OPEN || ${webSocketVar}.readyState === WebSocket.CONNECTING) {
        ${webSocketVar}.close();
      }
    };`;
    } else if (pattern.isInComponent) {
      replacement = `useEffect(() => {
    const ${webSocketVar} = ${nodeText};
    
    return () => {
      if (${webSocketVar}.readyState === WebSocket.OPEN || ${webSocketVar}.readyState === WebSocket.CONNECTING) {
        ${webSocketVar}.close();
      }
    };
  }, []);`;
    } else {
      replacement = `const ${webSocketVar} = ${nodeText};
  // TODO: Call ${webSocketVar}.close() when cleanup is needed`;
    }

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: replacement,
    };
  }

  private createSubscriptionWithVariableAndCleanup(
    node: ts.Node,
    pattern: ConnectionPattern
  ): CodeTransformation {
    const unsubscribeVar = 'unsubscribe';
    const nodeText = this.getNodeText(node);

    let replacement: string;

    if (pattern.isInUseEffect) {
      replacement = `const ${unsubscribeVar} = ${nodeText};
    
    return () => {
      ${unsubscribeVar}();
    };`;
    } else if (pattern.isInComponent) {
      replacement = `useEffect(() => {
    const ${unsubscribeVar} = ${nodeText};
    
    return () => {
      ${unsubscribeVar}();
    };
  }, []);`;
    } else {
      replacement = `const ${unsubscribeVar} = ${nodeText};
  // TODO: Call ${unsubscribeVar}() when cleanup is needed`;
    }

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: replacement,
    };
  }

  private generateEventSourceCleanupCode(pattern: ConnectionPattern): string {
    const varName = pattern.variableName!;
    return `if (${varName}.readyState !== EventSource.CLOSED) {
      ${varName}.close();
    }`;
  }

  private generateWebSocketCleanupCode(pattern: ConnectionPattern): string {
    const varName = pattern.variableName!;
    return `if (${varName}.readyState === WebSocket.OPEN || ${varName}.readyState === WebSocket.CONNECTING) {
      ${varName}.close();
    }`;
  }

  private generateSubscriptionCleanupCode(pattern: ConnectionPattern): string {
    const varName = pattern.variableName!;
    return `${varName}();`;
  }

  /**
   * Adds cleanup code to an existing cleanup function within a given node.
   *
   * This method first locates the containing function of the provided node. If a containing function is found, it then searches for a return statement within that function. If a return statement with an expression exists, it proceeds to add the specified cleanup code to the existing cleanup function. If no containing function or return statement is found, it throws an error.
   *
   * @param node - The TypeScript node to analyze for the containing function.
   * @param cleanupCode - The cleanup code to be added to the existing cleanup function.
   */
  private addToExistingCleanup(
    node: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    const containingFunction = this.findContainingFunction(node);
    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    const returnStatement = this.findReturnStatement(containingFunction);
    if (returnStatement?.expression) {
      return this.addToExistingCleanupFunction(returnStatement, cleanupCode);
    }

    throw new Error('No existing cleanup function found');
  }

  private createCleanupFunction(
    node: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    const containingFunction = this.findContainingFunction(node);
    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    const returnCode = `
    return () => {
      ${cleanupCode}
    };`;

    const insertPosition = containingFunction.getEnd() - 1;
    return {
      start: insertPosition,
      end: insertPosition,
      replacement: returnCode,
    };
  }

  private wrapInUseEffectWithCleanup(
    node: ts.Node,
    cleanupCode: string,
    pattern: ConnectionPattern
  ): CodeTransformation {
    const nodeText = this.getNodeText(node);
    const varName =
      pattern.variableName ||
      this.getDefaultVariableName(pattern.connectionType);

    const wrappedCode = `useEffect(() => {
    const ${varName} = ${nodeText};
    
    return () => {
      ${cleanupCode.replace(pattern.variableName || 'connection', varName)}
    };
  }, []);`;

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: wrappedCode,
    };
  }

  private addCleanupComment(
    node: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    const nodeText = this.getNodeText(node);
    const comment = `// Remember to cleanup: ${cleanupCode.replace(/\s+/g, ' ').trim()}`;

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: `${nodeText}; ${comment}`,
    };
  }

  private addToExistingCleanupFunction(
    returnStatement: ts.ReturnStatement,
    cleanupCode: string
  ): CodeTransformation {
    if (!returnStatement.expression) {
      throw new Error('Return statement has no expression');
    }

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
          replacement: `\n      ${cleanupCode}`,
        };
      }
    }

    throw new Error('Cannot add to existing cleanup function');
  }

  private getDefaultVariableName(connectionType: string): string {
    switch (connectionType) {
      case 'EventSource':
        return 'eventSource';
      case 'WebSocket':
        return 'webSocket';
      case 'Subscription':
        return 'unsubscribe';
      default:
        return 'connection';
    }
  }

  private generateFixDescription(pattern: ConnectionPattern): string {
    let description = '';

    switch (pattern.connectionType) {
      case 'EventSource':
        description = 'Added EventSource.close() cleanup';
        break;
      case 'WebSocket':
        description = 'Added WebSocket.close() cleanup';
        break;
      case 'Subscription':
        description = 'Added subscription unsubscribe cleanup';
        break;
    }

    if (!pattern.isAssigned) {
      description += ' with variable assignment';
    }

    if (!pattern.isInUseEffect && pattern.isInComponent) {
      description += ' wrapped in useEffect';
    }

    return description;
  }

  private calculateConfidence(pattern: ConnectionPattern): number {
    let confidence = 0.9;

    // Reduce confidence if not assigned to variable
    if (!pattern.isAssigned) {
      confidence -= 0.1;
    }

    // Reduce confidence for subscription patterns (more complex)
    if (pattern.connectionType === 'Subscription') {
      confidence -= 0.05;
    }

    // Reduce confidence if not in proper React context
    if (!pattern.isInUseEffect && !pattern.isInComponent) {
      confidence -= 0.2;
    }

    return Math.max(0.6, confidence);
  }

  private requiresManualReview(pattern: ConnectionPattern): boolean {
    // Requires manual review if:
    // 1. Not assigned to variable (we're creating one)
    // 2. Not in React context (unclear cleanup responsibility)
    // 3. Subscription pattern (more complex)
    return (
      !pattern.isAssigned ||
      (!pattern.isInUseEffect && !pattern.isInComponent) ||
      pattern.connectionType === 'Subscription'
    );
  }

  // Helper methods
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

  private isInUseEffect(container: ts.Node | null): boolean {
    if (!container) return false;

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

  private isInReactComponent(container: ts.Node | null): boolean {
    if (!container) return false;

    // Look for React component patterns
    let current = container;
    while (current) {
      if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current)) {
        // Check if function name starts with uppercase (React component convention)
        if (
          ts.isFunctionDeclaration(current) &&
          current.name &&
          ts.isIdentifier(current.name)
        ) {
          const name = current.name.text;
          if (name[0] === name[0].toUpperCase()) {
            return true;
          }
        }

        // Check for JSX return
        const hasJSXReturn = this.hasJSXReturn(current);
        if (hasJSXReturn) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  private hasJSXReturn(functionNode: ts.Node): boolean {
    let hasJSX = false;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        if (
          ts.isJsxElement(node.expression) ||
          ts.isJsxFragment(node.expression) ||
          ts.isJsxSelfClosingElement(node.expression)
        ) {
          hasJSX = true;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(functionNode);
    return hasJSX;
  }

  private hasExistingCleanup(container: ts.Node | null): boolean {
    if (!container) return false;

    let hasCleanup = false;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        if (
          ts.isArrowFunction(node.expression) ||
          ts.isFunctionExpression(node.expression)
        ) {
          hasCleanup = true;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(container);
    return hasCleanup;
  }

  private findReturnStatement(container: ts.Node): ts.ReturnStatement | null {
    let returnStatement: ts.ReturnStatement | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node)) {
        returnStatement = node;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(container);
    return returnStatement;
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

// Factory function
export function createConnectionCleanupFixGenerator(
  sourceCode: string,
  fileName: string
): ConnectionCleanupFixGenerator {
  return new ConnectionCleanupFixGenerator(sourceCode, fileName);
}
