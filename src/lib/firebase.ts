import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import * as SecureStore from 'expo-secure-store';

// TODO: Replace these with your actual Firebase project config keys
export const firebaseConfig = {
  apiKey: "AIzaSyBkAHqFC4eEzRHtcW0rj4h2gXw5sLGOe3k",
  authDomain: "polar-caldron-338916.firebaseapp.com",
  projectId: "polar-caldron-338916",
  storageBucket: "polar-caldron-338916.firebasestorage.app",
  messagingSenderId: "396326212205",
  appId: "1:396326212205:web:5bb999aedbbb19a12c6564"
};

// Initialize Firebase
import { Platform } from 'react-native';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: any;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  const SecureStorage = {
    getItem: (key: string) => SecureStore.getItemAsync(sanitizeKey(key)),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(sanitizeKey(key), value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(sanitizeKey(key)),
  };
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(SecureStorage)
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
