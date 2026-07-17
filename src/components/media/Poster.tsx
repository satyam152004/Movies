import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ImageStyle,
  ViewStyle,
} from 'react-native';
import {colors, radius} from '../../theme';

interface PosterProps {
  url?: string;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  fallbackIcon?: string;
}

export const Poster: React.FC<PosterProps> = ({
  url,
  style,
  imageStyle,
  fallbackIcon = '🎬',
}) => {
  return (
    <View style={[styles.container, style]}>
      {url ? (
        <Image
          source={{uri: url}}
          style={[styles.image, imageStyle]}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.icon}>{fallbackIcon}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
});
