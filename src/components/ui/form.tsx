'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useFieldValidation } from '@/lib/validation';
import { ValidationRule } from '@/lib/validation';

// Form field wrapper component
interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

// Form label component
interface FormLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

/**
 * Renders a label element with optional required indicator.
 */
export function FormLabel({
  children,
  htmlFor,
  required,
  className,
}: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
    >
      {children}
      {required && <span className='text-destructive ml-1'>*</span>}
    </label>
  );
}

// Form error message component
interface FormErrorMessageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders an error message if children are provided.
 */
export function FormErrorMessage({
  children,
  className,
}: FormErrorMessageProps) {
  if (!children) return null;

  return (
    <p className={cn('text-sm text-destructive', className)}>{children}</p>
  );
}

// Form description component
interface FormDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function FormDescription({ children, className }: FormDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
  );
}

// Validated input component
interface ValidatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  validation?: ValidationRule;
  validateOnChange?: boolean;
  error?: string;
  required?: boolean;
}

/**
 * Renders a validated input field with error handling and optional description.
 *
 * The function generates a unique field ID if none is provided, utilizes the useFieldValidation hook to manage validation state, and handles blur events to trigger validation. It conditionally displays a label, description, and error message based on the validation results and external error props.
 *
 * @param label - The label for the input field.
 * @param description - An optional description for the input field.
 * @param validation - Validation rules to apply to the input.
 * @param validateOnChange - A flag indicating whether to validate on change (default is true).
 * @param error - An external error message to display.
 * @param required - A flag indicating whether the input is required.
 * @param className - Additional CSS classes for styling the input.
 * @param id - An optional ID for the input field.
 * @param props - Additional props to pass to the input element.
 * @returns A JSX element representing the validated input field.
 */
export function ValidatedInput({
  label,
  description,
  validation,
  validateOnChange = true,
  error: externalError,
  required,
  className,
  id,
  ...props
}: ValidatedInputProps) {
  const fieldId = React.useMemo(
    () => id || `input-${Math.random().toString(36).substr(2, 9)}`,
    [id]
  );

  const {
    error: validationError,
    touched,
    validate,
    isValid,
  } = useFieldValidation(
    fieldId,
    props.value || '',
    validation || {},
    validateOnChange
  );

  const error = externalError || validationError;
  const hasError = touched && error;

  /**
   * Handles the blur event for an input element, validating if necessary.
   */
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (validation) {
      validate();
    }
    props.onBlur?.(e);
  };

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={fieldId} required={required}>
          {label}
        </FormLabel>
      )}
      {description && <FormDescription>{description}</FormDescription>}
      <input
        id={fieldId}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...props}
        onBlur={handleBlur}
      />
      <FormErrorMessage>{error}</FormErrorMessage>
    </FormField>
  );
}

// Validated textarea component
interface ValidatedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  validation?: ValidationRule;
  validateOnChange?: boolean;
  error?: string;
  required?: boolean;
}

/**
 * Renders a validated textarea component with error handling.
 *
 * This component utilizes the useFieldValidation hook to manage validation state and error messages. It generates a unique field ID if none is provided, and handles blur events to trigger validation. The textarea's appearance is conditionally styled based on validation results, and it displays any associated error messages.
 *
 * @param label - The label for the textarea.
 * @param description - Additional description for the textarea.
 * @param validation - Validation rules for the textarea.
 * @param validateOnChange - Flag to determine if validation should occur on change (default is true).
 * @param error - External error message to display.
 * @param required - Indicates if the textarea is required.
 * @param className - Additional CSS classes for styling.
 * @param id - Optional custom ID for the textarea.
 * @param props - Additional props to be passed to the textarea element.
 */
export function ValidatedTextarea({
  label,
  description,
  validation,
  validateOnChange = true,
  error: externalError,
  required,
  className,
  id,
  ...props
}: ValidatedTextareaProps) {
  const fieldId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  const {
    error: validationError,
    touched,
    validate,
    isValid,
  } = useFieldValidation(
    fieldId,
    props.value || '',
    validation || {},
    validateOnChange
  );

  const error = externalError || validationError;
  const hasError = touched && error;

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (validation) {
      validate();
    }
    props.onBlur?.(e);
  };

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={fieldId} required={required}>
          {label}
        </FormLabel>
      )}
      {description && <FormDescription>{description}</FormDescription>}
      <textarea
        id={fieldId}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...props}
        onBlur={handleBlur}
      />
      <FormErrorMessage>{error}</FormErrorMessage>
    </FormField>
  );
}

// Validated select component
interface ValidatedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  validation?: ValidationRule;
  validateOnChange?: boolean;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

/**
 * Renders a validated select input field with error handling.
 *
 * This component utilizes the useFieldValidation hook to manage validation state and error messages. It generates a unique field ID if none is provided, handles blur events to trigger validation, and displays error messages based on validation results or external errors. The select options are dynamically generated from the provided options array.
 *
 * @param label - The label for the select input.
 * @param description - Additional description for the select input.
 * @param validation - Validation rules for the select input.
 * @param validateOnChange - Flag to determine if validation should occur on change (default is true).
 * @param error - External error message to display.
 * @param required - Flag indicating if the field is required.
 * @param options - Array of options to display in the select input.
 * @param placeholder - Placeholder text for the select input.
 * @param className - Additional CSS classes for styling the select input.
 * @param id - Custom ID for the select input.
 * @param props - Additional props to pass to the select element.
 * @returns A JSX element representing the validated select input field.
 */
export function ValidatedSelect({
  label,
  description,
  validation,
  validateOnChange = true,
  error: externalError,
  required,
  options,
  placeholder,
  className,
  id,
  ...props
}: ValidatedSelectProps) {
  const fieldId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  const {
    error: validationError,
    touched,
    validate,
    isValid,
  } = useFieldValidation(
    fieldId,
    props.value || '',
    validation || {},
    validateOnChange
  );

  const error = externalError || validationError;
  const hasError = touched && error;

  /**
   * Handles the blur event for a select element, validating if necessary.
   */
  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    if (validation) {
      validate();
    }
    props.onBlur?.(e);
  };

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={fieldId} required={required}>
          {label}
        </FormLabel>
      )}
      {description && <FormDescription>{description}</FormDescription>}
      <select
        id={fieldId}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...props}
        onBlur={handleBlur}
      >
        {placeholder && (
          <option value='' disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <FormErrorMessage>{error}</FormErrorMessage>
    </FormField>
  );
}

// Form group component
interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({ children, className }: FormGroupProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

// Form actions component
interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a div containing form action elements with optional className.
 */
export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>{children}</div>
  );
}
