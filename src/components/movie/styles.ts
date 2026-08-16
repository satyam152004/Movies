import {StyleSheet} from 'react-native';
import {movieTheme} from './theme';

export const movieStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: movieTheme.colors.background,
  },
  glassCard: {
    backgroundColor: movieTheme.colors.card,
    borderRadius: movieTheme.radius.md,
    borderWidth: 1,
    borderColor: movieTheme.colors.border,
    padding: 16,
    ...movieTheme.shadows.soft,
  },
  sectionTitle: {
    fontSize: movieTheme.typography.sizes.sectionTitle,
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
