import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export const Skeleton = ({ width, height, borderRadius = 8, style }: SkeletonProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const RideCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <Skeleton width={100} height={16} />
          <Skeleton width={60} height={20} />
        </View>
        <View style={styles.timeRow}>
          <Skeleton width={80} height={24} />
        </View>
      </View>
      
      <View style={styles.routeContainer}>
        <View style={styles.timeline}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <View style={[styles.dot, styles.dotEnd]} />
        </View>
        <View style={styles.locations}>
          <Skeleton width={120} height={20} style={{ marginBottom: 20 }} />
          <Skeleton width={100} height={20} />
        </View>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.driverInfo}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width={80} height={16} style={{ marginLeft: 12 }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeline: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  line: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  dotEnd: {
    backgroundColor: '#E5E7EB',
  },
  locations: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
