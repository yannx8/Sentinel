import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ReporterIncidentsScreen from '../screens/ReporterIncidentsScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

export default function ReporterTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0B4F8A',
        tabBarInactiveTintColor: '#605E5C',
      }}
    >
      <Tab.Screen 
        name="Report" 
        component={ReportIncidentScreen} 
        options={{ tabBarLabel: 'Report' }} 
      />
      <Tab.Screen 
        name="Mes incidents" 
        component={ReporterIncidentsScreen} 
        options={{ tabBarLabel: 'Mes incidents' }} 
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
