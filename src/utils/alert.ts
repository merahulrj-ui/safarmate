import { Alert, Platform } from 'react-native';

export const showAlert = (title: string, message: string = '') => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}: ${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};
