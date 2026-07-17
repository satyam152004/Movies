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
};
