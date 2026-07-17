import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {colors, radius} from '../../theme';

interface IconButtonProps {
  icon: string;
  onPress: () => void;
  style?: ViewStyle;
  iconStyle?: TextStyle;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  style,
  iconStyle,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.base, style, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}>
      <Text style={[styles.iconText, iconStyle]}>{icon}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    width: 44, // Touch target >= 44dp
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
});
