'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useKeyboardNavigation,
  useFocusManagement,
  useAriaLiveAnnouncer,
} from '@/hooks/use-accessibility';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccessibleNavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: AccessibleNavItem[];
  disabled?: boolean;
  current?: boolean;
  badge?: string | number;
}

interface AccessibleNavigationProps {
  items: AccessibleNavItem[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onItemClick?: (item: AccessibleNavItem) => void;
  announceNavigation?: boolean;
}

/**
 * A React functional component that provides accessible navigation with keyboard support.
 *
 * This component manages the state of active and expanded navigation items, allowing users to navigate through
 * a list of items using keyboard controls. It utilizes aria attributes for accessibility and provides visual
 * feedback for active and expanded states. The component also handles item clicks and announces navigation changes
 * for screen readers.
 *
 * @param items - An array of navigation items to be rendered.
 * @param orientation - The orientation of the navigation, either 'vertical' or 'horizontal'. Defaults to 'vertical'.
 * @param className - Additional CSS classes to apply to the navigation component.
 * @param onItemClick - A callback function that is called when an item is clicked.
 * @param announceNavigation - A boolean indicating whether to announce navigation changes. Defaults to true.
 * @returns A JSX element representing the accessible navigation component.
 */
export const AccessibleNavigation: React.FC<AccessibleNavigationProps> = ({
  items,
  orientation = 'vertical',
  className,
  onItemClick,
  announceNavigation = true,
}) => {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { announce } = useAriaLiveAnnouncer();
  const { trapFocus, restoreFocus } = useFocusManagement();
  const navRef = useRef<HTMLElement>(null);

  const { handleKeyDown } = useKeyboardNavigation(
    () => {
      // Escape - close any open submenus
      setExpandedItems(new Set());
      setActiveItem(null);
    },
    () => {
      // Enter - activate current item
      if (activeItem) {
        const item = findItemById(items, activeItem);
        if (item && !item.disabled) {
          handleItemClick(item);
        }
      }
    },
    () => {
      // Arrow Up - navigate up
      navigateItems(-1);
    },
    () => {
      // Arrow Down - navigate down
      navigateItems(1);
    },
    () => {
      // Arrow Left - navigate left or collapse
      if (orientation === 'horizontal') {
        navigateItems(-1);
      } else {
        collapseCurrentItem();
      }
    },
    () => {
      // Arrow Right - navigate right or expand
      if (orientation === 'horizontal') {
        navigateItems(1);
      } else {
        expandCurrentItem();
      }
    }
  );

  const findItemById = (
    itemList: AccessibleNavItem[],
    id: string
  ): AccessibleNavItem | null => {
    for (const item of itemList) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * Recursively retrieves all items from a list of accessible navigation items.
   */
  const getAllItems = (itemList: AccessibleNavItem[]): AccessibleNavItem[] => {
    const allItems: AccessibleNavItem[] = [];
    for (const item of itemList) {
      allItems.push(item);
      if (item.children && expandedItems.has(item.id)) {
        allItems.push(...getAllItems(item.children));
      }
    }
    return allItems;
  };

  /**
   * Navigates through items based on the specified direction.
   *
   * This function retrieves all items and determines the current active item index.
   * It calculates the next index based on the provided direction and checks if the
   * next item is valid and not disabled. If valid, it updates the active item and
   * optionally announces the navigation.
   *
   * @param direction - The direction to navigate, where positive values move forward
   *                    and negative values move backward in the item list.
   */
  const navigateItems = (direction: number) => {
    const allItems = getAllItems(items);
    const currentIndex = allItems.findIndex(item => item.id === activeItem);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < allItems.length) {
      const nextItem = allItems[nextIndex];
      if (!nextItem.disabled) {
        setActiveItem(nextItem.id);
        if (announceNavigation) {
          announce(`Navigated to ${nextItem.label}`);
        }
      }
    }
  };

  /**
   * Expands the currently active item if it exists.
   *
   * The function checks if there is an active item and retrieves it using findItemById.
   * If the item has children, it adds the item's ID to the set of expanded items.
   * Additionally, if announceNavigation is true, it announces the expansion of the item.
   */
  const expandCurrentItem = () => {
    if (activeItem) {
      const item = findItemById(items, activeItem);
      if (item && item.children) {
        setExpandedItems(prev => new Set(prev).add(item.id));
        if (announceNavigation) {
          announce(`Expanded ${item.label}`);
        }
      }
    }
  };

  const collapseCurrentItem = () => {
    if (activeItem) {
      const item = findItemById(items, activeItem);
      if (item && item.children && expandedItems.has(item.id)) {
        setExpandedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
        if (announceNavigation) {
          announce(`Collapsed ${item.label}`);
        }
      }
    }
  };

  /**
   * Handles the click event for an item in the navigation.
   *
   * This function checks if the clicked item has children. If it does, it toggles the expanded state of the item in the `expandedItems` set. If the item does not have children, it sets the active item and announces the selection if `announceNavigation` is enabled. Finally, it calls the `onItemClick` callback if provided.
   *
   * @param item - The navigation item that was clicked, which may contain children and a label.
   */
  const handleItemClick = (item: AccessibleNavItem) => {
    if (item.children) {
      const isExpanded = expandedItems.has(item.id);
      if (isExpanded) {
        setExpandedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      } else {
        setExpandedItems(prev => new Set(prev).add(item.id));
      }
    } else {
      setActiveItem(item.id);
      if (announceNavigation) {
        announce(`Selected ${item.label}`);
      }
    }
    onItemClick?.(item);
  };

  /**
   * Renders a navigation item with potential child items.
   *
   * The function checks if the item is expanded, active, and if it has children. It constructs a list item with appropriate ARIA roles and attributes, and handles click and keydown events. If the item has children and is expanded, it recursively renders the child items.
   *
   * @param item - An AccessibleNavItem object representing the navigation item to render.
   * @param level - The current nesting level of the navigation item, defaulting to 0.
   * @returns A JSX element representing the rendered navigation item.
   */
  const renderNavItem = (item: AccessibleNavItem, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <li key={item.id} role='none'>
        <div
          role='menuitem'
          tabIndex={isActive ? 0 : -1}
          aria-current={item.current ? 'page' : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-disabled={item.disabled}
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            isActive && 'bg-accent text-accent-foreground',
            item.current && 'bg-primary text-primary-foreground',
            item.disabled && 'opacity-50 cursor-not-allowed',
            level > 0 && 'ml-4'
          )}
          onClick={() => !item.disabled && handleItemClick(item)}
          onKeyDown={e => handleKeyDown(e.nativeEvent)}
        >
          <div className='flex items-center space-x-2'>
            {item.icon && <span className='flex-shrink-0'>{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge && (
              <span className='ml-auto px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full'>
                {item.badge}
              </span>
            )}
          </div>
          {hasChildren && (
            <span className='flex-shrink-0'>
              {isExpanded ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <ul role='menu' className='mt-1 space-y-1'>
            {item.children!.map(child => renderNavItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      role='navigation'
      aria-label='Main navigation'
      className={cn(
        'space-y-1',
        orientation === 'horizontal' && 'flex space-x-1',
        className
      )}
    >
      <ul
        role='menu'
        className={cn(
          'space-y-1',
          orientation === 'horizontal' && 'flex space-x-1'
        )}
      >
        {items.map(item => renderNavItem(item))}
      </ul>
    </nav>
  );
};

interface AccessibleBreadcrumbProps {
  items: Array<{
    label: string;
    href?: string;
    current?: boolean;
  }>;
  separator?: React.ReactNode;
  className?: string;
  onItemClick?: (item: { label: string; href?: string }) => void;
}

/**
 * Renders an accessible breadcrumb navigation component.
 */
export const AccessibleBreadcrumb: React.FC<AccessibleBreadcrumbProps> = ({
  items,
  separator = '/',
  className,
  onItemClick,
}) => {
  const { announce } = useAriaLiveAnnouncer();

  /**
   * Handles the click event for an item.
   */
  const handleItemClick = (item: { label: string; href?: string }) => {
    announce(`Navigated to ${item.label}`);
    onItemClick?.(item);
  };

  return (
    <nav
      role='navigation'
      aria-label='Breadcrumb'
      className={cn('flex items-center space-x-2', className)}
    >
      <ol className='flex items-center space-x-2'>
        {items.map((item, index) => (
          <li key={index} className='flex items-center'>
            {index > 0 && (
              <span className='mx-2 text-muted-foreground' aria-hidden='true'>
                {separator}
              </span>
            )}
            {item.current ? (
              <span
                className='text-sm font-medium text-foreground'
                aria-current='page'
              >
                {item.label}
              </span>
            ) : (
              <button
                className='text-sm text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => handleItemClick(item)}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

interface AccessibleTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
    disabled?: boolean;
  }>;
  defaultTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
  announceTabChange?: boolean;
}

export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({
  tabs,
  defaultTab,
  className,
  onTabChange,
  announceTabChange = true,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const { announce } = useAriaLiveAnnouncer();
  const { handleKeyDown } = useKeyboardNavigation();

  /**
   * Handles the click event on a tab, updating the active tab and announcing the change.
   */
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (announceTabChange) {
      const tab = tabs.find(t => t.id === tabId);
      announce(`Switched to ${tab?.label} tab`);
    }
    onTabChange?.(tabId);
  };

  /**
   * Handles the key down event for tab navigation.
   *
   * This function determines the next tab index based on the pressed key (ArrowLeft, ArrowRight, Home, End)
   * and updates the active tab accordingly. It prevents the default action of the event and invokes
   * handleTabClick if the next tab is not disabled. If the key does not match any case, it calls
   * handleKeyDown with the event.
   *
   * @param event - The keyboard event triggered by the user.
   * @param tabId - The ID of the currently active tab.
   */
  const handleKeyDownEvent = (event: React.KeyboardEvent, tabId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        handleKeyDown(event as any);
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab.disabled) {
      handleTabClick(nextTab.id);
    }
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={cn('space-y-4', className)}>
      <div role='tablist' aria-label='Tabs'>
        <div className='flex space-x-1 border-b'>
          {tabs.map(tab => (
            <button
              key={tab.id}
              role='tab'
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              onKeyDown={e => handleKeyDownEvent(e, tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role='tabpanel'
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className='space-y-4'
      >
        {activeTabContent}
      </div>
    </div>
  );
};
