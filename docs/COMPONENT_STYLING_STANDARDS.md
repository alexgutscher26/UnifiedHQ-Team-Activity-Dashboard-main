# Component Styling Standards

## Overview
This document defines consistent styling patterns and standards for all components in the application to ensure visual consistency and maintainability.

## Design System Principles

### 1. Spacing System
Use consistent spacing values based on Tailwind's spacing scale:

- **Container spacing**: `space-y-4` (16px) for main content areas
- **Card spacing**: `space-y-2` (8px) for card content
- **Form spacing**: `space-y-2` (8px) for form fields
- **List spacing**: `space-y-2` (8px) for list items
- **Section spacing**: `space-y-6` (24px) for major sections

### 2. Gap System
Use consistent gap values for flexbox and grid layouts:

- **Small gaps**: `gap-2` (8px) for tight layouts
- **Medium gaps**: `gap-4` (16px) for standard layouts
- **Large gaps**: `gap-6` (24px) for spacious layouts

### 3. Padding System
Use consistent padding values:

- **Card content**: `p-4` (16px) for standard card content
- **Alert boxes**: `p-3` (12px) for alert/info boxes
- **Button padding**: Use component variants (sm, default, lg)
- **Form padding**: `px-3 py-2` for form inputs

### 4. Border Radius System
Use consistent border radius values:

- **Standard elements**: `rounded-md` (6px) for buttons, inputs, cards
- **Large elements**: `rounded-lg` (8px) for containers, modals
- **Small elements**: `rounded` (4px) for badges, small components
- **Full radius**: `rounded-full` for avatars, pills

### 5. Typography System
Use consistent text sizing:

- **Headings**: `text-lg` (18px) for card titles, `text-2xl` (24px) for page titles
- **Body text**: `text-sm` (14px) for descriptions, `text-base` (16px) for main content
- **Small text**: `text-xs` (12px) for metadata, timestamps
- **Large text**: `text-4xl` (36px) for hero numbers, scores

### 6. Color System
Use semantic color classes:

- **Success states**: `text-green-600`, `bg-green-50`, `border-green-200`
- **Error states**: `text-red-600`, `bg-red-50`, `border-red-200`
- **Warning states**: `text-yellow-600`, `bg-yellow-50`, `border-yellow-200`
- **Info states**: `text-blue-600`, `bg-blue-50`, `border-blue-200`
- **Muted text**: `text-muted-foreground` for secondary information

## Component-Specific Standards

### Cards
```tsx
// Standard card structure
<Card>
  <CardHeader>
    <CardTitle className="text-lg">Title</CardTitle>
    <CardDescription className="text-sm text-muted-foreground">
      Description
    </CardDescription>
  </CardHeader>
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>
```

### Buttons
```tsx
// Use consistent button variants
<Button variant="default" size="default">Primary Action</Button>
<Button variant="outline" size="sm">Secondary Action</Button>
<Button variant="ghost" size="sm">Tertiary Action</Button>
```

### Forms
```tsx
// Standard form field structure
<div className="space-y-2">
  <Label htmlFor="field">Field Label</Label>
  <Input id="field" />
  <p className="text-sm text-muted-foreground">Helper text</p>
</div>
```

### Lists
```tsx
// Standard list structure
<ul className="space-y-2">
  <li className="flex items-start gap-2">
    <Icon className="size-4 mt-0.5 flex-shrink-0" />
    <span className="text-sm">List item</span>
  </li>
</ul>
```

### Alert/Info Boxes
```tsx
// Standard alert structure
<div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
  <Icon className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
  <span className="text-sm text-blue-800">Alert message</span>
</div>
```

### Grid Layouts
```tsx
// Standard grid patterns
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Grid items */}
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Dashboard cards */}
</div>
```

## Icon Standards

### Icon Sizing
- **Small icons**: `size-4` (16px) for inline icons
- **Medium icons**: `size-5` (20px) for card headers
- **Large icons**: `size-6` (24px) for prominent displays

### Icon Positioning
- **Flex items**: `flex-shrink-0` to prevent icon distortion
- **Vertical alignment**: `mt-0.5` for slight adjustment with text
- **Gap spacing**: `gap-2` between icon and text

## Responsive Design

### Breakpoint Usage
- **Mobile first**: Design for mobile, enhance for larger screens
- **Standard breakpoints**: `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- **Container queries**: Use `@container` for component-level responsive design

### Common Responsive Patterns
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">

// Responsive spacing
<div className="space-y-4 md:space-y-6">
```

## Dark Mode Support

### Color Classes
- Use semantic color classes that support dark mode
- Avoid hardcoded colors like `text-gray-900`
- Use `text-foreground`, `text-muted-foreground` for text
- Use `bg-background`, `bg-card` for backgrounds

### Dark Mode Examples
```tsx
// Good - supports dark mode
<div className="bg-card text-card-foreground border">

// Avoid - hardcoded colors
<div className="bg-white text-gray-900 border-gray-200">
```

## Animation Standards

### Transitions
- **Standard duration**: `transition-colors` for color changes
- **Hover effects**: `hover:bg-accent hover:text-accent-foreground`
- **Focus states**: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`

### Loading States
- **Skeleton loading**: Use `LoadingSkeleton` component
- **Spinner**: Use `IconLoader2` with `animate-spin`
- **Pulse effect**: Use `animate-pulse` for subtle loading

## Accessibility Standards

### Focus Management
- **Visible focus**: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- **Invalid states**: `aria-invalid:ring-destructive/20`
- **Disabled states**: `disabled:opacity-50 disabled:pointer-events-none`

### ARIA Support
- **Required fields**: `aria-required="true"`
- **Error states**: `aria-invalid="true"` with `role="alert"`
- **Descriptions**: Use `aria-describedby` for form field descriptions

## Performance Considerations

### CSS Classes
- **Minimize custom classes**: Use Tailwind utilities when possible
- **Consistent patterns**: Reduce CSS bundle size through repetition
- **Component variants**: Use `cva` for complex component styling

### Image Optimization
- **Use OptimizedImage**: Always use the custom image component
- **Proper sizing**: Provide width and height for layout stability
- **Lazy loading**: Use `lazy={true}` for below-the-fold images

## Code Examples

### Consistent Component Structure
```tsx
export function ExampleComponent({ title, description, children }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm text-muted-foreground">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Consistent List Structure
```tsx
function ExampleList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <IconCheck className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{item}</span>
        </li>
      ))}
    </ul>
  );
}
```

## Migration Guidelines

### When Updating Components
1. **Audit existing styles**: Check for hardcoded values
2. **Apply standards**: Replace with semantic classes
3. **Test responsiveness**: Ensure mobile-first design
4. **Verify accessibility**: Check focus states and ARIA attributes
5. **Test dark mode**: Ensure proper color contrast

### Common Migrations
```tsx
// Before
<div className="bg-white text-gray-900 p-4 rounded-lg">

// After
<div className="bg-card text-card-foreground p-4 rounded-md">

// Before
<div className="space-y-3">

// After
<div className="space-y-4">

// Before
<button className="px-4 py-2 bg-blue-500 text-white rounded">

// After
<Button variant="default">Button</Button>
```

## Enforcement

### Linting Rules
- Use ESLint rules to enforce consistent patterns
- Prefer Tailwind utilities over custom CSS
- Require semantic color classes

### Code Review Checklist
- [ ] Consistent spacing using standard values
- [ ] Proper responsive breakpoints
- [ ] Dark mode support
- [ ] Accessibility attributes
- [ ] Semantic color usage
- [ ] Consistent component structure

## Tools and Resources

### Development Tools
- **Tailwind CSS IntelliSense**: VS Code extension for autocomplete
- **Headless UI**: Accessible component primitives
- **Radix UI**: Unstyled, accessible components
- **Lucide React**: Consistent icon library

### Design Resources
- **Tailwind UI**: Component examples and patterns
- **Headless UI**: Accessible component patterns
- **Radix Colors**: Semantic color system

This style guide should be followed by all developers and updated as the design system evolves.
