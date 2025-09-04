import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, Platform, AppState } from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import CodePush from 'react-native-code-push';

import { store } from './store';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { LocationProvider } from './contexts/LocationProvider';
import { ThemeProvider } from './contexts/ThemeProvider';
import { LanguageProvider } from './contexts/LanguageProvider';
import { LoadingProvider } from './contexts/LoadingProvider';
import { initializeApp } from './services/initialization';
import { requestNotificationPermissions } from './services/notifications';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('Loading');

  useEffect(() => {
    initializeApplication();
  }, []);

  const initializeApplication = async () => {
    try {
      // Initialize core services
      await initializeApp();
      
      // Configure push notifications
      await setupPushNotifications();
      
      // Check authentication status
      const authToken = await AsyncStorage.getItem('authToken');
      const hasCompletedOnboarding = await AsyncStorage.getItem('onboardingComplete');
      
      if (!hasCompletedOnboarding) {
        setInitialRoute('Onboarding');
      } else if (authToken) {
        setInitialRoute('Dashboard');
      } else {
        setInitialRoute('Auth');
      }
      
      // Handle deep linking
      await handleDeepLinking();
      
      // Setup app state change handling
      AppState.addEventListener('change', handleAppStateChange);
      
      // Setup network connectivity monitoring
      NetInfo.addEventListener(handleConnectivityChange);
      
      setIsReady(true);
      SplashScreen.hide();
      
    } catch (error) {
      console.error('App initialization failed:', error);
      setIsReady(true);
      SplashScreen.hide();
    }
  };

  const setupPushNotifications = async () => {
    try {
      // Request permissions
      const hasPermission = await requestNotificationPermissions();
      
      if (hasPermission) {
        // Configure local notifications
        PushNotification.configure({
          onRegister: (token) => {
            console.log('FCM Token:', token.token);
            // Send token to backend
          },
          onNotification: (notification) => {
            console.log('Notification received:', notification);
            notification.finish();
          },
          popInitialNotification: true,
          requestPermissions: Platform.OS === 'ios',
        });

        // Handle foreground messages
        messaging().onMessage(async remoteMessage => {
          PushNotification.localNotification({
            title: remoteMessage.notification?.title,
            message: remoteMessage.notification?.body || '',
          });
        });

        // Handle background messages
        messaging().setBackgroundMessageHandler(async remoteMessage => {
          console.log('Message handled in the background!', remoteMessage);
        });
      }
    } catch (error) {
      console.error('Push notification setup failed:', error);
    }
  };

  const handleDeepLinking = async () => {
    // Handle deep link routing
    // Implementation depends on your deep linking strategy
  };

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      // App became active - refresh data, check for updates
      CodePush.sync({
        installMode: CodePush.InstallMode.ON_NEXT_RESUME,
        mandatoryInstallMode: CodePush.InstallMode.IMMEDIATE,
      });
    }
  };

  const handleConnectivityChange = (state: any) => {
    // Handle network connectivity changes
    console.log('Network connectivity changed:', state);
  };

  if (!isReady) {
    return null; // Show splash screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <LanguageProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <OfflineProvider>
                      <LocationProvider>
                        <LoadingProvider>
                          <NavigationContainer theme={theme}>
                            <AppNavigator initialRouteName={initialRoute} />
                          </NavigationContainer>
                        </LoadingProvider>
                      </LocationProvider>
                    </OfflineProvider>
                  </NotificationProvider>
                </AuthProvider>
              </LanguageProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

// Configure CodePush for over-the-air updates
const codePushOptions = {
  checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
  installMode: CodePush.InstallMode.ON_NEXT_RESUME,
};

export default CodePush(codePushOptions)(App);
