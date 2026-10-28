import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { DataProvider } from './src/context/DataContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  const navigationRef = useNavigationContainerRef();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#F8FAFC" />
      <AuthProvider>
        <DataProvider>
          <NotificationProvider navigationRef={navigationRef}>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </NotificationProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
