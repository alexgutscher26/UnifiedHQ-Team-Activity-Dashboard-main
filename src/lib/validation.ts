// Validation utilities and schemas for form inputs
import React from 'react';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  email?: boolean;
  url?: boolean;
  numeric?: boolean;
  positive?: boolean;
  integer?: boolean;
}

export class Validator {
  public rules: Record<string, ValidationRule> = {};
  private customMessages: Record<string, string> = {};

  /**
   * Adds a validation rule for a specified field with an optional custom message.
   */
  addRule(field: string, rule: ValidationRule, message?: string) {
    this.rules[field] = rule;
    if (message) {
      this.customMessages[field] = message;
    }
    return this;
  }

  validate(data: Record<string, any>): ValidationResult {
    const errors: Record<string, string> = {};

    for (const [field, value] of Object.entries(data)) {
      const rule = this.rules[field];
      if (!rule) continue;

      const error = this.validateField(field, value, rule);
      if (error) {
        errors[field] = error;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validates a field based on specified rules and returns an error message if validation fails.
   *
   * The function checks for required fields, minimum and maximum length, pattern matching, email and URL validity, numeric checks, positive number constraints, integer validation, and any custom validation rules. It returns a custom message if validation fails or null if the value is valid.
   *
   * @param field - The name of the field being validated.
   * @param value - The value to validate against the rules.
   * @param rule - The validation rules to apply.
   * @returns A string containing the error message if validation fails, or null if the value is valid.
   */
  private validateField(
    field: string,
    value: any,
    rule: ValidationRule
  ): string | null {
    // Required validation
    if (
      rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} is required`
      );
    }

    // Skip other validations if value is empty and not required
    if (
      !rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return null;
    }

    const stringValue = String(value).trim();

    // Min length validation
    if (rule.minLength && stringValue.length < rule.minLength) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be at least ${rule.minLength} characters`
      );
    }

    // Max length validation
    if (rule.maxLength && stringValue.length > rule.maxLength) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be no more than ${rule.maxLength} characters`
      );
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} format is invalid`
      );
    }

    // Email validation
    if (rule.email && !this.isValidEmail(stringValue)) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be a valid email address`
      );
    }

    // URL validation
    if (rule.url && !this.isValidUrl(stringValue)) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be a valid URL`
      );
    }

    // Numeric validation
    if (rule.numeric && isNaN(Number(value))) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be a number`
      );
    }

    // Positive number validation
    if (rule.positive && Number(value) <= 0) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be a positive number`
      );
    }

    // Integer validation
    if (rule.integer && !Number.isInteger(Number(value))) {
      return (
        this.customMessages[field] ||
        `${this.formatFieldName(field)} must be a whole number`
      );
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        return this.customMessages[field] || customError;
      }
    }

    return null;
  }

  /**
   * Formats a field name by adding spaces before capital letters and capitalizing the first letter.
   */
  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Validates if the provided email string is in a correct format.
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Checks if the provided URL is valid.
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Predefined validation schemas
export const validationSchemas = {
  // Authentication schemas
  signIn: new Validator()
    .addRule(
      'email',
      { required: true, email: true },
      'Please enter a valid email address'
    )
    .addRule(
      'password',
      { required: true, minLength: 6 },
      'Password must be at least 6 characters'
    ),

  signUp: new Validator()
    .addRule(
      'name',
      { required: true, minLength: 2, maxLength: 50 },
      'Name must be 2-50 characters'
    )
    .addRule(
      'email',
      { required: true, email: true },
      'Please enter a valid email address'
    )
    .addRule(
      'password',
      {
        required: true,
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        custom: value => {
          if (value && value.length < 8)
            return 'Password must be at least 8 characters';
          if (value && !/(?=.*[a-z])/.test(value))
            return 'Password must contain at least one lowercase letter';
          if (value && !/(?=.*[A-Z])/.test(value))
            return 'Password must contain at least one uppercase letter';
          if (value && !/(?=.*\d)/.test(value))
            return 'Password must contain at least one number';
          return null;
        },
      },
      'Password must be at least 8 characters with uppercase, lowercase, and number'
    )
    .addRule(
      'confirmPassword',
      { required: true },
      'Please confirm your password'
    ),

  // GitHub integration schemas
  githubRepo: new Validator()
    .addRule(
      'owner',
      { required: true, minLength: 1, maxLength: 100 },
      'Repository owner is required'
    )
    .addRule(
      'repo',
      { required: true, minLength: 1, maxLength: 100 },
      'Repository name is required'
    )
    .addRule(
      'branch',
      { required: false, maxLength: 100 },
      'Branch name is too long'
    ),

  // User preferences schemas
  userPreferences: new Validator()
    .addRule(
      'githubRepoId',
      { required: false, numeric: true, positive: true },
      'Repository ID must be a positive number'
    )
    .addRule(
      'githubOwner',
      { required: false, minLength: 1, maxLength: 100 },
      'Owner name must be 1-100 characters'
    )
    .addRule(
      'githubRepo',
      { required: false, minLength: 1, maxLength: 100 },
      'Repository name must be 1-100 characters'
    )
    .addRule(
      'slackToken',
      { required: false, minLength: 20 },
      'Slack token must be at least 20 characters'
    ),

  // General form schemas
  requiredField: new Validator().addRule(
    'value',
    { required: true },
    'This field is required'
  ),

  email: new Validator().addRule(
    'email',
    { required: true, email: true },
    'Please enter a valid email address'
  ),

  password: new Validator().addRule(
    'password',
    {
      required: true,
      minLength: 8,
      custom: value => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])/.test(value))
          return 'Password must contain at least one lowercase letter';
        if (!/(?=.*[A-Z])/.test(value))
          return 'Password must contain at least one uppercase letter';
        if (!/(?=.*\d)/.test(value))
          return 'Password must contain at least one number';
        return null;
      },
    },
    'Password must be at least 8 characters with uppercase, lowercase, and number'
  ),
};

// Utility functions
/**
 * Validates the given form data against a schema.
 */
export function validateFormData<T extends Record<string, any>>(
  data: T,
  schema: Validator
): ValidationResult {
  return schema.validate(data);
}

/**
 * Validates a field against specified rules and returns any validation errors.
 */
export function validateField(
  field: string,
  value: any,
  rules: ValidationRule
): string | null {
  const validator = new Validator();
  validator.addRule(field, rules);
  const result = validator.validate({ [field]: value });
  return result.errors[field] || null;
}

// Real-time validation hook
/**
 * Custom hook for field validation in a form.
 */
export function useFieldValidation(
  field: string,
  value: any,
  rules: ValidationRule,
  validateOnChange: boolean = true
) {
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);

  // Memoize the rules to prevent infinite re-renders
  const memoizedRules = React.useMemo(() => rules, [JSON.stringify(rules)]);

  React.useEffect(() => {
    if (validateOnChange && touched) {
      const fieldError = validateField(field, value, memoizedRules);
      setError(fieldError);
    }
  }, [field, value, memoizedRules, validateOnChange, touched]);

  /**
   * Validates a field and sets the error state.
   */
  const validate = () => {
    setTouched(true);
    const fieldError = validateField(field, value, rules);
    setError(fieldError);
    return fieldError === null;
  };

  const reset = () => {
    setError(null);
    setTouched(false);
  };

  return {
    error,
    touched,
    validate,
    reset,
    isValid: error === null,
  };
}

// Form validation hook
/**
 * Custom hook for managing form validation and state.
 *
 * This hook initializes form data, tracks field errors and touched states, and provides methods to update fields, validate individual fields or the entire form, reset the form state, and check field and form validity. It leverages a provided schema for validation and maintains the state of the form data, errors, and touched fields.
 *
 * @param initialData - The initial state of the form data.
 * @param schema - The validation schema used to validate the form fields.
 * @returns An object containing the form data, errors, touched fields, and methods for updating fields, validating fields and the form, resetting the form, and checking validity.
 */
export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  schema: Validator
) {
  const [data, setData] = React.useState<T>(initialData);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const updateField = (field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validateField = (field: keyof T) => {
    const result = schema.validate({ [field]: data[field] });
    const fieldError = result.errors[field as string];
    setErrors(prev => ({ ...prev, [field]: fieldError || '' }));
    return fieldError === null;
  };

  /**
   * Validates the form data and sets error states.
   */
  const validateForm = () => {
    const result = schema.validate(data);
    setErrors(result.errors);
    setTouched(
      Object.keys(data).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );
    return result.isValid;
  };

  const reset = () => {
    setData(initialData);
    setErrors({});
    setTouched({});
  };

  /**
   * Returns the error message for a specified field if it has been touched.
   */
  const getFieldError = (field: keyof T) => {
    return touched[field as string] ? errors[field as string] : '';
  };

  /**
   * Checks if a form field is valid based on its touched and error status.
   */
  const isFieldValid = (field: keyof T) => {
    return !touched[field as string] || !errors[field as string];
  };

  /**
   * Checks if the form is valid by ensuring there are no errors.
   */
  const isFormValid = () => {
    return Object.values(errors).every(error => !error);
  };

  return {
    data,
    errors,
    touched,
    updateField,
    validateField,
    validateForm,
    reset,
    getFieldError,
    isFieldValid,
    isFormValid,
  };
}
