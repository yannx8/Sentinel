import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ReporterTabNavigator from './ReporterTabNavigator';

const Stack = createStackNavigator();

export default function ReporterNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReporterHome" component={ReporterTabNavigator} />
    </Stack.Navigator>
  );
}
