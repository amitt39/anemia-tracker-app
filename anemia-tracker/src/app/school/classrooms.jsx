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
import { clearSchoolSession, createClassroom, getClassrooms, getTeachers, SUPPORTED_GRADES, updateClassroom } from '../../lib/school-api';

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

const EMPTY_FORM = { grade: '', section: '', teacherId: '' };
const classroomLabel = (classroom) => classroom?.grade_name && classroom?.section_name
  ? `${classroom.grade_name} – ${classroom.section_name}`
  : classroom?.class_name || 'Classroom';

export default function Classrooms() {
  const [token, setToken] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const redirectIfExpired = useCallback(async (requestError) => {
    if (requestError.code !== 'SESSION_EXPIRED') return false;
    await clearSchoolSession();
    router.replace('/school/login?reason=session_expired');
    return true;
  }, []);

  const load = useCallback(async (authToken) => {
    const [classroomResult, teacherResult] = await Promise.all([getClassrooms(authToken), getTeachers(authToken)]);
    setClassrooms(classroomResult.classrooms || []);
    setTeachers(teacherResult.teachers || []);
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
        if (!(await redirectIfExpired(requestError)) && mounted) setError(requestError.message || 'Unable to load classrooms.');
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
      if (!(await redirectIfExpired(requestError))) setError(requestError.message || 'Unable to refresh classrooms.');
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
    const section = form.section.trim().toUpperCase();
    if (!form.grade || !/^[A-Z0-9][A-Z0-9 ._-]*$/.test(section) || section.length > 20) {
      setError('Choose a class and enter a valid section of 20 characters or fewer.');
      return;
    }
    if (classrooms.some((classroom) => classroom.grade_name === form.grade && classroom.section_name === section)) {
      setError('That class and section already exists.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await createClassroom(token, {
        grade_name: form.grade,
        section_name: section,
        ...(form.teacherId ? { teacher_id: Number(form.teacherId) } : {}),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessage('Classroom added successfully.');
      await load(token);
    } catch (requestError) {
      if (!(await redirectIfExpired(requestError))) setError(requestError.message || 'Unable to add classroom.');
    } finally {
      setBusy(false);
    }
  }

  async function assignTeacher(classroomId, teacherId) {
    setAssigningId(classroomId);
    setError('');
    setMessage('');
    try {
      await updateClassroom(token, classroomId, { teacher_id: teacherId });
      setMessage('Teacher assignment updated.');
      await load(token);
    } catch (requestError) {
      if (!(await redirectIfExpired(requestError))) setError(requestError.message || 'Unable to update teacher assignment.');
    } finally {
      setAssigningId(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Loading classrooms…</Text></View>;

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
          <View style={styles.heroIcon}><Text style={styles.heroIconText}>▦</Text></View>
          <Text style={styles.eyebrow}>School structure</Text>
          <Text style={styles.title}>Classroom directory</Text>
          <Text style={styles.subtitle}>Create sections, assign a primary teacher, and open a classroom to manage its students.</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.navLink}>Teachers</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
          <Pressable onPress={() => router.push('/school/profile')}><Text style={styles.navLink}>Profile</Text></Pressable>
        </View>

        {message ? <View style={styles.successBox}><Text style={styles.successText}>✓  {message}</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{classrooms.length}</Text><Text style={styles.summaryLabel}>Classrooms</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{classrooms.filter((classroom) => classroom.teacher_id).length}</Text><Text style={styles.summaryLabel}>With a teacher</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Your classrooms</Text><Text style={styles.sectionHint}>Assign teachers directly from each classroom card.</Text></View>
          <Pressable style={styles.primaryButton} onPress={() => { setShowForm((current) => !current); setError(''); }}><Text style={styles.primaryButtonText}>{showForm ? 'Close' : '+ Add class'}</Text></Pressable>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create a classroom</Text>
            <Text style={styles.formHint}>Choose the class level and use a short section name such as A or Blue.</Text>
            <Text style={styles.fieldLabel}>Class level</Text>
            <View style={styles.choices}>
              {SUPPORTED_GRADES.map((grade) => <Pressable key={grade} style={[styles.choice, form.grade === grade && styles.choiceActive]} onPress={() => updateForm('grade', grade)}><Text style={[styles.choiceText, form.grade === grade && styles.choiceTextActive]}>{grade}</Text></Pressable>)}
            </View>
            <Text style={styles.fieldLabel}>Section</Text>
            <TextInput style={styles.input} value={form.section} onChangeText={(value) => updateForm('section', value)} placeholder="For example A" placeholderTextColor={COLORS.outline} autoCapitalize="characters" />
            <Text style={styles.fieldLabel}>Primary teacher (optional)</Text>
            <View style={styles.choices}>
              <Pressable style={[styles.choice, !form.teacherId && styles.choiceActive]} onPress={() => updateForm('teacherId', '')}><Text style={[styles.choiceText, !form.teacherId && styles.choiceTextActive]}>Not assigned</Text></Pressable>
              {teachers.filter((teacher) => teacher.is_active).map((teacher) => <Pressable key={teacher.teacher_id} style={[styles.choice, form.teacherId === String(teacher.teacher_id) && styles.choiceActive]} onPress={() => updateForm('teacherId', String(teacher.teacher_id))}><Text style={[styles.choiceText, form.teacherId === String(teacher.teacher_id) && styles.choiceTextActive]}>{teacher.first_name} {teacher.last_name}</Text></Pressable>)}
            </View>
            <Pressable disabled={busy} style={[styles.saveButton, busy && styles.disabled]} onPress={save}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Create classroom</Text>}</Pressable>
          </View>
        ) : null}

        {classrooms.length ? classrooms.map((classroom) => {
          const teacher = teachers.find((item) => String(item.teacher_id) === String(classroom.teacher_id));
          return (
            <View key={classroom.classroom_id} style={styles.classroomCard}>
              <Pressable style={styles.classroomTop} onPress={() => router.push(`/school/classrooms/${classroom.classroom_id}`)}>
                <View style={styles.classMark}><Text style={styles.classMarkText}>{(classroom.section_name || 'CL').slice(0, 2).toUpperCase()}</Text></View>
                <View style={styles.classCopy}><Text style={styles.classTitle}>{classroomLabel(classroom)}</Text><Text style={styles.classMeta}>{classroom.student_count || 0} students · {teacher ? `${teacher.first_name} ${teacher.last_name}` : 'No teacher assigned'}</Text><Text style={styles.openLink}>Open classroom →</Text></View>
              </Pressable>
              <Text style={styles.assignLabel}>Primary teacher</Text>
              {assigningId === classroom.classroom_id ? <ActivityIndicator color={COLORS.primary} /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                <Pressable style={[styles.choice, !classroom.teacher_id && styles.choiceActive]} onPress={() => assignTeacher(classroom.classroom_id, null)}><Text style={[styles.choiceText, !classroom.teacher_id && styles.choiceTextActive]}>Not assigned</Text></Pressable>
                {teachers.filter((teacherItem) => teacherItem.is_active).map((teacherItem) => <Pressable key={teacherItem.teacher_id} style={[styles.choice, classroom.teacher_id === teacherItem.teacher_id && styles.choiceActive]} onPress={() => assignTeacher(classroom.classroom_id, teacherItem.teacher_id)}><Text style={[styles.choiceText, classroom.teacher_id === teacherItem.teacher_id && styles.choiceTextActive]}>{teacherItem.first_name} {teacherItem.last_name}</Text></Pressable>)}
              </ScrollView>}
            </View>
          );
        }) : (
          <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No classrooms yet</Text><Text style={styles.muted}>Create your first class section to start enrolling students.</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.background },
  topBar: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#ead8df' },
  summaryValue: { color: COLORS.primary, fontSize: 28, fontWeight: '700' },
  summaryLabel: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  primaryButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ead8df', gap: 10 },
  formTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '700', marginBottom: 1 },
  formHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 3 },
  fieldLabel: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  input: { minHeight: 46, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, backgroundColor: COLORS.surface },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: COLORS.surface },
  choiceActive: { backgroundColor: COLORS.secondaryFixed, borderColor: COLORS.secondary },
  choiceText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveButton: { minHeight: 46, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  classroomCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ead8df', gap: 10 },
  classroomTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  classMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  classMarkText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  classCopy: { flex: 1, gap: 3 },
  classTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  classMeta: { color: COLORS.muted, fontSize: 12 },
  openLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  assignLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#ead8df' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  muted: { color: COLORS.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
