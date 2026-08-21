import React from 'react';
import {View, Text, StyleSheet, ScrollView, Image} from 'react-native';
import {movieTheme} from './theme';
import {typography} from '../../theme';

interface MovieCastProps {
  stars: string[];
  enrichedCast?: {name: string; character: string; profileUrl: string}[];
}

const getInitials = (name: string) => {
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0] ? parts[0].slice(0, 2).toUpperCase() : '';
};

export const MovieCast: React.FC<MovieCastProps> = ({stars, enrichedCast}) => {
  const hasEnriched = enrichedCast && enrichedCast.length > 0;
  const castList = hasEnriched ? enrichedCast : stars;

  if (!castList || castList.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Cast</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {castList.map((item, idx) => {
          const name = typeof item === 'string' ? item : item.name;
          const character = typeof item === 'string' ? '' : item.character;

          // Use real image if enriched profileUrl exists, otherwise use initials fallback
          const profileUrl =
            typeof item === 'string' ? undefined : item.profileUrl;
          const hasImage = profileUrl && profileUrl.startsWith('http');

          return (
            <View key={idx} style={styles.castCard}>
              <View style={styles.avatarWrapper}>
                {hasImage ? (
                  <Image
                    source={{uri: profileUrl}}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.fallbackAvatar}>
                    <Text style={styles.fallbackText}>{getInitials(name)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actorName} numberOfLines={2}>
                {name}
              </Text>
              {character ? (
                <Text style={styles.characterName} numberOfLines={1}>
                  {character}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    ...typography.tokens.button,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  castCard: {
    width: 80,
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 60, // Target size: ~60dp
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1E1E24',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  fallbackAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(139, 92, 246, 0.15)', // CineApp signature purple tint
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    ...typography.tokens.body,

    color: movieTheme.colors.primary,
    
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actorName: {
    color: movieTheme.colors.text,
    fontSize: 11,
    fontWeight: movieTheme.typography.weights.semibold,
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
  characterName: {
    ...typography.tokens.label,
    fontSize: 9,

    color: movieTheme.colors.secondary,
    
    fontWeight: movieTheme.typography.weights.regular,
    marginTop: 1,
    textAlign: 'center',
    width: '100%',
  },
});
