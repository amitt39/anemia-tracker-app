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
import {
  classroomLabel,
  clearTeacherSession,
  getTeacherClassrooms,
  getTeacherProfile,
  getTeacherSession,
  getTeacherStudents,
} from './api';

export default function TeacherDashboard() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
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

  const filteredStudents = students.filter((s) => {
    if (onlyFlagged && !s.is_flagged) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    const roll = String(s.roll_number || '').toLowerCase();
    const clsName = `${s.grade_name || ''} ${s.section_name || ''} ${s.class_name || ''}`.toLowerCase();
    return fullName.includes(query) || roll.includes(query) || clsName.includes(query);
  });

  const flaggedCount = students.filter((s) => s.is_flagged).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1565c0" />
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
          </View>
        ) : null}

        {/* Overview Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{classrooms.length}</Text>
            <Text style={styles.statLabel}>Assigned Classes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{students.length}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={[styles.statCard, flaggedCount > 0 && styles.statCardFlagged]}>
            <Text style={[styles.statNumber, flaggedCount > 0 && styles.statNumberFlagged]}>
              {flaggedCount}
            </Text>
            <Text style={styles.statLabel}>Flagged for Follow-up</Text>
          </View>
        </View>

        {/* Assigned Classrooms Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Assigned Classrooms</Text>
          <Text style={styles.sectionSubtitle}>
            Classes you are currently responsible for managing
          </Text>

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
              {classrooms.map((cls) => (
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

        {/* Students Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Students in Your Classes</Text>
              <Text style={styles.sectionSubtitle}>
                Select a student to view records, record Hb test, or review tablet courses
              </Text>
            </View>
          </View>

          {/* Search & Filter Bar */}
          <View style={styles.filterBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name, roll number, or class..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            <Pressable
              style={[styles.filterToggle, onlyFlagged && styles.filterToggleActive]}
              onPress={() => setOnlyFlagged(!onlyFlagged)}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  onlyFlagged && styles.filterToggleTextActive,
                ]}
              >
                {onlyFlagged ? '⚑ Showing Flagged' : 'Filter Flagged'}
              </Text>
            </Pressable>
          </View>

          {filteredStudents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptyText}>
                {searchQuery || onlyFlagged
                  ? 'No students match your current search or filter criteria.'
                  : 'No students enrolled in your assigned classrooms yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.studentList}>
              {filteredStudents.map((s) => (
                <Pressable
                  key={s.student_id}
                  style={styles.studentRow}
                  onPress={() => router.push(`/teacher/students/${s.student_id}`)}
                >
                  <View style={styles.studentRowLeft}>
                    <View style={styles.studentNameRow}>
                      <Text style={styles.studentName}>
                        {s.first_name} {s.last_name}
                      </Text>
                      {s.is_flagged ? (
                        <View style={styles.flagBadge}>
                          <Text style={styles.flagBadgeText}>⚑ Follow-up</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.studentDetails}>
                      Roll #{s.roll_number || 'N/A'} • {classroomLabel(s)}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>Details →</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
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
    color: '#1565c0',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  schoolName: {
    fontSize: 14,
    color: '#667085',
    marginTop: 4,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 12,
  },
  logoutBtnText: {
    color: '#344054',
    fontWeight: '600',
    fontSize: 14,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eaecf0',
    alignItems: 'center',
  },
  statCardFlagged: {
    borderColor: '#fecdca',
    backgroundColor: '#fef3f2',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statNumberFlagged: {
    color: '#b42318',
  },
  statLabel: {
    fontSize: 12,
    color: '#667085',
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
    color: '#1a1a1a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
    marginBottom: 12,
  },
  classList: {
    gap: 10,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  classCardLeft: {
    flex: 1,
  },
  classCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101828',
  },
  classCardSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: '#1565c0',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterToggle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
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
    color: '#344054',
  },
  filterToggleTextActive: {
    color: '#b42318',
  },
  studentList: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e7ec',
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
    color: '#101828',
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
    color: '#667085',
    marginTop: 2,
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
    lineHeight: 18,
  },
});
