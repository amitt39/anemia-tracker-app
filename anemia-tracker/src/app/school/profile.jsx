import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  AuthHeader,
  AuthLayout,
  ErrorText,
  FormCard,
  InfoCard,
  InputField,
  PrimaryButton,
  authStyles as styles,
} from '../../components/auth-ui';
import { changeSchoolPassword, clearSchoolSession, getSchoolProfile, updateSchoolProfile } from '../../lib/school-api';
import { goBackOr } from '../../lib/navigation';

export default function SchoolProfile() {
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken) {
        router.replace('/school/login');
        return;
      }

      try {
        const result = await getSchoolProfile(storedToken);
        if (!mounted) return;
        const school = result.school || {};
        setToken(storedToken);
        setProfile(school);
        setSchoolName(school.school_name || '');
        setEmail(school.email || '');
      } catch (requestError) {
        if (!mounted) return;
        if (requestError.code === 'SESSION_EXPIRED') {
          await clearSchoolSession();
          router.replace('/school/login?reason=session_expired');
        } else {
          setProfileError(requestError.message || 'Unable to load your profile.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => { mounted = false; };
  }, []);

  async function saveProfile() {
    const cleanName = schoolName.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (savingProfile) return;
    if (!cleanName) {
      setProfileError('School name is required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setProfileError('Enter a valid email address.');
      return;
    }

    setSavingProfile(true);
    setProfileError('');
    setSuccessMessage('');
    try {
      const result = await updateSchoolProfile(token, { school_name: cleanName, email: cleanEmail });
      setProfile(result.school || profile);
      setSchoolName(result.school?.school_name || cleanName);
      setEmail(result.school?.email || cleanEmail);
      setSuccessMessage('Profile details saved.');
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await clearSchoolSession();
        router.replace('/school/login?reason=session_expired');
      } else {
        setProfileError(requestError.message || 'Unable to save profile details.');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (savingPassword) return;
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    setPasswordError('');
    setSuccessMessage('');
    try {
      const result = await changeSchoolPassword(token, currentPassword, newPassword);
      if (result.token) {
        await AsyncStorage.setItem('token', result.token);
        setToken(result.token);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSuccessMessage('Password updated securely.');
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await clearSchoolSession();
        router.replace('/school/login?reason=session_expired');
      } else {
        setPasswordError(requestError.message || 'Unable to update password.');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  async function logout() {
    await clearSchoolSession();
    router.replace('/school/login');
  }

  if (loading) {
    return <View style={styles.profileLoading}><ActivityIndicator color="#59253e" /><Text style={styles.profileLoadingText}>Loading profile…</Text></View>;
  }

  return (
    <AuthLayout>
      <AuthHeader title="School Profile" onBack={() => goBackOr('/school/dashboard')} />

      <View style={styles.profileIntro}>
        <Text style={styles.registrationBadge}>▣  Account settings</Text>
        <Text style={styles.registrationTitle}>Manage your school account</Text>
        <Text style={styles.registrationText}>Keep your school details current and protect access to health records.</Text>
      </View>

      {successMessage ? <View style={styles.profileSuccess}><Text style={styles.profileSuccessText}>✓  {successMessage}</Text></View> : null}
      {profileError ? <ErrorText>{profileError}</ErrorText> : null}

      <FormCard>
        <View style={styles.profileSectionHeader}>
          <View style={styles.profileSectionDot} />
          <Text style={styles.profileSectionTitle}>School details</Text>
        </View>
        <InputField
          label="School name"
          hint="Visible in the dashboard"
          icon="⌂"
          value={schoolName}
          onChangeText={(value) => { setSchoolName(value); setProfileError(''); setSuccessMessage(''); }}
          placeholder="Your school name"
          autoCapitalize="words"
          editable={!savingProfile}
        />
        <InputField
          label="Admin email"
          hint="Used for recovery"
          icon="@"
          value={email}
          onChangeText={(value) => { setEmail(value); setProfileError(''); setSuccessMessage(''); }}
          placeholder="admin@school.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!savingProfile}
        />
        <PrimaryButton label="Save profile details" loading={savingProfile} onPress={saveProfile} />
      </FormCard>

      <FormCard>
        <View style={styles.profileSectionHeader}>
          <View style={styles.profileSectionDot} />
          <Text style={styles.profileSectionTitle}>Password & security</Text>
        </View>
        <Text style={styles.profileSectionHint}>Change the password used by School Admins to sign in.</Text>
        {!showPasswordForm ? (
          <PrimaryButton
            label="Change password"
            onPress={() => { setShowPasswordForm(true); setPasswordError(''); setSuccessMessage(''); }}
          />
        ) : (
          <>
            <InputField
          label="Current password"
          icon="▣"
          value={currentPassword}
          onChangeText={(value) => { setCurrentPassword(value); setPasswordError(''); setSuccessMessage(''); }}
          placeholder="••••••••"
          secureTextEntry={!showCurrentPassword}
          onToggleSecure={() => setShowCurrentPassword((value) => !value)}
          autoComplete="current-password"
          editable={!savingPassword}
            />
            <InputField
          label="New password"
          hint="Min. 8 characters"
          icon="▣"
          value={newPassword}
          onChangeText={(value) => { setNewPassword(value); setPasswordError(''); setSuccessMessage(''); }}
          placeholder="••••••••"
          secureTextEntry={!showNewPassword}
          onToggleSecure={() => setShowNewPassword((value) => !value)}
          autoComplete="new-password"
          editable={!savingPassword}
            />
            <InputField
          label="Confirm new password"
          icon="↻"
          value={confirmPassword}
          onChangeText={(value) => { setConfirmPassword(value); setPasswordError(''); setSuccessMessage(''); }}
          placeholder="••••••••"
          secureTextEntry={!showConfirmPassword}
          onToggleSecure={() => setShowConfirmPassword((value) => !value)}
          autoComplete="new-password"
          editable={!savingPassword}
            />
            <ErrorText>{passwordError}</ErrorText>
            <PrimaryButton label="Update password" loading={savingPassword} onPress={savePassword} />
            <Pressable
              disabled={savingPassword}
              onPress={() => { setShowPasswordForm(false); setPasswordError(''); }}
              style={({ pressed }) => [styles.profileCancelPassword, pressed && styles.pressed]}
            >
              <Text style={styles.profileCancelPasswordText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </FormCard>

      <InfoCard icon="✓" title="Account protected">Your school health records stay private. Password changes sign out other active sessions.</InfoCard>

      <View style={styles.profileAccountMeta}>
        <Text style={styles.profileAccountMetaTitle}>Account information</Text>
        <Text style={styles.profileAccountMetaText}>School ID: {profile?.school_id || '—'}</Text>
        <Text style={styles.profileAccountMetaText}>Created: {formatDate(profile?.created_at)}</Text>
      </View>

      <Pressable onPress={logout} style={({ pressed }) => [styles.profileSignOut, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.profileSignOutText}>Sign out of School Admin</Text>
      </Pressable>
    </AuthLayout>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}
