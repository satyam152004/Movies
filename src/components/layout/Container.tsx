import React from 'react';
import {View, StyleSheet, SafeAreaView, ViewStyle} from 'react-native';
import {colors} from '../../theme';

interface ContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  useSafeArea?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  style,
  useSafeArea = false,
}) => {
  if (useSafeArea) {
    return (
      <SafeAreaView style={[styles.safe, style]}>
        <View style={styles.inner}>{children}</View>
      </SafeAreaView>
    );
  }

  return <View style={[styles.base, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  base: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
