import React, { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as authApi from "@/api/auth";
import { onLoginSuccess } from "@/auth/authManager";
import type { LoginScreenProps } from "@/navigation/types";

export default function LoginScreen({ route }: LoginScreenProps) {
  const { serverUrl } = route.params;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRef = React.useRef<TextInput>(null);

  async function handleLogin() {
    if (!username.trim()) {
      setError("Please enter your username or email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await authApi.login(serverUrl, username.trim(), password);
      await onLoginSuccess(
        serverUrl,
        res.access_token,
        res.refresh_token,
        res.user,
      );
      // Navigation to authenticated stack is handled by RootNavigator on state change
    } catch (err: unknown) {
      if (authApi.isAxiosAuthError(err) && err.response?.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError(
          "Could not connect to server. Check your network and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.serverLabel} numberOfLines={1}>
          {serverUrl}
        </Text>

        <Text style={styles.label}>Username or email</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : undefined]}
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            setError(null);
          }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          ref={passwordRef}
          style={[styles.input, error ? styles.inputError : undefined]}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          placeholder="••••••••"
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          editable={!loading}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          testID="login-button"
          style={[styles.button, loading ? styles.buttonDisabled : undefined]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  serverLabel: {
    fontSize: 13,
    color: "#888",
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1a1a1a",
    marginBottom: 16,
  },
  inputError: {
    borderColor: "#e53e3e",
  },
  errorText: {
    color: "#e53e3e",
    fontSize: 13,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
