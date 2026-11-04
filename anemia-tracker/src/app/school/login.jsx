import { useEffect, useState } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Text } from 'react-native';
import { loginSchool } from '../../lib/school-api';
import { AuthHeader, AuthLayout, ErrorText, FormCard, HintText, InfoCard, InputField, PrimaryButton, authStyles as styles } from '../../components/auth-ui';

export default function Login() {
  const { reason } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(reason === 'session_expired' ? 'Your session expired. Please sign in again.' : '');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('token').then((token) => {
      if (!mounted) return;
      if (token) {
        router.replace('/school/dashboard');
        return;
      }
      setCheckingSession(false);
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });
    return () => { mounted = false; };
  }, []);

  async function submit() {
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await loginSchool({ email: normalizedEmail, password });
      await AsyncStorage.setItem('token', result.token);
      await AsyncStorage.setItem('school_id', String(result.school_id));
      router.replace('/school/dashboard');
    } catch (requestError) {
      setError(requestError.code === 'SCHOOL_NOT_REGISTERED'
        ? 'School not registered yet. Please register your school first.'
        : (requestError.message || 'Unable to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <View style={styles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={styles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="Admin Login" onBack={() => router.replace('/role-selection')} />

      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}><Text style={styles.heroIconText}>▣</Text></View>
          <View>
            <Text style={styles.eyebrow}>Institutional Portal</Text>
            <Text style={styles.heroTitle}>Welcome back</Text>
          </View>
        </View>
        <Text style={styles.heroText}>Sign in to manage your school’s adolescent screening cohorts and hemoglobin health records.</Text>
      </View>

      <View style={styles.reminder}>
        <Text style={styles.reminderIcon}>ⓘ</Text>
        <Text style={styles.reminderText}>Looking for Teacher or Parent access? <Link href="/role-selection" style={styles.reminderLink}>Choose another role</Link>.</Text>
      </View>

      <FormCard>
        <InputField label="Admin Email" hint="Official domain" icon="@" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="admin@oakridgehigh.edu" keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!loading} />
        <HintText positive>Use your registered school administrative email</HintText>
        <InputField label="Password" hint="Secure portal" icon="▣" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="••••••••••••" secureTextEntry={!showPassword} onToggleSecure={() => setShowPassword((value) => !value)} autoComplete="password" editable={!loading} />
        <HintText>Standard school board encrypted credentials</HintText>
        <View style={styles.institutionBadge}>
          <Text style={styles.institutionIcon}>✓</Text>
          <View style={styles.institutionCopy}>
            <Text style={styles.institutionTitle}>Verified school portal</Text>
            <Text style={styles.institutionText}>Authorized administrative access</Text>
          </View>
        </View>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton label="Sign In" loading={loading} onPress={submit} />
        <Link href="/school/forgot-password" style={styles.inlineLink}>Forgot password?</Link>
      </FormCard>

      <InfoCard icon="♡" title="Term 2 Screening Cycle Active">Your school health workspace is ready for confidential hemoglobin tracking.</InfoCard>

      <View style={styles.footerLinks}>
        <Link href="/school/register" style={styles.footerLink}>Register Your School  ↗</Link>
        <Link href="/role-selection" style={styles.footerMuted}>‹  Choose another role</Link>
      </View>
    </AuthLayout>
  );
}
