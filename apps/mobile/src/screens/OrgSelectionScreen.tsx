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
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', marginTop: 40 },
  item: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  itemText: { fontSize: 18 },
});
