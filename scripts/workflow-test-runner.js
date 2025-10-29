#!/usr/bin/env node

/**
 * Comprehensive Workflow Test Runner
 *
 * This script provides a unified interface for running all workflow tests,
 * validations, and requirements checks. It integrates all testing utilities
 * into a single comprehensive testing suite.
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, exists