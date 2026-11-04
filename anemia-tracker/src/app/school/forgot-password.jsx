import { useEffect, useState } from 'react';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { requestSchoolPasswordReset } from '../../lib/school-api';
import { AuthHeader, AuthLayout, ErrorText, FormCard, InfoCard, InputField, PrimaryButton, authStyles as styles } from '../../components/auth-ui';
import { hasStoredSession } from '../../lib/navigation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

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

  async function submit() {
    const value = email.trim().toLowerCase();
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await requestSchoolPasswordReset(value);
      router.push({
        pathname: '/school/reset-password',
        params: { email: value, devOtp: result.otp || '' },
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to request password recovery.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <View style={styles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={styles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="Password Recovery" onBack={() => router.replace('/school/login')} />
      <Text style={styles.registrationBadge}>▣  Secure account access</Text>
      <Text style={styles.registrationTitle}>Forgot password?</Text>
      <Text style={styles.registrationText}>Enter your registered School Admin email and we’ll send a secure reset code.</Text>

      <InfoCard icon="✓" title="Protected recovery">Your school health records remain private throughout the recovery process.</InfoCard>

      <FormCard>
        <InputField
          label="Admin Email"
          hint="Required"
          icon="@"
          value={email}
          onChangeText={(value) => { setEmail(value); setError(''); }}
          placeholder="admin@school.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton label="Send Reset Code" loading={loading} onPress={submit} />
      </FormCard>

      <Text style={styles.recoveryFooter}>Remember your password? <Link href="/school/login" style={styles.footerLink}>Back to sign in</Link></Text>
    </AuthLayout>
  );
}
