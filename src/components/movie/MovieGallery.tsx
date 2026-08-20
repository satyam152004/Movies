import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import {movieTheme} from './theme';

interface MovieGalleryProps {
  screenshots: string[];
  onScreenshotPress: (url: string) => void;
}

export const MovieGallery: React.FC<MovieGalleryProps> = ({
  screenshots,
  onScreenshotPress,
}) => {
  if (!screenshots || screenshots.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Screenshots</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {screenshots.map((src, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.card}
            onPress={() => onScreenshotPress(src)}
            activeOpacity={0.8}>
            <Image
              source={{uri: src}}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: 160,
    height: 90,
    borderRadius: movieTheme.radius.compactControl,
    overflow: 'hidden',
    backgroundColor: movieTheme.colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
