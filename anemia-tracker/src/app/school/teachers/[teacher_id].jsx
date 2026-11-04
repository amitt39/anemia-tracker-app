import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getTeacher, updateTeacher, updateTeacherStatus } from '../../../lib/school-api';

const COLORS = {
  background: '#fcf9f4',
  surface: '#ffffff',
  low: '#f6f3ee',
  primary: '#59253e',
  primaryContainer: '#743b55',
  secondary: '#97425d',
  secondaryFixed: '#ffd9e1',
  tertiary: '#1d3d33',
  tertiaryFixed: '#c7eadc',
  text: '#1c1c19',
  muted: '#514348',
  outlineVariant: '#d5c2c7',
};

export default function TeacherDetails() {
  const { teacher_id: teacherId } = useLocalSearchParams();
  const [token, setToken] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (value) => {
      if (!value) {
        router.replace('/school/login');
        return;
      }
      setToken(value);
      try {
        const result = await getTeacher(value, teacherId);
        setTeacher(result.teacher);
      } catch (requestError) {
        if (requestError.code === 'SESSION_EXPIRED') {
          await clearSchoolSession();
          router.replace('/school/login?reason=session_expired');
        } else setError(requestError.message || 'Unable to load teacher details.');
      } finally {
        setLoading(false);
      }
    });
  }, [teacherId]);

  async function save() {
    const firstName = teacher.first_name.trim();
    const lastName = teacher.last_name.trim();
    const email = teacher.email.trim().toLowerCase();
    if (!firstName || !lastName || !email) return setError('First name, last name, and email are required.');
    if (firstName.length > 50 || lastName.length > 50 || email.length > 255 || !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter valid teacher details within the allowed lengths.');

    setSaving(true);
    setError('');
    try {
      const result = await updateTeacher(token, teacherId, { first_name: firstName, last_name: lastName, email });
      setTeacher(result.teacher);
      setError('Teacher details saved.');
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await clearSchoolSession();
        router.replace('/school/login?reason=session_expired');
      } else setError(requestError.message || 'Unable to save teacher details.');
    } finally {
      setSaving(false);
    }
  }

  function confirmStatusChange() {
    const nextStatus = !teacher.is_active;
    const title = nextStatus ? 'Reactivate teacher?' : 'Deactivate teacher?';
    const message = nextStatus ? 'This teacher will be able to sign in again.' : 'Historical screening records are preserved, but this teacher will no longer be able to sign in.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) changeStatus(nextStatus);
      return;
    }
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: nextStatus ? 'Reactivate' : 'Deactivate', style: nextStatus ? 'default' : 'destructive', onPress: () => changeStatus(nextStatus) }]);
  }

  async function changeStatus(isActive) {
    setSaving(true);
    setError('');
    try {
      const result = await updateTeacherStatus(token, teacherId, isActive);
      setTeacher(result.teacher);
      setError(isActive ? 'Teacher reactivated.' : 'Teacher deactivated.');
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await clearSchoolSession();
        router.replace('/school/login?reason=session_expired');
      } else setError(requestError.message || 'Unable to update teacher status.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Loading teacher details…</Text></View>;
  if (!teacher) return <View style={styles.center}><Text style={styles.error}>{error || 'Teacher not found.'}</Text><Back /></View>;

  const initials = `${teacher.first_name || ''}${teacher.last_name || ''}`.trim().slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.back}>‹  Teacher roster</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Teacher account</Text>
            <Text style={styles.title}>{teacher.first_name} {teacher.last_name}</Text>
            <Text style={styles.subtitle}>Edit account details and control access to screening workflows.</Text>
          </View>
          <Text style={[styles.status, teacher.is_active ? styles.activeStatus : styles.inactiveStatus]}>{teacher.is_active ? 'Active' : 'Inactive'}</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
          <Pressable onPress={() => router.push('/school/profile')}><Text style={styles.navLink}>Profile</Text></Pressable>
        </View>

        <View style={styles.metaCard}><Text style={styles.metaLabel}>Teacher ID</Text><Text style={styles.metaValue}>#{teacher.teacher_id}</Text><Text style={styles.metaHint}>Account status: {teacher.is_active ? 'can sign in and record assigned screenings' : 'sign-in disabled; historical records remain available'}</Text></View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <Text style={styles.sectionHint}>Keep the teacher’s contact details current.</Text>
          <Field label="First name" value={teacher.first_name} onChangeText={(value) => { setTeacher({ ...teacher, first_name: value }); setError(''); }} placeholder="First name" />
          <Field label="Last name" value={teacher.last_name} onChangeText={(value) => { setTeacher({ ...teacher, last_name: value }); setError(''); }} placeholder="Last name" />
          <Field label="Email" value={teacher.email} onChangeText={(value) => { setTeacher({ ...teacher, email: value }); setError(''); }} placeholder="teacher@school.edu" keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.errorBox}>{error}</Text> : null}
          <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save account details</Text>}</Pressable>
        </View>

        <View style={styles.securityCard}>
          <Text style={styles.sectionTitle}>Access control</Text>
          <Text style={styles.sectionHint}>{teacher.is_active ? 'Deactivate access when the teacher leaves the screening program.' : 'Reactivate access when the teacher returns to the program.'}</Text>
          <Pressable disabled={saving} style={[styles.secondaryButton, teacher.is_active && styles.dangerButton]} onPress={confirmStatusChange}><Text style={[styles.secondaryText, teacher.is_active && styles.dangerText]}>{teacher.is_active ? 'Deactivate teacher' : 'Reactivate teacher'}</Text></Pressable>
        </View>

        <Back />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={COLORS.muted} keyboardType={keyboardType} autoCapitalize={autoCapitalize} /></View>;
}

function Back() {
  return <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/school/dashboard'))}><Text style={styles.backLink}>Back to dashboard</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, padding: 20 },
  topBar: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: COLORS.primaryContainer, fontSize: 14, fontWeight: '700' },
  topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.low, borderRadius: 16, padding: 20, flexWrap: 'wrap' },
  avatar: { width: 60, height: 60, borderRadius: 19, backgroundColor: COLORS.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  heroCopy: { flex: 1, minWidth: 200 },
  eyebrow: { color: COLORS.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 27, lineHeight: 35, marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  status: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  activeStatus: { color: COLORS.tertiary, backgroundColor: COLORS.tertiaryFixed },
  inactiveStatus: { color: '#93000a', backgroundColor: '#ffdad6' },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  navLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  metaCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ead8df' },
  metaLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { color: COLORS.primary, fontSize: 24, fontWeight: '700', marginTop: 3 },
  metaHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ead8df' },
  securityCard: { backgroundColor: COLORS.low, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ead8df' },
  sectionTitle: { color: COLORS.primary, fontSize: 17, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  field: { marginBottom: 12 },
  fieldLabel: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  input: { minHeight: 46, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, backgroundColor: COLORS.surface },
  primaryButton: { minHeight: 46, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  dangerButton: { borderColor: '#fecdca' },
  dangerText: { color: '#b42318' },
  errorBox: { color: '#93000a', backgroundColor: '#ffdad6', borderRadius: 9, padding: 10, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  disabled: { opacity: 0.65 },
  error: { color: '#93000a', textAlign: 'center', lineHeight: 18 },
  muted: { color: COLORS.muted, fontSize: 13 },
  backLink: { color: COLORS.secondary, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
});
