import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import FlashMessage from 'react-native-flash-message';
import SplashScreen from 'react-native-splash-screen';
import { enableScreens } from 'react-native-screens';
import NetInfo from '@react-native-netinfo/netinfo';
import PushNotification from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';

import { store } from './store';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { LocationProvider } from './contexts/LocationContext';
import { ThemeProvider } from './contexts/ThemeProvider';
import { LanguageProvider } from './contexts/LanguageProvider';
import { theme } from './theme';
import { initializeApp } from './utils/initialization';
import { requestUserPermissions, configureNotifications } from './utils/notifications';
import { setupCrashReporting, logEvent } from './utils/analytics';

// Enable react-native-screens
enableScreens();

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const App: React.FC = () => {
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize app services
        await initializeApp();
        
        // Setup crash reporting
        await setupCrashReporting();
        
        // Configure push notifications
        await configureNotifications();
        
        // Request permissions
        await requestUserPermissions();
        
        // Setup network monitoring
        NetInfo.addEventListener(state => {
          logEvent('network_change', {
            isConnected: state.isConnected,
            type: state.type,
          });
        });
        
        // Handle background messages
        messaging().onMessage(async remoteMessage => {
          PushNotification.localNotification({
            title: remoteMessage.notification?.title,
            message: remoteMessage.notification?.body || '',
            playSound: true,
            soundName: 'default',
          });
        });
        
        messaging().setBackgroundMessageHandler(async remoteMessage => {
          console.log('Message handled in the background!', remoteMessage);
        });
        
        // Log app startup
        await analytics().logAppOpen();
        
        // Hide splash screen
        SplashScreen.hide();
        
      } catch (error) {
        crashlytics().recordError(error as Error);
        console.error('App initialization error:', error);
      }
    };

    initApp();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={theme}>
              <ThemeProvider>
                <LanguageProvider>
                  <AuthProvider>
                    <OfflineProvider>
                      <LocationProvider>
                        <NavigationContainer>
                          <AppNavigator />
                        </NavigationContainer>
                        <FlashMessage position="top" />
                      </LocationProvider>
                    </OfflineProvider>
                  </AuthProvider>
                </LanguageProvider>
              </ThemeProvider>
            </PaperProvider>
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
