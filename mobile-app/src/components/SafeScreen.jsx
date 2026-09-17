import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SafeScreen({ 
  children, 
  backgroundColor = '#FFFFFF',
  barStyle = 'dark-content',
  // Stack screens must reserve the Android system navigation area.
  // Pass edges={['top','bottom','left','right']} for full-screen modals.
  edges = ['top', 'bottom', 'left', 'right'],
}) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
      <StatusBar backgroundColor={backgroundColor} barStyle={barStyle} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
