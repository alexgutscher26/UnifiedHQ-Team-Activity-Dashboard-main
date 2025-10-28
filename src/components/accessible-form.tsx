'use client';

import React, { forwardRef, useId } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useAriaLiveAnnouncer } from '@/hooks/use-accessibility';

interface AccessibleFormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders an accessible form field with a label, description, and error message.
 *
 * This component utilizes React's `useId` to generate unique IDs for the label, description, and error elements.
 * It conditionally displays the description and error message based on the provided props. The `children` prop is
 * cloned to include accessibility attributes such as `aria-describedby`, `aria-invalid`, and `aria-required`.
 *
 * @param {Object} props - The properties for the AccessibleFormField component.
 * @param {string} props.label - The label for the form field.
 * @param {string} [props.description] - An optional description for the form field.
 * @param {string} [props.error] - An optional error message for the form field.
 * @param {boolean} [props.required] - Indicates if the field is required.
 * @param {React.ReactNode} props.children - The child elements to be rendered within the form field.
 * @param {string} [props.className] - Additional class names for styling.
 */
export const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  label,
  description,
  error,
  required,
  children,
  className,
}) => {
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  return (
    <div className={cn('space-y-2', className)}>
      <Label
        htmlFor={id}
        className={cn(
          required && 'after:content-["*"] after:text-red-500 after:ml-1'
        )}
      >
        {label}
      </Label>
      {description && (
        <p id={descriptionId} className='text-sm text-muted-foreground'>
          {description}
        </p>
      )}
      {React.cloneElement(
        children as React.ReactElement,
        {
          id,
          'aria-describedby': cn(
            description && descriptionId,
            error && errorId
          ),
          'aria-invalid': !!error,
          'aria-required': required,
        } as any
      )}
      {error && (
        <p id={errorId} className='text-sm text-red-500' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};

interface AccessibleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  announceOnChange?: boolean;
}

export const AccessibleInput = forwardRef<
  HTMLInputElement,
  AccessibleInputProps
>(
  (
    {
      label,
      description,
      error,
      required,
      announceOnChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const { announce } = useAriaLiveAnnouncer();

    /**
     * Handles input change events and optionally announces the change.
     */
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (announceOnChange) {
        announce(`Input changed to: ${event.target.value}`);
      }
      onChange?.(event);
    };

    return (
      <AccessibleFormField
        label={label}
        description={description}
        error={error}
        required={required}
      >
        <Input ref={ref} onChange={handleChange} {...props} />
      </AccessibleFormField>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

interface AccessibleTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  announceOnChange?: boolean;
}

export const AccessibleTextarea = forwardRef<
  HTMLTextAreaElement,
  AccessibleTextareaProps
>(
  (
    {
      label,
      description,
      error,
      required,
      announceOnChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const { announce } = useAriaLiveAnnouncer();

    /**
     * Handles changes in a textarea and optionally announces the change.
     */
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (announceOnChange) {
        announce(`Textarea changed to: ${event.target.value}`);
      }
      onChange?.(event);
    };

    return (
      <AccessibleFormField
        label={label}
        description={description}
        error={error}
        required={required}
      >
        <Textarea ref={ref} onChange={handleChange} {...props} />
      </AccessibleFormField>
    );
  }
);

AccessibleTextarea.displayName = 'AccessibleTextarea';

interface AccessibleSelectProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  announceOnChange?: boolean;
}

/**
 * Renders an accessible select component with support for live announcements.
 *
 * This component utilizes the useAriaLiveAnnouncer to announce the selected option when the value changes,
 * provided the announceOnChange prop is true. It also manages the rendering of the select field,
 * including its label, description, error state, and required status. The options are dynamically generated
 * from the provided options array, ensuring that each option is represented correctly.
 *
 * @param {Object} props - The properties for the AccessibleSelect component.
 * @param {string} props.label - The label for the select field.
 * @param {string} [props.description] - An optional description for the select field.
 * @param {string} [props.error] - An optional error message for the select field.
 * @param {boolean} [props.required] - Indicates if the select field is required.
 * @param {Array<{ value: string, label: string, disabled?: boolean }>} props.options - The options for the select field.
 * @param {string} props.value - The current value of the select field.
 * @param {function} props.onValueChange - Callback function to handle value changes.
 * @param {string} [props.placeholder] - An optional placeholder for the select field.
 * @param {boolean} [props.announceOnChange] - Indicates if changes should be announced.
 */
export const AccessibleSelect: React.FC<AccessibleSelectProps> = ({
  label,
  description,
  error,
  required,
  options,
  value,
  onValueChange,
  placeholder,
  announceOnChange,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  const handleValueChange = (newValue: string) => {
    if (announceOnChange) {
      const selectedOption = options.find(option => option.value === newValue);
      announce(`Selected: ${selectedOption?.label || newValue}`);
    }
    onValueChange?.(newValue);
  };

  return (
    <AccessibleFormField
      label={label}
      description={description}
      error={error}
      required={required}
    >
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          aria-required={required}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AccessibleFormField>
  );
};

interface AccessibleCheckboxProps {
  label: string;
  description?: string;
  error?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  announceOnChange?: boolean;
}

/**
 * Renders an accessible checkbox component with associated label, description, and error message.
 *
 * This component utilizes the useAriaLiveAnnouncer for announcing changes in the checkbox state.
 * It generates unique IDs for the checkbox, description, and error elements using useId.
 * The handleCheckedChange function manages the checkbox state and triggers announcements if required.
 * The component conditionally renders the description and error messages based on the provided props.
 *
 * @param {Object} props - The properties for the AccessibleCheckbox component.
 * @param {string} props.label - The label for the checkbox.
 * @param {string} [props.description] - An optional description for the checkbox.
 * @param {string} [props.error] - An optional error message to display.
 * @param {boolean} props.checked - The current checked state of the checkbox.
 * @param {function} props.onCheckedChange - Callback function to handle changes in the checked state.
 * @param {boolean} [props.required] - Indicates if the checkbox is required.
 * @param {boolean} [props.announceOnChange] - Determines if changes should be announced.
 */
export const AccessibleCheckbox: React.FC<AccessibleCheckboxProps> = ({
  label,
  description,
  error,
  checked,
  onCheckedChange,
  required,
  announceOnChange,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  /**
   * Handles the change of a checked state and announces the change if required.
   */
  const handleCheckedChange = (newChecked: boolean) => {
    if (announceOnChange) {
      announce(`${label} ${newChecked ? 'checked' : 'unchecked'}`);
    }
    onCheckedChange?.(newChecked);
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center space-x-2'>
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={handleCheckedChange}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          aria-required={required}
        />
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            required && 'after:content-["*"] after:text-red-500 after:ml-1'
          )}
        >
          {label}
        </Label>
      </div>
      {description && (
        <p id={descriptionId} className='text-sm text-muted-foreground'>
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className='text-sm text-red-500' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};

interface AccessibleRadioGroupProps {
  label: string;
  description?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  announceOnChange?: boolean;
}

/**
 * Renders an accessible radio group component with support for live announcements.
 *
 * This component displays a set of radio buttons based on the provided options. It handles value changes by announcing the selected option if `announceOnChange` is true. The component also manages accessibility attributes such as aria-describedby and aria-invalid based on the presence of description and error messages.
 *
 * @param label - The label for the radio group.
 * @param description - An optional description for the radio group.
 * @param error - An optional error message to display.
 * @param options - An array of options for the radio buttons, each containing a value and label.
 * @param value - The currently selected value of the radio group.
 * @param onValueChange - A callback function that is called when the value changes.
 * @param required - A boolean indicating if the radio group is required.
 * @param announceOnChange - A boolean indicating if the selection change should be announced.
 * @returns A React element representing the accessible radio group.
 */
export const AccessibleRadioGroup: React.FC<AccessibleRadioGroupProps> = ({
  label,
  description,
  error,
  options,
  value,
  onValueChange,
  required,
  announceOnChange,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  /**
   * Handles the change of a value and announces the selection if required.
   *
   * This function checks if announcements are enabled through the `announceOnChange` flag.
   * If enabled, it finds the corresponding option from the `options` array based on the `newValue`
   * and announces the selected option's label. Finally, it invokes the `onValueChange` callback
   * with the new value if it exists.
   *
   * @param newValue - The new value that has been selected.
   */
  const handleValueChange = (newValue: string) => {
    if (announceOnChange) {
      const selectedOption = options.find(option => option.value === newValue);
      announce(`Selected: ${selectedOption?.label || newValue}`);
    }
    onValueChange?.(newValue);
  };

  return (
    <div className='space-y-2'>
      <fieldset>
        <legend className='text-sm font-medium leading-none'>
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </legend>
        {description && (
          <p id={descriptionId} className='text-sm text-muted-foreground mt-1'>
            {description}
          </p>
        )}
        <RadioGroup
          value={value}
          onValueChange={handleValueChange}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          aria-required={required}
          className='mt-2'
        >
          {options.map(option => (
            <div key={option.value} className='flex items-center space-x-2'>
              <RadioGroupItem
                value={option.value}
                id={`${id}-${option.value}`}
                disabled={option.disabled}
              />
              <Label htmlFor={`${id}-${option.value}`} className='text-sm'>
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {error && (
          <p id={errorId} className='text-sm text-red-500 mt-1' role='alert'>
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
};

interface AccessibleSwitchProps {
  label: string;
  description?: string;
  error?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  announceOnChange?: boolean;
}

/**
 * Renders an accessible switch component with optional label, description, and error message.
 *
 * This component utilizes the useAriaLiveAnnouncer to announce changes in the switch state.
 * It manages the checked state through the handleCheckedChange function, which triggers an announcement
 * if announceOnChange is true. The component also conditionally renders a description and error message
 * based on the provided props.
 *
 * @param {Object} props - The properties for the AccessibleSwitch component.
 * @param {string} props.label - The label for the switch.
 * @param {string} [props.description] - An optional description for the switch.
 * @param {string} [props.error] - An optional error message to display.
 * @param {boolean} props.checked - The current checked state of the switch.
 * @param {function} props.onCheckedChange - Callback function to handle changes in the checked state.
 * @param {boolean} [props.required] - Indicates if the switch is required.
 * @param {boolean} [props.announceOnChange] - Determines if changes should be announced.
 */
export const AccessibleSwitch: React.FC<AccessibleSwitchProps> = ({
  label,
  description,
  error,
  checked,
  onCheckedChange,
  required,
  announceOnChange,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  /**
   * Handles the change of a checked state and announces the change if required.
   */
  const handleCheckedChange = (newChecked: boolean) => {
    if (announceOnChange) {
      announce(`${label} ${newChecked ? 'enabled' : 'disabled'}`);
    }
    onCheckedChange?.(newChecked);
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center space-x-2'>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={handleCheckedChange}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          aria-required={required}
        />
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            required && 'after:content-["*"] after:text-red-500 after:ml-1'
          )}
        >
          {label}
        </Label>
      </div>
      {description && (
        <p id={descriptionId} className='text-sm text-muted-foreground'>
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className='text-sm text-red-500' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};

interface AccessibleSliderProps {
  label: string;
  description?: string;
  error?: string;
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  announceOnChange?: boolean;
}

/**
 * A React functional component that renders an accessible slider.
 *
 * This component allows users to select a value within a specified range. It utilizes ARIA attributes for accessibility and can announce value changes if specified. The component handles value changes through the `onValueChange` callback and displays error messages if provided. It also conditionally renders a description and the current value of the slider.
 *
 * @param label - The label for the slider.
 * @param description - An optional description for the slider.
 * @param error - An optional error message to display.
 * @param value - The current value of the slider.
 * @param onValueChange - Callback function to handle value changes.
 * @param min - The minimum value of the slider (default is 0).
 * @param max - The maximum value of the slider (default is 100).
 * @param step - The step value for the slider (default is 1).
 * @param required - Indicates if the slider is required.
 * @param announceOnChange - Indicates if changes should be announced.
 * @returns A JSX element representing the accessible slider.
 */
export const AccessibleSlider: React.FC<AccessibleSliderProps> = ({
  label,
  description,
  error,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  required,
  announceOnChange,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const id = useId();
  const descriptionId = useId();
  const errorId = useId();

  /**
   * Handles the change of slider value and announces it if required.
   */
  const handleValueChange = (newValue: number[]) => {
    if (announceOnChange) {
      announce(`Slider value changed to: ${newValue[0]}`);
    }
    onValueChange?.(newValue);
  };

  return (
    <div className='space-y-2'>
      <Label
        htmlFor={id}
        className={cn(
          'text-sm font-medium leading-none',
          required && 'after:content-["*"] after:text-red-500 after:ml-1'
        )}
      >
        {label}
      </Label>
      {description && (
        <p id={descriptionId} className='text-sm text-muted-foreground'>
          {description}
        </p>
      )}
      <Slider
        id={id}
        value={value}
        onValueChange={handleValueChange}
        min={min}
        max={max}
        step={step}
        aria-describedby={cn(description && descriptionId, error && errorId)}
        aria-invalid={!!error}
        aria-required={required}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value?.[0] || min}
        className='w-full'
      />
      {value && (
        <div className='text-sm text-muted-foreground'>
          Current value: {value[0]}
        </div>
      )}
      {error && (
        <p id={errorId} className='text-sm text-red-500' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
