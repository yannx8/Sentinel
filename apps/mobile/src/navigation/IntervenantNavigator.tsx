import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import IntervenantTabNavigator from './IntervenantTabNavigator';

const Stack = createStackNavigator();

export default function IntervenantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="IntervenantHome" component={IntervenantTabNavigator} />
    </Stack.Navigator>
  );
}
