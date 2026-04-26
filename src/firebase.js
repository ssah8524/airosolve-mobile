import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Paste your Firebase project config here
const firebaseConfig = {
  apiKey: 'AIzaSyCS6BIagctw-Qpbfb0QFakAr-xH9-sIfuA',
  authDomain: 'airosolve-9e7d7.firebaseapp.com',
  projectId: 'airosolve-9e7d7',
  storageBucket: 'airosolve-9e7d7.firebasestorage.app',
  messagingSenderId: '634478971769',
  appId: '1:634478971769:web:2e4773c31be79e267cbda8',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
