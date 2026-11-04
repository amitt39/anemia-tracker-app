import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { loginTeacher, saveTeacherSession } from '../../lib/teacher-api';
import { AuthHeader, AuthLayout, ErrorText, FormCard, InfoCard, InputField, PrimaryButton, authStyles } from '../../components/auth-ui';
import { hasStoredSession } from '../../lib/navigation';

export default function TeacherLogin() {
  const { reason } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState(
    reason === 'session_expired' ? 'Your session expired. Please sign in again.' : ''
  );
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    hasStoredSession('teacher_token').then((hasSession) => {
      if (!mounted) return;
      if (hasSession) {
        router.replace('/teacher/dashboard');
        return;
      }
      setCheckingSession(false);
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });
    return () => { mounted = false; };
  }, []);

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

  if (checkingSession) {
    return <View style={authStyles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={authStyles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="Teacher portal" onBack={() => router.replace('/role-selection')} />
      <View style={authStyles.registrationIntro}>
        <Text style={authStyles.registrationBadge}>Teacher workspace</Text>
        <Text style={authStyles.registrationTitle}>Sign in to your classes.</Text>
        <Text style={authStyles.registrationText}>View assigned students, record Hb screenings, and keep tablet follow-up current.</Text>
      </View>
      <FormCard>
        <InputField label="Email address" icon="@" value={email} onChangeText={setEmail} placeholder="teacher@school.org" keyboardType="email-address" autoCapitalize="none" editable={!loading} />
        <InputField label="Password" icon="•" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry editable={!loading} />
        <InputField label="School ID" hint="Optional" icon="#" value={schoolId} onChangeText={setSchoolId} placeholder="Only needed if your email is shared" keyboardType="numeric" editable={!loading} />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton label="Sign in" loading={loading} onPress={handleLogin} />
      </FormCard>
      <InfoCard icon="i" title="Need school access?">Ask your school administrator to create or activate your teacher account.</InfoCard>
      <View style={authStyles.footerLinks}>
        <Link href="/school/login" style={authStyles.footerLink}>School admin sign in</Link>
        <Link href="/role-selection" style={authStyles.footerMuted}>Choose another role</Link>
      </View>
    </AuthLayout>
  );
}
