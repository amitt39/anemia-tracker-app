import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import {
  classroomLabel,
  clearTeacherSession,
  getTeacherClassrooms,
  getTeacherSession,
  getTeacherStudents,
} from '../../lib/teacher-api';
import { AUTH } from '../../components/auth-ui';

export default function TeacherStudents() {
  const { filter } = useLocalSearchParams();
  const [token, setToken] = useState(null);
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [search, setSearch] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(filter === 'flagged');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (authToken) => {
    try {
      setError('');
      const [studentResult, classroomResult] = await Promise.all([getTeacherStudents(authToken), getTeacherClassrooms(authToken)]);
      setStudents(studentResult.students || []);
      setClassrooms(classroomResult.classrooms || []);
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(e.message || 'Unable to load assigned students.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getTeacherSession().then(async (session) => {
      if (!session.token) {
        router.replace('/teacher/login');
        return;
      }
      setToken(session.token);
      await load(session.token);
    });
  }, [load]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    if (classroomFilter && String(student.classroom_id) !== classroomFilter) return false;
    if (flaggedOnly && !student.is_flagged) return false;
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase().includes(query)
      || String(student.roll_number || '').includes(query)
      || classroomLabel(student).toLowerCase().includes(query);
  }), [students, classroomFilter, flaggedOnly, search]);

  async function retry() {
    if (!token) return;
    setLoading(true);
    await load(token);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={AUTH.secondary} /><Text style={styles.muted}>Loading students...</Text></View>;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(token); }} />}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>Teacher workspace</Text><Text style={styles.title}>Students</Text><Text style={styles.subtitle}>Search students in classrooms assigned to you.</Text></View><Pressable style={styles.secondaryButton} onPress={() => router.push('/teacher/dashboard')}><Text style={styles.secondaryText}>Home</Text></Pressable></View>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
        <TextInput style={styles.search} placeholder="Search name, roll number, or classroom" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, !classroomFilter && styles.chipActive]} onPress={() => setClassroomFilter('')}><Text style={[styles.chipText, !classroomFilter && styles.chipTextActive]}>All classrooms</Text></Pressable>
          {classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.chip, classroomFilter === String(classroom.classroom_id) && styles.chipActive]} onPress={() => setClassroomFilter(String(classroom.classroom_id))}><Text style={[styles.chipText, classroomFilter === String(classroom.classroom_id) && styles.chipTextActive]}>{classroomLabel(classroom)}</Text></Pressable>)}
          <Pressable style={[styles.chip, flaggedOnly && styles.flaggedChip]} onPress={() => setFlaggedOnly((value) => !value)}><Text style={[styles.chipText, flaggedOnly && styles.flaggedText]}>{flaggedOnly ? 'Flagged only' : 'Show flagged'}</Text></Pressable>
        </ScrollView>
        <Text style={styles.resultCount}>{filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}</Text>
        {filteredStudents.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{students.length ? 'No matching students' : 'No students assigned'}</Text><Text style={styles.muted}>{students.length ? 'Try a different search or filter.' : 'Students appear here when they belong to one of your assigned classrooms.'}</Text></View> : filteredStudents.map((student) => <Pressable key={student.student_id} style={styles.card} onPress={() => router.push(`/teacher/students/${student.student_id}`)}><View style={{ flex: 1 }}><View style={styles.nameRow}><Text style={styles.cardTitle}>{student.first_name} {student.last_name}</Text>{student.is_flagged ? <Text style={styles.flag}>⚑ Follow-up</Text> : null}</View><Text style={styles.muted}>Roll #{student.roll_number || 'N/A'} · {classroomLabel(student)}</Text><Text style={styles.hbLink}>+ Record Hb result</Text></View><Text style={styles.link}>Open →</Text></Pressable>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AUTH.background },
  content: { padding: 16, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: AUTH.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: AUTH.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 26, fontWeight: '500', marginTop: 3 },
  subtitle: { color: AUTH.muted, fontSize: 13, lineHeight: 18, marginTop: 5 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, marginLeft: 10 },
  secondaryText: { color: AUTH.muted, fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#ffdad6', padding: 14, borderRadius: 10, marginBottom: 14 },
  errorText: { color: '#93000a', fontSize: 14 },
  retryButton: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: AUTH.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: AUTH.outlineVariant },
  retryText: { color: AUTH.secondary, fontWeight: '700' },
  search: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant },
  chipActive: { backgroundColor: AUTH.primary, borderColor: AUTH.primary },
  flaggedChip: { backgroundColor: '#fee4e2', borderColor: '#fecdca' },
  chipText: { color: AUTH.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  flaggedText: { color: '#b42318' },
  resultCount: { color: AUTH.muted, fontSize: 13, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 14, marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  cardTitle: { color: AUTH.primary, fontSize: 15, fontWeight: '700' },
  flag: { color: '#b42318', backgroundColor: '#fee4e2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: '700' },
  link: { color: AUTH.secondary, fontWeight: '700', marginLeft: 10 },
  hbLink: { color: '#743b55', fontWeight: '700', fontSize: 12, marginTop: 7 },
  empty: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyTitle: { color: AUTH.muted, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  muted: { color: AUTH.muted, fontSize: 13, lineHeight: 18 },
});
