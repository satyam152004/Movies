import React, {useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {movieTheme} from './theme';

interface MovieStickyCTAProps {
  visible: boolean;
  hasWatchLink: boolean;
  onPlayPress?: () => void;
  onDownloadPress?: () => void;
}

export const MovieStickyCTA: React.FC<MovieStickyCTAProps> = ({
  visible,
  hasWatchLink,
  onPlayPress,
  onDownloadPress,
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current; // Start hidden below screen

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{translateY: slideAnim}],
        },
      ]}>
      <View style={styles.content}>
        {hasWatchLink && (
          <TouchableOpacity
            style={[styles.button, styles.playButton]}
            onPress={onPlayPress}
            activeOpacity={0.8}>
            <Icon name="play" size={18} color="#000000" />
            <Text style={styles.playText}>Play</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.downloadButton]}
          onPress={onDownloadPress}
          activeOpacity={0.8}>
          <Icon name="arrow-down" size={18} color="#FFFFFF" />
          <Text style={styles.downloadText}>Download</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(18, 18, 24, 0.94)',
    borderTopWidth: 1,
    borderTopColor: movieTheme.colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: movieTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playButton: {
    backgroundColor: '#FFFFFF',
  },
  playText: {
    color: '#000000',
    fontWeight: movieTheme.typography.weights.bold,
    fontSize: 14,
  },
  downloadButton: {
    backgroundColor: movieTheme.colors.primary,
  },
  downloadText: {
    color: '#FFFFFF',
    fontWeight: movieTheme.typography.weights.bold,
    fontSize: 14,
  },
});
