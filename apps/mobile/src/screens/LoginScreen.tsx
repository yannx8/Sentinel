import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiClient } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      const response = await apiClient.post<{ token: string, user: any }>('/auth/login', {
        email,
        password,
      });
      await login(response.token, response.user);
      // Removed Alert here because navigation will re-render automatically via the AuthContext
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
        <Text style={styles.primaryButtonText}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation?.navigate('Register')}>
        <Text style={styles.secondaryButtonText}>Go to Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center',
    backgroundColor: '#FAF9F8' 
  },
  title: { 
    fontSize: 28, 
    fontWeight: '600', 
    marginBottom: 24, 
    textAlign: 'center',
    color: '#242424'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#D1D1D1', 
    padding: 12, 
    marginBottom: 16, 
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#242424'
  },
  primaryButton: {
    backgroundColor: '#0F6CBD',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0F6CBD',
    fontSize: 16,
    fontWeight: '500',
  }
});
