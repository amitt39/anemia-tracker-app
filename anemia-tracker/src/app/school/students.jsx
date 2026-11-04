import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStudent, getClassrooms, getStudents, validateIndianMobileNumber } from '../../lib/school-api';

const EMPTY_FORM = { classroom_id: '', roll_number: '', first_name: '', last_name: '', parent_phone: '', relationship: '', relationship_description: '', parent_contact_unavailable: false };
const label = (classroom) => classroom?.grade_name && classroom?.section_name ? `${classroom.grade_name} – ${classroom.section_name}` : classroom?.class_name || 'Classroom';

export default function Students() {
  const [token, setToken] = useState('');
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(value) {
    const [studentResult, classroomResult] = await Promise.all([getStudents(value), getClassrooms(value)]);
    setStudents(studentResult.students || []);
    setClassrooms(classroomResult.classrooms || []);
  }

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (value) => {
      if (!value) {
        router.replace('/school/login');
        return;
      }
      setToken(value);
      try {
        await load(value);
      } catch (requestError) {
        if (requestError.code === 'SESSION_EXPIRED') {
          await AsyncStorage.removeItem('token');
          return router.replace('/school/login?reason=session_expired');
        }
        setError(requestError.message || 'Unable to load students.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  }

  function validate() {
    if (!form.classroom_id || !/^\d+$/.test(form.roll_number) || Number(form.roll_number) <= 0 || !form.first_name.trim() || !form.last_name.trim()) return 'Choose a classroom, positive roll number, and first and last name.';
    if (form.parent_contact_unavailable) return '';
    if (!form.parent_phone.trim() || !validateIndianMobileNumber(form.parent_phone).valid) return 'Enter a valid parent mobile number or mark contact unavailable.';
    if (!form.relationship) return 'Choose a parent or guardian relationship.';
    if (form.relationship === 'Other' && (!form.relationship_description.trim() || form.relationship_description.trim().length > 30)) return 'Enter an Other relationship of 30 characters or fewer.';
    return '';
  }

  async function save() {
    if (busy) return;
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createStudent(token, {
        classroom_id: Number(form.classroom_id),
        roll_number: Number(form.roll_number),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        parent_contact_unavailable: form.parent_contact_unavailable,
        ...(!form.parent_contact_unavailable ? {
          parent_phone: form.parent_phone.trim(),
          relationship: form.relationship,
          ...(form.relationship === 'Other' ? { relationship_description: form.relationship_description.trim() } : {}),
        } : {}),
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      setMessage('Student added.');
      await load(token);
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await AsyncStorage.removeItem('token');
        return router.replace('/school/login?reason=session_expired');
      }
      setError(requestError.message || 'Unable to add student.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#59253e" /><Text style={styles.muted}>Loading students…</Text></View>;

  const visible = students.filter((item) => (
    (!filter || String(item.classroom_id) === filter)
    && (!query.trim() || `${item.first_name} ${item.last_name} ${item.roll_number}`.toLowerCase().includes(query.trim().toLowerCase()))
  ));

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/dashboard')}><Text style={styles.back}>‹  Dashboard</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>People & records</Text>
          <Text style={styles.title}>Student directory</Text>
          <Text style={styles.subtitle}>Open a student profile to review health history. Hb screenings are recorded by assigned teachers.</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.navLink}>Teachers</Text></Pressable>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
          <Pressable onPress={() => router.push('/school/profile')}><Text style={styles.navLink}>Profile</Text></Pressable>
        </View>

        {message ? <View style={styles.successBox}><Text style={styles.successText}>✓  {message}</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Students</Text><Text style={styles.sectionHint}>{visible.length} shown · Hb history is read-only for school admins</Text></View>
          <Pressable style={styles.primaryButton} onPress={() => { setOpen((current) => !current); setError(''); }}><Text style={styles.primaryButtonText}>{open ? 'Close' : '+ Add student'}</Text></Pressable>
        </View>

        <TextInput style={styles.search} placeholder="Search by name or roll number" placeholderTextColor="#837378" value={query} onChangeText={setQuery} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, !filter && styles.chipActive]} onPress={() => setFilter('')}><Text style={[styles.chipText, !filter && styles.chipTextActive]}>All classrooms</Text></Pressable>
          {classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.chip, filter === String(classroom.classroom_id) && styles.chipActive]} onPress={() => setFilter(String(classroom.classroom_id))}><Text style={[styles.chipText, filter === String(classroom.classroom_id) && styles.chipTextActive]}>{label(classroom)}</Text></Pressable>)}
        </ScrollView>

        {visible.length ? visible.map((student) => (
          <View key={student.student_id} style={styles.card}>
            <Pressable style={styles.cardMain} onPress={() => router.push(`/school/students/${student.student_id}`)}>
              <Text style={styles.cardTitle}>{student.first_name} {student.last_name}</Text>
              <Text style={styles.muted}>Roll {student.roll_number} · {label(classrooms.find((classroom) => classroom.classroom_id === student.classroom_id))}</Text>
            </Pressable>
            <Pressable style={styles.profileLink} onPress={() => router.push(`/school/students/${student.student_id}`)}><Text style={styles.link}>View profile →</Text></Pressable>
          </View>
        )) : <View style={styles.empty}><Text style={styles.emptyTitle}>{students.length ? 'No students match your search' : 'No students yet'}</Text><Text style={styles.muted}>{students.length ? 'Try another name, roll number, or classroom.' : 'Add a student to begin tracking Hb records.'}</Text></View>}

        {open ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add student</Text>
            <View style={styles.choices}>{classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.choice, form.classroom_id === String(classroom.classroom_id) && styles.selected]} onPress={() => update('classroom_id', String(classroom.classroom_id))}><Text>{label(classroom)}</Text></Pressable>)}</View>
            <TextInput style={styles.input} placeholder="Roll number" keyboardType="numeric" value={form.roll_number} onChangeText={(value) => update('roll_number', value)} />
            <TextInput style={styles.input} placeholder="First name" value={form.first_name} onChangeText={(value) => update('first_name', value)} />
            <TextInput style={styles.input} placeholder="Last name" value={form.last_name} onChangeText={(value) => update('last_name', value)} />
            <Pressable style={styles.choice} onPress={() => update('parent_contact_unavailable', !form.parent_contact_unavailable)}><Text>{form.parent_contact_unavailable ? 'Contact unavailable (selected)' : 'Parent contact unavailable'}</Text></Pressable>
            {!form.parent_contact_unavailable ? <><TextInput style={styles.input} placeholder="Parent phone number" value={form.parent_phone} onChangeText={(value) => update('parent_phone', value)} /><View style={styles.choices}>{['Mother', 'Father', 'Guardian', 'Other'].map((value) => <Pressable key={value} style={[styles.choice, form.relationship === value && styles.selected]} onPress={() => update('relationship', value)}><Text>{value}</Text></Pressable>)}</View>{form.relationship === 'Other' ? <TextInput style={styles.input} placeholder="Relationship description" value={form.relationship_description} onChangeText={(value) => update('relationship_description', value)} /> : null}</> : null}
            <Pressable disabled={busy} style={styles.saveButton} onPress={save}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save student</Text>}</Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fcf9f4' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fcf9f4' },
  topBar: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  back: { color: '#743b55', fontSize: 14, fontWeight: '700' },
  topLabel: { color: '#97425d', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { backgroundColor: '#f6f3ee', borderRadius: 16, padding: 20 },
  eyebrow: { color: '#97425d', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#59253e', fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, marginTop: 3 },
  subtitle: { color: '#514348', fontSize: 14, lineHeight: 21, marginTop: 8 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  navLink: { color: '#97425d', fontSize: 12, fontWeight: '700' },
  successBox: { backgroundColor: '#c7eadc', borderRadius: 10, padding: 12 },
  successText: { color: '#1d3d33', fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: '#ffdad6', borderRadius: 10, padding: 12 },
  errorText: { color: '#93000a', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: '#1c1c19', fontSize: 18, fontWeight: '700' },
  sectionHint: { color: '#514348', fontSize: 12, marginTop: 3 },
  primaryButton: { backgroundColor: '#743b55', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  search: { minHeight: 46, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 10, paddingHorizontal: 12, color: '#1c1c19' },
  chips: { gap: 8, paddingVertical: 1 },
  chip: { borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#ffd9e1', borderColor: '#97425d' },
  chipText: { color: '#514348', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#59253e' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ead8df', borderRadius: 14, padding: 15, gap: 12 },
  cardMain: { gap: 4 },
  cardTitle: { color: '#1c1c19', fontSize: 16, fontWeight: '700' },
  profileLink: { alignSelf: 'flex-end', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f2e4e9', width: '100%', alignItems: 'flex-end' },
  link: { color: '#97425d', fontSize: 12, fontWeight: '700' },
  empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ead8df', borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#1c1c19', fontSize: 16, fontWeight: '700', marginBottom: 5 },
  muted: { color: '#514348', fontSize: 13, lineHeight: 18 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ead8df', gap: 9 },
  formTitle: { color: '#59253e', fontSize: 17, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  selected: { backgroundColor: '#ffd9e1', borderColor: '#97425d' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  saveButton: { minHeight: 46, backgroundColor: '#59253e', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
