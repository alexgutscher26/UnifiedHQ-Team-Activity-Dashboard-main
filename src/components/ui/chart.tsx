'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/lib/utils';

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

/**
 * Retrieves the ChartContext, ensuring it is used within a <ChartContainer />.
 */
function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

/**
 * A component that renders a chart container with a unique ID and configuration.
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot='chart'
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/**
 * Sanitizes a CSS color value to prevent XSS attacks
 */
function sanitizeColor(color: string): string | null {
  if (typeof color !== 'string') {
    return null;
  }

  // Allow hex colors, rgb/rgba, hsl/hsla, and named colors
  const colorRegex =
    /^(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)$/;

  if (!colorRegex.test(color.trim())) {
    console.warn(`Invalid color value detected and sanitized: ${color}`);
    return null;
  }

  return color.trim();
}

/**
 * Sanitizes a CSS property key to prevent injection attacks
 */
function sanitizeKey(key: string): string | null {
  if (typeof key !== 'string') {
    return null;
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  const keyRegex = /^[a-zA-Z0-9_-]+$/;

  if (!keyRegex.test(key)) {
    console.warn(`Invalid CSS key detected and sanitized: ${key}`);
    return null;
  }

  return key;
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  );

  if (!colorConfig.length) {
    return null;
  }

  // Sanitize the chart ID to prevent CSS injection
  const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');

  if (!sanitizedId) {
    console.warn('Invalid chart ID provided');
    return null;
  }

  const cssContent = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9._-\s]/g, '');

      const cssRules = colorConfig
        .map(([key, itemConfig]) => {
          const sanitizedKey = sanitizeKey(key);
          if (!sanitizedKey) {
            return null;
          }

          const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
            itemConfig.color;

          if (!color) {
            return null;
          }

          const sanitizedColor = sanitizeColor(color);
          if (!sanitizedColor) {
            return null;
          }

          return `  --color-${sanitizedKey}: ${sanitizedColor};`;
        })
        .filter(Boolean)
        .join('\n');

      if (!cssRules) {
        return null;
      }

      return `${sanitizedPrefix} [data-chart="${sanitizedId}"] {\n${cssRules}\n}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!cssContent) {
    return null;
  }

  return (
    <style
      // Using dangerouslySetInnerHTML for dynamic CSS generation is necessary for chart theming.
      // Security measures: All inputs are sanitized using regex validation to prevent XSS attacks.
      // - Chart ID is sanitized to alphanumeric + hyphens/underscores only
      // - CSS keys are validated against safe character set
      // - Color values are validated against CSS color format regex
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: cssContent,
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * Renders the content of a chart tooltip based on the provided data.
 *
 * This function utilizes React hooks and memoization to efficiently display tooltip information. It checks if the tooltip is active and if there is payload data to display. The tooltip label is formatted based on the provided labelFormatter and other configurations. Each item in the payload is rendered with its corresponding indicator and value, allowing for customization based on the indicator type and additional props.
 *
 * @param active - Indicates whether the tooltip is active.
 * @param payload - The data to be displayed in the tooltip.
 * @param className - Additional class names for styling the tooltip.
 * @param indicator - The type of indicator to display (line, dot, or dashed).
 * @param hideLabel - Flag to hide the label in the tooltip.
 * @param hideIndicator - Flag to hide the indicator in the tooltip.
 * @param label - The label to display in the tooltip.
 * @param labelFormatter - A function to format the label.
 * @param labelClassName - Additional class names for styling the label.
 * @param formatter - A function to format the item values.
 * @param color - The color of the indicator.
 * @param nameKey - The key to access the name in the payload.
 * @param labelKey - The key to access the label in the payload.
 * @returns A JSX element representing the tooltip content or null if not active.
 */
function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<'div'> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: 'line' | 'dot' | 'dashed';
    nameKey?: string;
    labelKey?: string;
  }) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || 'value'}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === 'string'
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn('font-medium', labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn('font-medium', labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot';

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className='grid gap-1.5'>
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor = color || item.payload.fill || item.color;

          return (
            <div
              key={item.dataKey}
              className={cn(
                '[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
                indicator === 'dot' && 'items-center'
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                          {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent':
                              indicator === 'dashed',
                            'my-0.5': nestLabel && indicator === 'dashed',
                          }
                        )}
                        style={
                          {
                            '--color-bg': indicatorColor,
                            '--color-border': indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      'flex flex-1 justify-between leading-none',
                      nestLabel ? 'items-end' : 'items-center'
                    )}
                  >
                    <div className='grid gap-1.5'>
                      {nestLabel ? tooltipLabel : null}
                      <span className='text-muted-foreground'>
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {item.value && (
                      <span className='text-foreground font-mono font-medium tabular-nums'>
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

/**
 * Renders a legend for a chart based on the provided payload.
 *
 * The function checks if the payload is empty and returns null if so. It then maps over the payload to create a visual representation of each item, utilizing the configuration obtained from getPayloadConfigFromPayload. The legend items can optionally display an icon based on the hideIcon flag and the item's configuration.
 *
 * @param className - Additional class names to apply to the legend container.
 * @param hideIcon - A flag to determine whether to hide the icons in the legend.
 * @param payload - The data to be displayed in the legend.
 * @param verticalAlign - The vertical alignment of the legend, defaulting to 'bottom'.
 * @param nameKey - An optional key to use for naming the legend items.
 * @returns A JSX element representing the chart legend, or null if the payload is empty.
 */
function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
}: React.ComponentProps<'div'> &
  Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
    hideIcon?: boolean;
    nameKey?: string;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className
      )}
    >
      {payload.map(item => {
        const key = `${nameKey || item.dataKey || 'value'}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            key={item.value}
            className={
              '[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3'
            }
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className='h-2 w-2 shrink-0 rounded-[2px]'
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

// Helper to extract item config from a payload.
/**
 * Retrieve the configuration value from a payload based on a specified key.
 *
 * The function first checks if the payload is a valid object. It then attempts to extract the 'payload' property if it exists.
 * Depending on the presence of the key in either the payload or its nested payload, it determines the appropriate configuration label key
 * and retrieves the corresponding value from the config object.
 *
 * @param config - The ChartConfig object containing configuration values.
 * @param payload - The input payload from which to extract the configuration.
 * @param key - The key used to look up the configuration value.
 * @returns The configuration value associated with the specified key, or undefined if not found.
 */
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const payloadPayload =
    'payload' in payload &&
    typeof payload.payload === 'object' &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === 'string'
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
