import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { apiClient } from '../api';

type IncidentDTO = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export default function ReporterIncidentsScreen() {
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const data = await apiClient.get<{ items: IncidentDTO[] }>('/incidents');
      setIncidents(data.items || []);
    } catch (err) {
      console.error('Failed to fetch incidents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#0B4F8A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mes Incidents</Text>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.details}>Statut: {item.status}</Text>
            <Text style={styles.details}>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchIncidents}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#242424',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDEBE9',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 8,
  },
  details: {
    fontSize: 14,
    color: '#605E5C',
    marginBottom: 4,
  },
});
