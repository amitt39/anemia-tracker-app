import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  classroomLabel,
  clearTeacherSession,
  getTeacherClassrooms,
  getTeacherSession,
} from '../../lib/teacher-api';
import { AUTH } from '../../components/auth-ui';

export default function TeacherClassrooms() {
  const [token, setToken] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (authToken) => {
    try {
      setError('');
      const result = await getTeacherClassrooms(authToken);
      setClassrooms(result.classrooms || []);
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(e.message || 'Unable to load your classrooms.');
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

  async function retry() {
    if (!token) return;
    setLoading(true);
    await load(token);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={AUTH.secondary} /><Text style={styles.muted}>Loading classrooms...</Text></View>;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(token); }} />}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>Teacher workspace</Text><Text style={styles.title}>My Classrooms</Text><Text style={styles.subtitle}>Only classrooms assigned to your teacher account are shown.</Text></View>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/teacher/dashboard')}><Text style={styles.secondaryText}>Home</Text></Pressable>
        </View>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
        {classrooms.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No classrooms assigned</Text><Text style={styles.muted}>Ask your school administrator to assign you to a classroom.</Text></View> : classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={styles.card} onPress={() => router.push(`/teacher/classrooms/${classroom.classroom_id}`)}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{classroomLabel(classroom)}</Text><Text style={styles.muted}>{classroom.student_count || 0} {classroom.student_count === 1 ? 'student' : 'students'}</Text></View><Text style={styles.link}>Open →</Text></Pressable>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AUTH.background },
  content: { padding: 16, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: AUTH.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18, gap: 8 },
  eyebrow: { color: AUTH.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 26, fontWeight: '500', marginTop: 3 },
  subtitle: { color: AUTH.muted, fontSize: 13, lineHeight: 18, marginTop: 5 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, marginLeft: 10 },
  secondaryText: { color: AUTH.muted, fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#ffdad6', padding: 14, borderRadius: 10, marginBottom: 14 },
  errorText: { color: '#93000a', fontSize: 14 },
  retryButton: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: AUTH.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: AUTH.outlineVariant },
  retryText: { color: AUTH.secondary, fontWeight: '700' },
  card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 16, marginBottom: 10, gap: 8 },
  cardTitle: { color: AUTH.primary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  link: { color: AUTH.secondary, fontWeight: '700', marginLeft: 10 },
  empty: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyTitle: { color: AUTH.muted, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  muted: { color: AUTH.muted, fontSize: 13, lineHeight: 18 },
});
