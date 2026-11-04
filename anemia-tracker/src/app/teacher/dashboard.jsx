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
  getTeacherProfile,
  getTeacherSession,
  getTeacherStudents,
} from '../../lib/teacher-api';
import { AUTH } from '../../components/auth-ui';

export default function TeacherDashboard() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [focusedSummaryCard, setFocusedSummaryCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (authToken) => {
    try {
      setError('');
      const [profileRes, classroomsRes, studentsRes] = await Promise.all([
        getTeacherProfile(authToken).catch(() => null),
        getTeacherClassrooms(authToken),
        getTeacherStudents(authToken),
      ]);

      if (profileRes?.teacher) {
        setProfile(profileRes.teacher);
      }
      setClassrooms(classroomsRes?.classrooms || []);
      setStudents(studentsRes?.students || []);
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(e.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  async function handleLogout() {
    await clearTeacherSession();
    router.replace('/teacher/login');
  }

  const flaggedCount = students.filter((s) => s.is_flagged).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AUTH.secondary} />
        <Text style={styles.loadingText}>Loading teacher portal...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.portalTag}>Teacher Portal</Text>
            <Text style={styles.teacherName}>
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Teacher'}
            </Text>
            <Text style={styles.schoolName}>
              {profile?.school_name ? `🏫 ${profile.school_name}` : profile?.email || ''}
            </Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); loadData(token); }}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Today’s teacher workspace</Text>
          <Text style={styles.introText}>
            Open your assigned classrooms, find a student, and complete authorized Hb or tablet tasks.
          </Text>
        </View>

        {/* Overview Stats */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statCard, focusedSummaryCard === 'classrooms' && styles.statCardFocused]}
            onPress={() => router.push('/teacher/classrooms')}
            onFocus={() => setFocusedSummaryCard('classrooms')}
            onBlur={() => setFocusedSummaryCard(null)}
            accessibilityRole="button"
            accessibilityLabel={`Assigned Classes: ${classrooms.length}. Open My Classrooms.`}
            accessibilityHint="Opens your assigned classroom list."
          >
            <Text style={styles.statNumber}>{classrooms.length}</Text>
            <Text style={styles.statLabel}>Assigned Classes</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, focusedSummaryCard === 'students' && styles.statCardFocused]}
            onPress={() => router.push('/teacher/students')}
            onFocus={() => setFocusedSummaryCard('students')}
            onBlur={() => setFocusedSummaryCard(null)}
            accessibilityRole="button"
            accessibilityLabel={`Total Students: ${students.length}. Open Students.`}
            accessibilityHint="Opens the students list."
          >
            <Text style={styles.statNumber}>{students.length}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </Pressable>
          <Pressable
            style={[
              styles.statCard,
              flaggedCount > 0 && styles.statCardFlagged,
              focusedSummaryCard === 'flagged' && styles.statCardFocused,
            ]}
            onPress={() => router.push('/teacher/students?filter=flagged')}
            onFocus={() => setFocusedSummaryCard('flagged')}
            onBlur={() => setFocusedSummaryCard(null)}
            accessibilityRole="button"
            accessibilityLabel={`Flagged for Follow-up: ${flaggedCount}. Open flagged students.`}
            accessibilityHint="Opens the students list filtered to records marked for follow-up."
          >
            <Text style={[styles.statNumber, flaggedCount > 0 && styles.statNumberFlagged]}>
              {flaggedCount}
            </Text>
            <Text style={styles.statLabel}>Flagged for Follow-up</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Go to</Text>
          <Text style={styles.sectionSubtitle}>Focused tools for your assigned students</Text>
          <View style={styles.navigationGrid}>
            <Pressable style={styles.navigationCard} onPress={() => router.push('/teacher/classrooms')}>
              <Text style={styles.navigationTitle}>My Classrooms</Text>
              <Text style={styles.navigationText}>Open assigned rosters and classroom summaries.</Text>
            </Pressable>
            <Pressable style={styles.navigationCard} onPress={() => router.push('/teacher/students')}>
              <Text style={styles.navigationTitle}>Students</Text>
              <Text style={styles.navigationText}>Search students and open health records.</Text>
            </Pressable>
            <Pressable style={styles.navigationCard} onPress={() => router.push('/teacher/hb-tests')}>
              <Text style={styles.navigationTitle}>Hb Tests</Text>
              <Text style={styles.navigationText}>Review Hb history and record new screening results.</Text>
            </Pressable>
            <Pressable style={styles.navigationCard} onPress={() => router.push('/teacher/tablet-doses')}>
              <Text style={styles.navigationTitle}>Tablet Doses</Text>
              <Text style={styles.navigationText}>Review scheduled doses and supplementation status.</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Needs attention</Text>
              <Text style={styles.sectionSubtitle}>Flagged count reflects student records marked for follow-up.</Text>
            </View>
            <Pressable onPress={() => router.push('/teacher/students')}><Text style={styles.linkText}>View students</Text></Pressable>
          </View>
          <Pressable style={[styles.priorityCard, flaggedCount === 0 && styles.priorityCardClear]} onPress={() => router.push('/teacher/students?filter=flagged')}>
            <Text style={styles.priorityTitle}>{flaggedCount === 0 ? 'No flagged students' : `${flaggedCount} flagged student${flaggedCount === 1 ? '' : 's'}`}</Text>
            <Text style={styles.priorityText}>{flaggedCount === 0 ? 'No follow-up flags are currently recorded.' : 'Open Students to review the flagged records.'}</Text>
          </Pressable>
        </View>

        {/* Assigned Classrooms Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Assigned classrooms</Text>
              <Text style={styles.sectionSubtitle}>Your current teaching assignments</Text>
            </View>
            <Pressable onPress={() => router.push('/teacher/classrooms')}><Text style={styles.linkText}>View all</Text></Pressable>
          </View>

          {classrooms.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Classrooms Assigned</Text>
              <Text style={styles.emptyText}>
                You are not currently assigned to any classroom. Please ask your school
                administrator to assign you to a section.
              </Text>
            </View>
          ) : (
            <View style={styles.classList}>
              {classrooms.slice(0, 3).map((cls) => (
                <Pressable
                  key={cls.classroom_id}
                  style={styles.classCard}
                  onPress={() => router.push(`/teacher/classrooms/${cls.classroom_id}`)}
                >
                  <View style={styles.classCardLeft}>
                    <Text style={styles.classCardTitle}>{classroomLabel(cls)}</Text>
                    <Text style={styles.classCardSubtitle}>
                      {cls.student_count || 0} enrolled {cls.student_count === 1 ? 'student' : 'students'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>View class →</Text>
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
    backgroundColor: AUTH.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: AUTH.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: AUTH.muted,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: AUTH.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerInfo: {
    flex: 1,
  },
  portalTag: {
    fontSize: 12,
    fontWeight: '700',
    color: AUTH.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 22,
    fontWeight: '700',
    color: AUTH.primary,
  },
  schoolName: {
    fontSize: 14,
    color: AUTH.muted,
    marginTop: 4,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 12,
  },
  logoutBtnText: {
    color: AUTH.muted,
    fontWeight: '600',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#ffdad6',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
  },
  retryButtonText: {
    color: '#b42318',
    fontWeight: '700',
    fontSize: 13,
  },
  introCard: {
    backgroundColor: AUTH.surfaceLow,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
  },
  introTitle: {
    color: AUTH.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  introText: {
    color: AUTH.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: AUTH.surface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    alignItems: 'center',
  },
  statCardFocused: {
    borderColor: AUTH.secondary,
    shadowColor: AUTH.secondary,
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  statCardFlagged: {
    borderColor: '#fecdca',
    backgroundColor: '#fef3f2',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: AUTH.primary,
  },
  statNumberFlagged: {
    color: '#b42318',
  },
  statLabel: {
    fontSize: 12,
    color: AUTH.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AUTH.primary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: AUTH.muted,
    marginTop: 2,
    marginBottom: 12,
  },
  navigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  navigationCard: {
    width: '48%',
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: AUTH.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    padding: 14,
  },
  navigationTitle: {
    color: AUTH.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  navigationText: {
    color: AUTH.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  priorityCard: {
    backgroundColor: '#fff4e5',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  priorityCardClear: {
    backgroundColor: '#ecfdf3',
    borderColor: '#a6f4c5',
  },
  priorityTitle: {
    color: '#9a3412',
    fontSize: 15,
    fontWeight: '700',
  },
  priorityText: {
    color: AUTH.muted,
    fontSize: 13,
    marginTop: 4,
  },
  linkText: {
    color: AUTH.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  classList: {
    gap: 10,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AUTH.surface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
  },
  classCardLeft: {
    flex: 1,
  },
  classCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AUTH.primary,
  },
  classCardSubtitle: {
    fontSize: 13,
    color: AUTH.muted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: AUTH.secondary,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterToggle: {
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  filterToggleActive: {
    backgroundColor: '#fee4e2',
    borderColor: '#fecdca',
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: AUTH.muted,
  },
  filterToggleTextActive: {
    color: '#b42318',
  },
  studentList: {
    backgroundColor: AUTH.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    overflow: 'hidden',
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  studentRowLeft: {
    flex: 1,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: AUTH.primary,
  },
  flagBadge: {
    backgroundColor: '#fee4e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b42318',
  },
  studentDetails: {
    fontSize: 13,
    color: AUTH.muted,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: AUTH.surface,
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AUTH.muted,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
