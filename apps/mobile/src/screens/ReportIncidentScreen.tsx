import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { apiClient } from '../api';

export default function ReportIncidentScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const submitReport = async () => {
    // Uses the user's defaultSiteId internally on the backend
    if (!title || !description || !category) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    
    try {
      setLoading(true);
      await apiClient.post('/incidents', { title, description, category });
      Alert.alert('Succès', 'Incident signalé avec succès.');
      setTitle('');
      setDescription('');
      setCategory('');
    } catch (err) {
      console.error('Failed to submit incident', err);
      Alert.alert('Erreur', 'Échec du signalement de l\'incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Signaler un incident</Text>
      
      <Text style={styles.label}>Titre</Text>
      <TextInput 
        style={styles.input} 
        value={title} 
        onChangeText={setTitle} 
        placeholder="Ex: Fuite d'eau" 
      />
      
      <Text style={styles.label}>Catégorie</Text>
      <TextInput 
        style={styles.input} 
        value={category} 
        onChangeText={setCategory} 
        placeholder="Ex: Plomberie" 
      />

      <Text style={styles.label}>Description</Text>
      <TextInput 
        style={[styles.input, styles.textArea]} 
        value={description} 
        onChangeText={setDescription} 
        placeholder="Décrivez l'incident..." 
        multiline
        numberOfLines={4}
      />
      
      <TouchableOpacity style={styles.submitButton} onPress={submitReport} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitButtonText}>Envoyer</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  content: {
    padding: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 24,
    marginTop: 40, // safe area approximation
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#242424',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDEBE9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#0B4F8A',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  }
});
