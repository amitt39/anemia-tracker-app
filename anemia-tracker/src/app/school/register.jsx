import { useEffect, useState } from 'react';
import { Link, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, View } from 'react-native';
import { registerSchool } from '../../lib/school-api';
import { AuthHeader, AuthLayout, ErrorText, InfoCard, InputField, PrimaryButton, authStyles as styles } from '../../components/auth-ui';
import { hasStoredSession } from '../../lib/navigation';

const initialErrors = { school_name: '', email: '', password: '', confirmPassword: '', form: '' };

export default function Register() {
  const [form, setForm] = useState({ school_name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState(initialErrors);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasStoredSession('token').then((hasSession) => {
      if (!mounted) return;
      if (hasSession) {
        router.replace('/school/dashboard');
        return;
      }
      setCheckingSession(false);
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });
    return () => { mounted = false; };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '', form: '' }));
  }

  function validate() {
    const next = { ...initialErrors };
    const schoolName = form.school_name.trim();
    const email = form.email.trim();
    if (!schoolName) next.school_name = 'School name is required.';
    else if (schoolName.length > 100) next.school_name = 'School name must be 100 characters or fewer.';
    if (!email) next.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.';
    else if (email.length > 255) next.email = 'Email must be 255 characters or fewer.';
    if (!form.password) next.password = 'Password is required.';
    else if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    if (loading || !validate()) return;
    setLoading(true);
    try {
      const result = await registerSchool({ school_name: form.school_name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      await AsyncStorage.setItem('token', result.token);
      await AsyncStorage.setItem('school_id', String(result.school_id));
      router.replace('/school/dashboard');
    } catch (error) {
      setErrors((current) => ({ ...current, form: error.message || 'Unable to create your account. Please try again.' }));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <View style={styles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={styles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="School Registration" onBack={() => router.replace('/role-selection')} />

      <View style={styles.registrationIntro}>
        <Text style={styles.registrationBadge}>⌂  Institutional Setup</Text>
        <Text style={styles.registrationTitle}>Register Your School</Text>
        <Text style={styles.registrationText}>Create an administrator account to set up your school health tracking workspace.</Text>
      </View>

      <InfoCard icon="♡" title="Secure Health Portal" tone="high">Configured specifically for adolescent health screening and confidential hemoglobin tracking.</InfoCard>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}><View style={styles.sectionDot} /><Text style={styles.sectionTitle}>1. School Details</Text></View>
        <InputField label="School Name" hint="Required" icon="⌂" value={form.school_name} onChangeText={(value) => updateField('school_name', value)} placeholder="e.g., Oakridge High School" editable={!loading} />
        <ErrorText>{errors.school_name}</ErrorText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}><View style={styles.sectionDot} /><Text style={styles.sectionTitle}>2. Administrator Information</Text></View>
        <InputField label="Official Admin Email" icon="@" value={form.email} onChangeText={(value) => updateField('email', value)} placeholder="e.g., principal@oakridge.edu" keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!loading} />
        <Text style={styles.fieldHelper}>Verification notices and health record sync links will arrive here.</Text>
        <ErrorText>{errors.email}</ErrorText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}><View style={styles.sectionDot} /><Text style={styles.sectionTitle}>3. Account Security</Text></View>
        <InputField label="Create Password" hint="Min. 8 characters" icon="▣" value={form.password} onChangeText={(value) => updateField('password', value)} placeholder="••••••••" secureTextEntry={!showPassword} onToggleSecure={() => setShowPassword((value) => !value)} autoComplete="new-password" editable={!loading} />
        <ErrorText>{errors.password}</ErrorText>
        <InputField label="Confirm Password" icon="↻" value={form.confirmPassword} onChangeText={(value) => updateField('confirmPassword', value)} placeholder="••••••••" secureTextEntry={!showConfirmPassword} onToggleSecure={() => setShowConfirmPassword((value) => !value)} autoComplete="new-password" editable={!loading} />
        <ErrorText>{errors.confirmPassword}</ErrorText>
      </View>

      <View style={styles.privacy}>
        <Text style={styles.privacyIcon}>✓</Text>
        <Text style={styles.privacyText}>By registering, you confirm you are an authorized school official. Student health records are stored securely with strict medical confidentiality.</Text>
      </View>

      <ErrorText>{errors.form}</ErrorText>
      <PrimaryButton label="Register School" loading={loading} onPress={submit} />
      <View style={styles.footerLinks}>
        <Text style={styles.footerMuted}>Already registered? <Link href="/school/login" style={styles.footerLink}>Sign in as School Admin</Link></Text>
      </View>
    </AuthLayout>
  );
}
