import {TextStyle} from 'react-native';

export const typography = {
  fontFamily: {
    primary: 'Inter',
    outfit: 'Outfit',
  },
  sizes: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 26,
    xxxl: 32,
  },
  weights: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '900' as TextStyle['fontWeight'],
  },
  tokens: {
    display: {
      fontSize: 34,
      fontWeight: '900' as TextStyle['fontWeight'],
      lineHeight: 42,
    },
    h1: {
      fontSize: 26,
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: 32,
    },
    h2: {
      fontSize: 22,
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: 28,
    },
    h3: {
      fontSize: 18,
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: 24,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 20,
    },
    bodyMedium: {
      fontSize: 16,
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 22,
    },
    secondary: {
      fontSize: 13,
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 18,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 16,
    },
    label: {
      fontSize: 10,
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: 14,
    },
    button: {
      fontSize: 14,
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 18,
    },
    navigation: {
      fontSize: 12,
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 16,
    },
    metadata: {
      fontSize: 13,
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 18,
    },
  },
};
