import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, createTeacher, getTeachers } from '../../lib/school-api';

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
  outline: '#837378',
  outlineVariant: '#d5c2c7',
};

const EMPTY_FORM = { first_name: '', last_name: '', email: '', password: '' };

export default function Teachers() {
  const [token, setToken] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const redirectIfExpired = useCallback(async (requestError) => {
    if (requestError.code !== 'SESSION_EXPIRED') return false;
    await clearSchoolSession();
    router.replace('/school/login?reason=session_expired');
    return true;
  }, []);

  const load = useCallback(async (authToken) => {
    const result = await getTeachers(authToken);
    setTeachers(result.teachers || []);
    setError('');
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('token').then(async (value) => {
      if (!value) {
        router.replace('/school/login');
        return;
      }
      if (mounted) setToken(value);
      try {
        await load(value);
      } catch (requestError) {
        if (!(await redirectIfExpired(requestError)) && mounted) setError(requestError.message || 'Unable to load teachers.');
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [load, redirectIfExpired]);

  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await load(token);
    } catch (requestError) {
      if (!(await redirectIfExpired(requestError))) setError(requestError.message || 'Unable to refresh teachers.');
    } finally {
      setRefreshing(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  }

  async function save() {
    if (busy) return;
    const email = form.email.trim().toLowerCase();
    if (!form.first_name.trim() || !form.last_name.trim() || !/^\S+@\S+\.\S+$/.test(email) || form.password.length < 8) {
      setError('Enter first name, last name, a valid email, and a password of at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await createTeacher(token, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email,
        password: form.password,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessage('Teacher added successfully.');
      await load(token);
    } catch (requestError) {
      if (!(await redirectIfExpired(requestError))) setError(requestError.message || 'Unable to add teacher.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Loading teachers…</Text></View>;

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/dashboard')}><Text style={styles.back}>‹  Dashboard</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><Text style={styles.heroIconText}>▣</Text></View>
          <Text style={styles.eyebrow}>People & access</Text>
          <Text style={styles.title}>Teacher roster</Text>
          <Text style={styles.subtitle}>Manage the teachers who record screenings and support assigned classrooms.</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
          <Pressable onPress={() => router.push('/school/profile')}><Text style={styles.navLink}>Profile</Text></Pressable>
        </View>

        {message ? <View style={styles.successBox}><Text style={styles.successText}>✓  {message}</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{teachers.length}</Text><Text style={styles.summaryLabel}>Total teachers</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{teachers.filter((teacher) => teacher.is_active).length}</Text><Text style={styles.summaryLabel}>Active accounts</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Your teachers</Text><Text style={styles.sectionHint}>Select a teacher to view or manage their account.</Text></View>
          <Pressable style={styles.primaryButton} onPress={() => { setShowForm((current) => !current); setError(''); }}><Text style={styles.primaryButtonText}>{showForm ? 'Close' : '+ Add teacher'}</Text></Pressable>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add a teacher account</Text>
            <Text style={styles.formHint}>Share the temporary password securely with the teacher.</Text>
            <Field label="First name" value={form.first_name} onChangeText={(value) => updateForm('first_name', value)} placeholder="Aarav" />
            <Field label="Last name" value={form.last_name} onChangeText={(value) => updateForm('last_name', value)} placeholder="Sharma" />
            <Field label="Email" value={form.email} onChangeText={(value) => updateForm('email', value)} placeholder="teacher@school.edu" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Temporary password" value={form.password} onChangeText={(value) => updateForm('password', value)} placeholder="At least 8 characters" secureTextEntry />
            <Pressable disabled={busy} style={[styles.saveButton, busy && styles.disabled]} onPress={save}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Create teacher account</Text>}
            </Pressable>
          </View>
        ) : null}

        {teachers.length ? teachers.map((teacher) => (
          <Pressable key={teacher.teacher_id} style={({ pressed }) => [styles.teacherCard, pressed && styles.pressed]} onPress={() => router.push(`/school/teachers/${teacher.teacher_id}`)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{`${teacher.first_name || ''}${teacher.last_name || ''}`.trim().slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.teacherCopy}>
              <View style={styles.teacherNameRow}><Text style={styles.teacherName}>{teacher.first_name} {teacher.last_name}</Text><Text style={[styles.status, teacher.is_active ? styles.statusActive : styles.statusInactive]}>{teacher.is_active ? 'Active' : 'Inactive'}</Text></View>
              <Text style={styles.teacherEmail}>{teacher.email}</Text>
              <Text style={styles.openLink}>View teacher details →</Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No teachers yet</Text><Text style={styles.muted}>Add your first teacher to start assigning classroom screening work.</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', secureTextEntry = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.outline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.background },
  topBar: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  back: { color: COLORS.primaryContainer, fontSize: 14, fontWeight: '700' },
  topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { backgroundColor: COLORS.low, borderRadius: 16, padding: 20 },
  heroIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroIconText: { color: '#fff', fontSize: 20 },
  eyebrow: { color: COLORS.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, marginTop: 3 },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingVertical: 2 },
  navLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  successBox: { backgroundColor: COLORS.tertiaryFixed, borderRadius: 10, padding: 12 },
  successText: { color: COLORS.tertiary, fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: '#ffdad6', borderRadius: 10, padding: 12 },
  errorText: { color: '#93000a', fontSize: 13, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flex: 1, minWidth: 130, backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#ead8df' },
  summaryValue: { color: COLORS.primary, fontSize: 28, fontWeight: '700' },
  summaryLabel: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  primaryButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ead8df', gap: 2 },
  formTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  formHint: { color: COLORS.muted, fontSize: 12, marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  input: { minHeight: 46, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, backgroundColor: COLORS.surface },
  saveButton: { minHeight: 46, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: COLORS.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#ead8df' },
  pressed: { opacity: 0.8 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  teacherCopy: { flex: 1, gap: 3 },
  teacherNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  teacherName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  status: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '700' },
  statusActive: { color: COLORS.tertiary, backgroundColor: COLORS.tertiaryFixed },
  statusInactive: { color: '#93000a', backgroundColor: '#ffdad6' },
  teacherEmail: { color: COLORS.muted, fontSize: 12 },
  openLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#ead8df' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  muted: { color: COLORS.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
