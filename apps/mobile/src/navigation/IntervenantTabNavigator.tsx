import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FileScreen from '../screens/FileScreen';
import MapScreen from '../screens/MapScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function IntervenantTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0B4F8A',
        tabBarInactiveTintColor: '#605E5C',
      }}
    >
      <Tab.Screen 
        name="My work" 
        component={FileScreen} 
        options={{ tabBarLabel: 'My work' }} 
      />
      <Tab.Screen 
        name="History" 
        component={MapScreen} 
        options={{ tabBarLabel: 'History' }} 
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ tabBarLabel: 'Notifications' }} 
      />
      <Tab.Screen 
        name="Profil" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profil' }} 
      />
    </Tab.Navigator>
  );
}
