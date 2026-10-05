import React, { useState } from "react";
import { ActivityIndicator, View, Text, TouchableOpacity, Image, StyleSheet, TextInput } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import ReporterNavigator from "./ReporterNavigator";
import IntervenantNavigator from "./IntervenantNavigator";
import { apiClient } from "../api";

function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      // Call standard auth login endpoint
      const response = await apiClient.post<{ token: string, user: any }>("/auth/login", { email, password });
      if (response.token && response.user) {
        await signIn(response.token, response.user);
      }
    } catch (err) {
      console.error("Sign in error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <View style={styles.logoContainer}>
        <Image 
          source={require("../../assets/logo.jpg")} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Sentinel</Text>
        <Text style={styles.subtitle}>Incident Tracking Platform</Text>
      </View>

      <View style={styles.buttonContainer}>
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
        <TouchableOpacity 
          style={styles.button}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MainNavigation() {
  const { user, orgRole } = useAuth();
  const isIntervenant = orgRole === "org:admin" || orgRole === "org:member";

  return (
    <NavigationContainer>
      {isIntervenant ? <IntervenantNavigator /> : <ReporterNavigator />}
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  const { isLoaded, user } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {user ? <MainNavigation /> : <SignInScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    backgroundColor: "#FAF9F8",
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#242424",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#605E5C",
  },
  buttonContainer: {
    width: "100%",
  },
  input: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E1DFDD",
  },
  button: {
    backgroundColor: "#0F6CBD",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  }
});

