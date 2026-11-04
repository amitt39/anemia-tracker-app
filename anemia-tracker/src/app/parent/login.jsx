import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  requestParentOtp,
  validateIndianMobileNumber,
  verifyParentOtp,
} from '../../lib/school-api';
import { AuthHeader, AuthLayout, ErrorText, FormCard, InfoCard, InputField, PrimaryButton, authStyles } from '../../components/auth-ui';
import { hasStoredSession } from '../../lib/navigation';

export default function ParentLogin() {
  const { reason } = useLocalSearchParams();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    reason === 'session_expired' ? 'Your session expired. Please sign in again.' : '',
  );
  const [messageType, setMessageType] = useState(
    reason === 'session_expired' ? 'error' : '',
  );
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    hasStoredSession('parent_token').then((hasSession) => {
      if (!mounted) return;
      if (hasSession) {
        router.replace('/parent/dashboard');
        return;
      }
      setCheckingSession(false);
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });
    return () => { mounted = false; };
  }, []);

  function showMessage(text, type = 'error') {
    setMessage(text);
    setMessageType(type);
  }

  function resetOtpStep() {
    if (busy) return;
    setSent(false);
    setOtp('');
    setMessage('');
    setMessageType('');
  }

  async function submit() {
    if (busy) return;

    const validation = validateIndianMobileNumber(phone);
    if (!validation.valid) {
      showMessage(
        validation.reason === 'incomplete'
          ? 'Enter a complete 10-digit Indian mobile number.'
          : validation.reason === 'prefix'
            ? 'Indian mobile numbers must start with 6, 7, 8, or 9.'
            : 'Enter a valid Indian mobile number.',
      );
      return;
    }

    if (sent && !/^\d{6}$/.test(otp)) {
      showMessage('Enter the 6-digit OTP.');
      return;
    }

    setBusy(true);
    setMessage('');
    setMessageType('');

    try {
      if (!sent) {
        await requestParentOtp(validation.normalized);
        setSent(true);
        showMessage('OTP sent. It expires after a short time.', 'success');
      } else {
        const result = await verifyParentOtp(validation.normalized, otp);
        await AsyncStorage.setItem('parent_token', result.token);
        await AsyncStorage.setItem('parent_id', String(result.parent_id));
        await AsyncStorage.setItem('parent_phone', validation.normalized);
        router.replace('/parent/dashboard');
      }
    } catch (error) {
      showMessage(error.message || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return <View style={authStyles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={authStyles.profileLoadingText}>Checking your session…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="Parent portal" onBack={() => router.replace('/role-selection')} />
      <View style={authStyles.registrationIntro}>
        <Text style={authStyles.registrationBadge}>Parent access</Text>
        <Text style={authStyles.registrationTitle}>Stay close to your child’s care.</Text>
        <Text style={authStyles.registrationText}>Use the phone number registered with the school. We’ll send a one-time code to keep access secure.</Text>
      </View>
      <FormCard>
        <InputField label="Registered phone number" icon="☎" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" editable={!sent && !busy} />
        {sent ? <InputField label="One-time password" hint="6 digits" icon="#" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter the code" keyboardType="numeric" editable={!busy} /> : null}
        <ErrorText>{messageType === 'error' ? message : ''}</ErrorText>
        {messageType === 'success' ? <Text style={authStyles.profileSuccessText}>{message}</Text> : null}
        <PrimaryButton label={sent ? 'Verify OTP' : 'Send OTP'} loading={busy} onPress={submit} />
        {sent ? <Pressable onPress={resetOtpStep} disabled={busy}><Text style={authStyles.inlineLink}>Use a different phone number</Text></Pressable> : null}
      </FormCard>
      <InfoCard icon="✓" title="Private by design">Only your child’s verified health records and school follow-up information are shown.</InfoCard>
      <View style={authStyles.footerLinks}><Link href="/role-selection" style={authStyles.footerMuted}>Choose another role</Link></View>
    </AuthLayout>
  );
}
