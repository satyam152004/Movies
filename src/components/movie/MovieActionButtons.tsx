import React, {useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {movieTheme} from './theme';
import {MovieDetail} from '../../data/models';
import {typography} from '../../theme';

interface MovieActionButtonsProps {
  movie: MovieDetail;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  onDownloadPress: () => void;
}

const ScalePressable: React.FC<{
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
}> = ({onPress, style, children}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View style={[{transform: [{scale}]}, style]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const MovieActionButtons: React.FC<MovieActionButtonsProps> = ({
  movie,
  isWatchlisted,
  onToggleWatchlist,
  onDownloadPress,
}) => {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${movie.title}" on CineApp!\n${movie.url}`,
        title: movie.title,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.primaryRow}>
        <ScalePressable
          onPress={onToggleWatchlist}
          style={[styles.largeButton, styles.outlineButton]}>
          <Icon
            name={isWatchlisted ? 'checkmark' : 'add'}
            size={20}
            color={
              isWatchlisted ? movieTheme.colors.primary : movieTheme.colors.text
            }
            style={styles.btnIconSpacing}
          />
          <Text
            style={[
              styles.buttonText,
              isWatchlisted && {color: movieTheme.colors.primary},
            ]}>
            Watchlist
          </Text>
        </ScalePressable>

        {movie.downloadLinks && movie.downloadLinks.length > 0 && (
          <ScalePressable
            onPress={onDownloadPress}
            style={[styles.largeButton, styles.downloadButton]}>
            <Icon
              name="arrow-down-outline"
              size={20}
              color={movieTheme.colors.primary}
              style={styles.btnIconSpacing}
            />
            <Text style={styles.downloadButtonText}>Download</Text>
          </ScalePressable>
        )}

        <ScalePressable
          onPress={handleShare}
          style={[styles.largeButton, styles.outlineButton]}>
          <Icon
            name="share-social-outline"
            size={20}
            color={movieTheme.colors.text}
            style={styles.btnIconSpacing}
          />
          <Text style={styles.buttonText}>Share</Text>
        </ScalePressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 18,
    gap: 12,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  largeButton: {
    flex: 1,
    height: 52,
    borderRadius: movieTheme.radius.cardControl,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    backgroundColor: '#FFFFFF',
  },
  playButtonText: {
    ...typography.tokens.navigation,

    color: '#000000',
    
    fontWeight: movieTheme.typography.weights.bold,
  },
  downloadButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  downloadButtonText: {
    ...typography.tokens.caption,
    fontSize: 11,

    color: movieTheme.colors.primary,
    
    fontWeight: movieTheme.typography.weights.bold,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  auxButton: {
    flex: 1,
    height: 38,
    borderRadius: movieTheme.radius.compactControl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  glassButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  buttonText: {
    ...typography.tokens.caption,
    fontSize: 11,

    color: movieTheme.colors.text,
    
    fontWeight: movieTheme.typography.weights.semibold,
  },
  btnIconSpacing: {
    marginBottom: 4,
  },
});
