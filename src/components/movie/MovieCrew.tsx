import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {movieTheme} from './theme';
import {movieStyles} from './styles';

interface CrewMember {
  name: string;
  job: string;
}

interface MovieCrewProps {
  crew?: CrewMember[];
  fallbackDirector?: string;
}

export const MovieCrew: React.FC<MovieCrewProps> = ({
  crew,
  fallbackDirector,
}) => {
  const displayCrew =
    crew && crew.length > 0
      ? crew
      : fallbackDirector
      ? [{name: fallbackDirector, job: 'Director'}]
      : [];

  if (displayCrew.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={movieStyles.sectionTitle}>Crew</Text>
      <View style={styles.content}>
        {displayCrew.map((member, idx) => (
          <View key={idx} style={styles.crewItem}>
            <Text style={styles.crewJob}>{member.job.toUpperCase()}</Text>
            <Text style={styles.crewName} numberOfLines={1}>
              {member.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 8,
  },
  crewItem: {
    minWidth: 110,
    gap: 2,
  },
  crewJob: {
    color: movieTheme.colors.secondary,
    fontSize: 10,
    fontWeight: movieTheme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  crewName: {
    color: movieTheme.colors.text,
    fontSize: 13,
    fontWeight: movieTheme.typography.weights.semibold,
  },
});
