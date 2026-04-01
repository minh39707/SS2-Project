import { Platform } from 'react-native';

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
};

export const radii = {
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

export const fonts = Platform.select({
  ios: {
    display: 'SF Pro Display',
    text: 'SF Pro Text',
    rounded: 'SF Pro Rounded',
    mono: 'SF Mono',
  },
  android: {
    display: 'sans-serif-medium',
    text: 'sans-serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  default: {
    display: 'System',
    text: 'System',
    rounded: 'System',
    mono: 'monospace',
  },
  web: {
    display: "Inter, 'SF Pro Display', system-ui, sans-serif",
    text: "Inter, 'SF Pro Text', system-ui, sans-serif",
    rounded: "Inter, 'SF Pro Rounded', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const Colors = {
  light: {
    text: '#111827',
    background: '#F4F7FB',
    tint: '#3B82F6',
    icon: '#6B7280',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#3B82F6',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    tint: '#60A5FA',
    icon: '#CBD5E1',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#60A5FA',
  },
};

export const Fonts = {
  sans: fonts?.text ?? 'System',
  serif: Platform.select({ ios: 'Times New Roman', default: 'serif', web: 'Georgia, serif' }) ?? 'serif',
  rounded: fonts?.rounded ?? 'System',
  mono: fonts?.mono ?? 'monospace',
};
