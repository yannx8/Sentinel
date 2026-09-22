import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

function ReporterHomeScreen() {
  const { logout, user } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome Reporter: {user?.email}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={logout}>
        <Text style={styles.primaryButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const Stack = createStackNavigator();

export default function ReporterNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ReporterHome" component={ReporterHomeScreen} options={{ title: 'Reporter Dashboard' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FAF9F8',
    padding: 24
  },
  text: { 
    fontSize: 20, 
    fontWeight: '600',
    marginBottom: 24,
    color: '#242424'
  },
  primaryButton: {
    backgroundColor: '#0F6CBD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  }
});
