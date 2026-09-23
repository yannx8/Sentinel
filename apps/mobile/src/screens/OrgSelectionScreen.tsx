import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiClient, setAuthToken } from '../api';
import { Organization } from '@sentinel/shared';

export default function OrgSelectionScreen({ navigation }: any) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Organization[]>('/organizations');
      setOrganizations(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const selectOrganization = async (orgId: string) => {
    try {
      const response = await apiClient.post<{ token: string }>('/auth/session', { organizationId: orgId });
      await setAuthToken(response.token);
      Alert.alert('Success', 'Organization selected successfully!');
      // Navigate to main app
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to select organization');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Organization</Text>
      <FlatList
        data={organizations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => selectOrganization(item.id)}>
            <Text style={styles.itemText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 24,
    backgroundColor: '#FAF9F8' 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FAF9F8'
  },
  title: { 
    fontSize: 28, 
    fontWeight: '600', 
    marginBottom: 24, 
    textAlign: 'center', 
    marginTop: 48,
    color: '#242424'
  },
  item: { 
    padding: 16, 
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EBEBEB'
  },
  itemText: { 
    fontSize: 16,
    color: '#242424',
    fontWeight: '500'
  },
});
