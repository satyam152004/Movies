import {typography} from '../../theme';

export const movieTheme = {
  colors: {
    background: '#09090B',
    primary: '#8B5CF6',
    text: '#FFFFFF',
    secondary: '#B4B4B8',
    border: 'rgba(255, 255, 255, 0.08)',
    card: '#14141B',
    warning: '#F59E0B',
    success: '#10B981',
    info: '#06B6D4',
    danger: '#EF4444',
    overlayTop: 'rgba(0, 0, 0, 0.45)',
    overlayBottom: '#09090B',
  },
  typography: {
    sizes: {
      heroTitle: typography.tokens.display.fontSize,
      sectionTitle: typography.tokens.h3.fontSize,
      subtitle: typography.tokens.bodyMedium.fontSize,
      body: typography.tokens.body.fontSize,
      meta: typography.tokens.metadata.fontSize,
      badge: typography.tokens.label.fontSize,
    },
    weights: {
      regular: typography.weights.regular,
      medium: typography.weights.medium,
      semibold: typography.weights.semibold,
      bold: typography.weights.heavy, // Map to heavy (900) as the existing theme specifies bold is '900'
      black: typography.weights.heavy,
    },
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    card: 14,
    large: 16,
    round: 9999,

    // Component-specific semantic values
    compactControl: 8,
    control: 10,
    cardControl: 12,
    search: 9999,

    // Compatibility aliases
    lg: 16,
    xl: 24,
    pill: 9999,
  },
  shadows: {
    premium: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    soft: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
    },
  },
};
