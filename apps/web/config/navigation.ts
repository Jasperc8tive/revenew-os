import { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Gauge,
  ShieldCheck,
  LineChart,
  Package,
  Users,
  MessageSquare,
  Settings,
  HelpCircle,
  LayoutDashboard,
  TrendingUp,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navigationConfig: NavSection[] = [
  {
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Revenue & growth metrics',
      },
      {
        id: 'orders',
        label: 'Orders',
        href: '/dashboard/orders',
        icon: Package,
        description: 'Order management',
        badge: 12,
      },
      {
        id: 'customers',
        label: 'Customers',
        href: '/dashboard/customers',
        icon: Users,
        description: 'Customer database',
      },
      {
        id: 'messages',
        label: 'Messages',
        href: '/dashboard/messages',
        icon: MessageSquare,
        description: 'WhatsApp conversations',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/dashboard/analytics',
        icon: BarChart3,
        description: 'Detailed insights',
      },
      {
        id: 'acquisition',
        label: 'Acquisition',
        href: '/dashboard/acquisition',
        icon: TrendingUp,
        description: 'Channel acquisition performance',
      },
      {
        id: 'pipeline',
        label: 'Pipeline',
        href: '/dashboard/pipeline',
        icon: Gauge,
        description: 'Deal and conversion velocity',
      },
      {
        id: 'retention',
        label: 'Retention',
        href: '/dashboard/retention',
        icon: ShieldCheck,
        description: 'Retention and churn monitoring',
      },
      {
        id: 'pricing',
        label: 'Pricing',
        href: '/dashboard/pricing',
        icon: LineChart,
        description: 'Pricing and monetization tests',
      },
      {
        id: 'agents',
        label: 'Agents',
        href: '/dashboard/agents',
        icon: Bot,
        description: 'AI agents and automation',
      },
      {
        id: 'recommendations',
        label: 'Recommendations',
        href: '/dashboard/recommendations',
        icon: TrendingUp,
        description: 'Priority growth recommendations',
      },
      {
        id: 'command-center',
        label: 'Command Center',
        href: '/dashboard/command-center',
        icon: Gauge,
        description: 'Executive mode',
      },
      {
        id: 'verification',
        label: 'Verification',
        href: '/dashboard/verification',
        icon: ShieldCheck,
        description: 'Data quality and audit logs',
      },
      {
        id: 'benchmarking',
        label: 'Benchmarking',
        href: '/dashboard/benchmarking',
        icon: TrendingUp,
        description: 'Industry comparison',
      },
      {
        id: 'forecasting',
        label: 'Forecasting',
        href: '/dashboard/forecasting',
        icon: LineChart,
        description: 'Revenue scenarios',
      },
      {
        id: 'experiments',
        label: 'Experiments',
        href: '/dashboard/experiments',
        icon: TrendingUp,
        description: 'A/B growth testing',
      },
      {
        id: 'competitive',
        label: 'Competitive Intel',
        href: '/dashboard/competitive',
        icon: TrendingUp,
        description: 'Competitor tracking',
      },
      {
        id: 'copilot',
        label: 'AI Copilot',
        href: '/dashboard/copilot',
        icon: Bot,
        description: 'Growth strategy chat',
      },
      {
        id: 'integrations',
        label: 'Integrations',
        href: '/dashboard/integrations',
        icon: Settings,
        description: 'Connected sources and syncs',
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/dashboard/reports',
        icon: TrendingUp,
        description: 'Custom reports',
      },
      {
        id: 'billing',
        label: 'Billing',
        href: '/dashboard/billing',
        icon: Settings,
        description: 'Plans, invoices, and usage',
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        description: 'App configuration',
      },
      {
        id: 'help',
        label: 'Help & Support',
        href: '/dashboard/help',
        icon: HelpCircle,
        description: 'Documentation & support',
      },
    ],
  },
];

// Flatten all nav items for easy lookup
export const flattenNavItems = (sections: NavSection[]): NavItem[] => {
  return sections.flatMap((section) => [
    ...section.items,
    ...(section.items.flatMap((item) => item.children || [])),
  ]);
};

// Get breadcrumb trail for a given path
export const getBreadcrumbs = (
  pathname: string,
  sections: NavSection[] = navigationConfig
) => {
  const flatItems = flattenNavItems(sections);
  const currentItem = flatItems.find((item) => item.href === pathname);

  if (!currentItem) {
    return [{ label: 'Dashboard', href: '/dashboard' }];
  }

  const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }];

  if (currentItem.href !== '/dashboard') {
    breadcrumbs.push({
      label: currentItem.label,
      href: currentItem.href,
    });
  }

  return breadcrumbs;
};
