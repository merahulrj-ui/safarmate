import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, { FadeOut, Easing } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface CustomSplashScreenProps {
  onFinish?: () => void;
}

export default function CustomSplashScreen({ onFinish }: CustomSplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show splash for 2.5 seconds, then fade out
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) {
        setTimeout(onFinish, 1000); // Give it time to fade out before completely unmounting
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={styles.container} 
      exiting={FadeOut.duration(800).easing(Easing.inOut(Easing.ease))}
      pointerEvents="none"
    >
      <Image
        source={require('../../assets/images/splash-custom.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 99999, // Ensure it sits on top of absolutely everything
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: width,
    height: height,
  },
});
