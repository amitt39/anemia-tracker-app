import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { completeSchoolPasswordReset, verifySchoolPasswordReset } from '../../lib/school-api';
import { AuthHeader, AuthLayout, ErrorText, FormCard, HintText, InputField, PrimaryButton, authStyles as styles } from '../../components/auth-ui';
import { hasStoredSession } from '../../lib/navigation';

export default function ResetPassword() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(String(params.email || ''));
  const [otp, setOtp] = useState(String(params.devOtp || ''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [verified, setVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  async function verify() {
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim().toLowerCase())) {
      setError('Enter a valid administrator email address.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit reset code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await verifySchoolPasswordReset(email.trim().toLowerCase(), otp);
      setResetToken(result.reset_token || '');
      setVerified(true);
    } catch (requestError) {
      setError(requestError.message || 'Unable to verify the reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    if (loading) return;
    if (!verified) {
      setError('Verify the reset code before choosing a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await completeSchoolPasswordReset(resetToken, password);
      await AsyncStorage.multiRemove(['token', 'school_id']);
      router.replace('/school/login?reason=password_reset');
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <View style={styles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={styles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="Reset Password" onBack={() => router.replace('/school/login')} />
      <Text style={styles.registrationBadge}>▣  School Admin Portal</Text>
      <Text style={styles.registrationTitle}>{verified ? 'Choose a new password' : 'Verify reset code'}</Text>
      <Text style={styles.registrationText}>{verified ? 'Your code is verified. Create a new password for your school account.' : 'Enter the 6-digit code sent to your administrator email.'}</Text>

      <FormCard>
        <InputField label="Admin Email" icon="@" value={email} onChangeText={setEmail} placeholder="admin@school.edu" keyboardType="email-address" autoCapitalize="none" editable={!verified && !loading} />
        {!verified ? <>
          <InputField label="Reset Code" hint="6 digits" icon="#" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" keyboardType="numeric" editable={!loading} />
          {params.devOtp ? <HintText positive>Development mode: the local reset code was prefilled.</HintText> : null}
          <ErrorText>{error}</ErrorText>
          <PrimaryButton label="Verify Code" loading={loading} onPress={verify} />
        </> : <>
          <InputField label="New Password" hint="Min. 8 characters" icon="▣" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry={!showPassword} onToggleSecure={() => setShowPassword((value) => !value)} autoComplete="new-password" editable={!loading} />
          <InputField label="Confirm Password" icon="↻" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secureTextEntry={!showConfirm} onToggleSecure={() => setShowConfirm((value) => !value)} autoComplete="new-password" editable={!loading} />
          <ErrorText>{error}</ErrorText>
          <PrimaryButton label="Reset Password" loading={loading} onPress={complete} />
        </>}
      </FormCard>

      <Text style={styles.recoveryFooter}>Remember your password? <Link href="/school/login" style={styles.footerLink}>Back to sign in</Link></Text>
    </AuthLayout>
  );
}
