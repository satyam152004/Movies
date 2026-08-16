import React from 'react';
import {TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {movieTheme} from '../movie/theme';

interface BackButtonProps {
  onPress: () => void;
  color?: string;
  style?: any;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{top: 12, bottom: 12, left: 4, right: 20}}
      accessibilityLabel="Go Back">
      <Icon name="chevron-back" size={24} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 12, // Standard breathing inset from the left edge (leaving gestural space)
  },
});

export default BackButton;
