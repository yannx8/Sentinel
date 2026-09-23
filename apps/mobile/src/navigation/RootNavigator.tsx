import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { UserRole } from '@sentinel/shared';
import { useAuth } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import ReporterNavigator from './ReporterNavigator';
import IntervenantNavigator from './IntervenantNavigator';

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : user.roles?.includes(UserRole.RESPONSABLE) || user.roles?.includes(UserRole.ADMINISTRATOR) ? (
        <IntervenantNavigator />
      ) : (
        <ReporterNavigator />
      )}
    </NavigationContainer>
  );
}
