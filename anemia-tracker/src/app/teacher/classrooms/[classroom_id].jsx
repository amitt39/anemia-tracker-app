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
import { router, useLocalSearchParams } from 'expo-router';
import {
  classroomLabel,
  clearTeacherSession,
  getTeacherClassroom,
  getTeacherClassroomStudents,
  getTeacherSession,
} from '../api';

export default function TeacherClassroomDetail() {
  const { classroom_id } = useLocalSearchParams();
  const [token, setToken] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (authToken) => {
    try {
      setError('');
      const [classRes, studentsRes] = await Promise.all([
        getTeacherClassroom(authToken, classroom_id),
        getTeacherClassroomStudents(authToken, classroom_id),
      ]);
      setClassroom(classRes.classroom);
      setStudents(studentsRes.students || []);
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(e.message || 'Unable to load classroom details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classroom_id]);

  useEffect(() => {
    async function init() {
      const session = await getTeacherSession();
      if (!session.token) {
        router.replace('/teacher/login');
        return;
      }
      setToken(session.token);
      await loadData(session.token);
    }
    init();
  }, [loadData]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    await loadData(token);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1565c0" />
        <Text style={styles.loadingText}>Loading classroom...</Text>
      </SafeAreaView>
    );
  }

  const flaggedStudents = students.filter((s) => s.is_flagged);

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Navigation & Header */}
        <View style={styles.navRow}>
          <Pressable style={styles.backBtn} onPress={() => router.push('/teacher/dashboard')}>
            <Text style={styles.backBtnText}>← Dashboard</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {classroom ? (
          <View style={styles.headerCard}>
            <Text style={styles.headerBadge}>Assigned Classroom</Text>
            <Text style={styles.headerTitle}>{classroomLabel(classroom)}</Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.metaText}>
                {students.length} {students.length === 1 ? 'student' : 'students'} enrolled
              </Text>
              {flaggedStudents.length > 0 ? (
                <View style={styles.flaggedBadge}>
                  <Text style={styles.flaggedBadgeText}>
                    ⚑ {flaggedStudents.length} flagged for follow-up
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Student Roster */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Roster</Text>
          <Text style={styles.sectionSubtitle}>
            Tap a student to record Hb measurements or view tablet course history.
          </Text>

          {students.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Students in This Class</Text>
              <Text style={styles.emptyText}>
                There are no students assigned to this section yet.
              </Text>
            </View>
          ) : (
            <View style={styles.rosterCard}>
              {students.map((student) => (
                <Pressable
                  key={student.student_id}
                  style={styles.rosterRow}
                  onPress={() => router.push(`/teacher/students/${student.student_id}`)}
                >
                  <View style={styles.rollBadge}>
                    <Text style={styles.rollText}>{student.roll_number || '—'}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.studentName}>
                        {student.first_name} {student.last_name}
                      </Text>
                      {student.is_flagged ? (
                        <View style={styles.inlineFlag}>
                          <Text style={styles.inlineFlagText}>⚑ Flagged</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.subtext}>
                      {student.parent_contact_unavailable
                        ? 'Parent contact unavailable'
                        : 'Contact on file'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>Open →</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#667085',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  navRow: {
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  backBtnText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee4e2',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
  },
  headerCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  headerBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565c0',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    color: '#667085',
  },
  flaggedBadge: {
    backgroundColor: '#fee4e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flaggedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b42318',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
    marginBottom: 12,
  },
  rosterCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    overflow: 'hidden',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  rollBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f2f4f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rollText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
  },
  studentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#101828',
  },
  inlineFlag: {
    backgroundColor: '#fee4e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inlineFlagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b42318',
  },
  subtext: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },
  chevron: {
    fontSize: 13,
    color: '#1565c0',
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eaecf0',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
  },
});
