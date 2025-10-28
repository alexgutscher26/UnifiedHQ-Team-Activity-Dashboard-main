export interface ThemeColors {
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  accent: string;
  'accent-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  'sidebar-accent': string;
  'sidebar-accent-foreground': string;
}

export interface ThemeConfig {
  name: string;
  label: string;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

export const themes: Record<string, ThemeConfig> = {
  default: {
    name: 'default',
    label: 'Default',
    colors: {
      light: {
        primary: 'oklch(0.45 0.22 264)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.97 0 0)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.97 0 0)',
        'accent-foreground': 'oklch(0.205 0 0)',
        'sidebar-primary': 'oklch(0.45 0.22 264)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.97 0 0)',
        'sidebar-accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.65 0.25 264)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.269 0 0)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.269 0 0)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.65 0.25 264)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.269 0 0)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  ocean: {
    name: 'ocean',
    label: 'Ocean Blue',
    colors: {
      light: {
        primary: 'oklch(0.5 0.15 220)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.02 220)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.05 220)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.5 0.15 220)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.02 220)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.7 0.18 220)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.02 220)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.05 220)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.7 0.18 220)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.02 220)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  forest: {
    name: 'forest',
    label: 'Forest Green',
    colors: {
      light: {
        primary: 'oklch(0.45 0.15 140)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.02 140)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.05 140)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.45 0.15 140)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.02 140)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.65 0.18 140)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.02 140)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.05 140)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.65 0.18 140)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.02 140)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight Purple',
    colors: {
      light: {
        primary: 'oklch(0.4 0.2 300)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.02 300)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.05 300)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.4 0.2 300)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.02 300)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.6 0.22 300)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.02 300)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.05 300)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.6 0.22 300)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.02 300)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  sunset: {
    name: 'sunset',
    label: 'Sunset Orange',
    colors: {
      light: {
        primary: 'oklch(0.55 0.18 45)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.02 45)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.05 45)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.55 0.18 45)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.02 45)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.7 0.2 45)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.02 45)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.05 45)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.7 0.2 45)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.02 45)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  rose: {
    name: 'rose',
    label: 'Rose Pink',
    colors: {
      light: {
        primary: 'oklch(0.5 0.15 350)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.02 350)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.05 350)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.5 0.15 350)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.02 350)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.65 0.18 350)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.02 350)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.05 350)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.65 0.18 350)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.02 350)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
  slate: {
    name: 'slate',
    label: 'Slate Gray',
    colors: {
      light: {
        primary: 'oklch(0.4 0.02 240)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.95 0.01 240)',
        'secondary-foreground': 'oklch(0.2 0 0)',
        accent: 'oklch(0.9 0.01 240)',
        'accent-foreground': 'oklch(0.2 0 0)',
        'sidebar-primary': 'oklch(0.4 0.02 240)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.95 0.01 240)',
        'sidebar-accent-foreground': 'oklch(0.2 0 0)',
      },
      dark: {
        primary: 'oklch(0.6 0.02 240)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.25 0.01 240)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.3 0.01 240)',
        'accent-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.6 0.02 240)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.25 0.01 240)',
        'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      },
    },
  },
};

export function getTheme(name: string): ThemeConfig | undefined {
  return themes[name];
}

export function getAllThemes(): ThemeConfig[] {
  return Object.values(themes);
}

export function getDefaultTheme(): ThemeConfig {
  return themes.default;
}
