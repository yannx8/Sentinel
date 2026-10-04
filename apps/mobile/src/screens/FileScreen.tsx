import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { apiClient } from '../api';

type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type IncidentStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type AssignmentStatus = 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REASSIGNMENT_REQUESTED' | 'COMPLETED' | 'CANCELLED';

interface Assignment {
  id: string;
  status: AssignmentStatus;
  incidentId: string;
}

interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  priority: Priority;
  createdAt: string;
  site?: { name: string };
  assignments?: Assignment[];
}

const priorityColors: Record<string, string> = {
  CRITICAL: '#B3261E',
  HIGH: '#B85400',
  MEDIUM: '#8A6A00',
  LOW: '#4B5F72',
  SUCCESS: '#12724A',
};

function IncidentCard({ 
  incident, 
  onAccept, 
  onRequestReassign 
}: { 
  incident: Incident; 
  onAccept: (assignmentId: string) => void;
  onRequestReassign: (assignmentId: string) => void;
}) {
  const activeAssignment = incident.assignments?.find(
    a => ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'].includes(a.status)
  );

  return (
    <View style={[styles.card, { borderLeftColor: priorityColors[incident.priority || 'LOW'] }]}>
      <View style={styles.cardContent}>
        <Text style={styles.title}>{incident.title}</Text>
        <Text style={styles.details}>{incident.site?.name || 'Localisation inconnue'}</Text>
        <Text style={styles.details}>Priorité: {incident.priority || 'LOW'}</Text>
        <Text style={styles.details}>Statut: {incident.status}</Text>
        <View style={styles.actionContainer}>
          {activeAssignment?.status === 'PENDING_ACCEPTANCE' && (
            <>
              <TouchableOpacity 
                style={styles.buttonOutline} 
                onPress={() => onRequestReassign(activeAssignment.id)}
              >
                <Text style={styles.buttonOutlineText}>Réaffecter</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.buttonPrimary} 
                onPress={() => onAccept(activeAssignment.id)}
              >
                <Text style={styles.buttonPrimaryText}>Accepter</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default function FileScreen() {
  const [activeTab, setActiveTab] = useState('new');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ items: Incident[] }>('/incidents');
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

  const handleAccept = async (assignmentId: string) => {
    try {
      await apiClient.post(`/assignments/${assignmentId}/accept`);
      Alert.alert('Succès', 'Assignation acceptée');
      fetchIncidents();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'accepter l\'assignation');
    }
  };

  const handleRequestReassign = async (assignmentId: string) => {
    try {
      await apiClient.post(`/assignments/${assignmentId}/reassignment-request`, { reason: 'Demande de réaffectation' });
      Alert.alert('Succès', 'Demande envoyée');
      fetchIncidents();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de demander la réaffectation');
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    if (activeTab === 'new') return incident.status === 'ASSIGNED';
    if (activeTab === 'in_progress') return incident.status === 'IN_PROGRESS';
    if (activeTab === 'history') return incident.status === 'RESOLVED' || incident.status === 'CLOSED';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.activeTab]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>A accepter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'in_progress' && styles.activeTab]}
          onPress={() => setActiveTab('in_progress')}
        >
          <Text style={[styles.tabText, activeTab === 'in_progress' && styles.activeTabText]}>En cours</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Historique</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0B4F8A" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredIncidents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IncidentCard 
              incident={item} 
              onAccept={handleAccept} 
              onRequestReassign={handleRequestReassign} 
            />
          )}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={fetchIncidents}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
    paddingTop: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDEBE9',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0B4F8A',
  },
  tabText: {
    fontSize: 14,
    color: '#605E5C',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#0B4F8A',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#605E5C',
    marginBottom: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  buttonOutline: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#0B4F8A',
    borderRadius: 4,
  },
  buttonOutlineText: {
    color: '#0B4F8A',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPrimary: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0B4F8A',
    borderRadius: 4,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
