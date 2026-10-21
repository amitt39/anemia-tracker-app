import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { loginTeacher, saveTeacherSession } from './api';

export default function TeacherLogin() {
  const { reason } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState(
    reason === 'session_expired' ? 'Your session expired. Please sign in again.' : ''
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        email: cleanEmail,
        password,
      };
      if (schoolId.trim()) {
        const parsedSchoolId = parseInt(schoolId.trim(), 10);
        if (Number.isNaN(parsedSchoolId) || parsedSchoolId <= 0) {
          setError('School ID must be a positive number.');
          setLoading(false);
          return;
        }
        payload.school_id = parsedSchoolId;
      }

      const result = await loginTeacher(payload);
      await saveTeacherSession(result);
      router.replace('/teacher/dashboard');
    } catch (e) {
      setError(e.message || 'Unable to sign in as teacher.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.badge}>Teacher Portal</Text>
        <Text style={styles.title}>Teacher Sign In</Text>
        <Text style={styles.subtitle}>
          Sign in to view your assigned classes, students, and record health data.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="School ID (optional)"
          keyboardType="numeric"
          value={schoolId}
          onChangeText={setSchoolId}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={handleLogin}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <View style={styles.footerLinks}>
          <Link href="/school/login" style={styles.link}>
            School Admin Sign In
          </Link>
          <Link href="/" style={styles.linkMuted}>
            Return to Home
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    color: '#0d47a1',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  error: {
    color: '#b42318',
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#fee4e2',
    padding: 10,
    borderRadius: 6,
  },
  button: {
    backgroundColor: '#1565c0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  footerLinks: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eaecf0',
    paddingTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  link: {
    color: '#1565c0',
    fontSize: 14,
    fontWeight: '600',
  },
  linkMuted: {
    color: '#667085',
    fontSize: 13,
  },
});
