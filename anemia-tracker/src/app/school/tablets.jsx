import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getClassrooms, getSchoolProfile, getSchoolTabletCourses, getTabletCourseDoses } from '../../lib/school-api';

const classroomLabel = (item) => item?.grade_name && item?.section_name ? `${item.grade_name} – ${item.section_name}` : `Legacy: ${item?.class_name || 'classroom'}`;

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

export default function SchoolTablets() {
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [search, setSearch] = useState('');
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [dosesMap, setDosesMap] = useState({});
  const [loadingDoses, setLoadingDoses] = useState(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const expire = useCallback(async (e) => {
    if (e.code === 'SESSION_EXPIRED') {
      await clearSchoolSession();
      router.replace('/school/login?reason=session_expired');
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (authToken) => {
    const [p, c, cl] = await Promise.all([
      getSchoolProfile(authToken),
      getSchoolTabletCourses(authToken),
      getClassrooms(authToken),
    ]);
    setProfile(p.school || null);
    setCourses(c.tablet_courses || []);
    setClassrooms(cl.classrooms || []);
    setLoadError('');
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (val) => {
      if (!val) return router.replace('/school/login');
      setToken(val);
      try {
        await load(val);
      } catch (e) {
        if (!(await expire(e))) setLoadError(e.message || 'Unable to load tablet courses.');
      } finally {
        setLoading(false);
      }
    });
  }, [load, expire]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return undefined;
      let mounted = true;
      load(token).catch(async (e) => {
        if (mounted && !(await expire(e))) setLoadError(e.message || 'Unable to refresh tablet courses.');
      });
      return () => { mounted = false; };
    }, [token, load, expire])
  );

  async function toggleDoses(courseId) {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
      return;
    }
    setExpandedCourseId(courseId);
    if (!dosesMap[courseId]) {
      setLoadingDoses(courseId);
      try {
        const res = await getTabletCourseDoses(token, courseId);
        setDosesMap((prev) => ({ ...prev, [courseId]: res.tablet_doses || [] }));
      } catch (e) {
        if (!(await expire(e))) setError(e.message || 'Unable to load doses for course.');
      } finally {
        setLoadingDoses(null);
      }
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading supplementation records…</Text></View>;
  }

  const totalCourses = courses.length;
  const activeCourses = courses.filter((c) => c.end_date >= todayStr).length;
  const totalTaken = courses.reduce((sum, c) => sum + (c.taken_doses || 0), 0);
  const totalMissed = courses.reduce((sum, c) => sum + (c.missed_doses || 0), 0);

  const visibleCourses = courses.filter((c) => {
    if (filterStatus === 'active' && c.end_date < todayStr) return false;
    if (filterStatus === 'completed' && c.end_date >= todayStr) return false;
    if (filterStatus === 'missed' && (c.missed_doses || 0) <= 0) return false;
    if (selectedClassroom && String(c.classroom_id) !== selectedClassroom) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q);
      const matchRoll = String(c.roll_number || '').includes(q);
      if (!matchName && !matchRoll) return false;
    }
    return true;
  });

  if (loadError) {
    return <View style={styles.center}><Text style={styles.errorText}>{loadError}</Text><Pressable style={styles.retryButton} onPress={async () => { setLoading(true); setLoadError(''); try { await load(token); } catch (e) { if (!(await expire(e))) setLoadError(e.message || 'Unable to load tablet courses.'); } finally { setLoading(false); } }}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/dashboard')}><Text style={styles.back}>‹  Dashboard</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Treatment monitoring</Text>
          <Text style={styles.title}>Tablet courses</Text>
          <Text style={styles.heroText}>{profile?.school_name || 'See which courses are active, which doses were missed, and where follow-up is needed.'}</Text>
        </View>

        <View style={styles.nav}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
          <Pressable onPress={() => router.push('/school/parents')}><Text style={styles.navLink}>Parents</Text></Pressable>
          <Pressable onPress={async () => { await clearSchoolSession(); router.replace('/school/login'); }}><Text style={styles.logout}>Logout</Text></Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Metrics Overview Cards */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Courses</Text>
            <Text style={styles.metricValue}>{totalCourses}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active</Text>
            <Text style={[styles.metricValue, { color: '#027a48' }]}>{activeCourses}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Doses Taken</Text>
            <Text style={[styles.metricValue, { color: '#027a48' }]}>{totalTaken}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Doses Missed</Text>
            <Text style={[styles.metricValue, { color: totalMissed > 0 ? '#b42318' : '#344054' }]}>{totalMissed}</Text>
          </View>
        </View>

        {/* Filter Controls */}
        <View style={styles.filterSection}>
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, filterStatus === 'all' && styles.tabActive]} onPress={() => setFilterStatus('all')}>
              <Text style={[styles.tabText, filterStatus === 'all' && styles.tabTextActive]}>All ({courses.length})</Text>
            </Pressable>
            <Pressable style={[styles.tab, filterStatus === 'active' && styles.tabActive]} onPress={() => setFilterStatus('active')}>
              <Text style={[styles.tabText, filterStatus === 'active' && styles.tabTextActive]}>Active ({activeCourses})</Text>
            </Pressable>
            <Pressable style={[styles.tab, filterStatus === 'completed' && styles.tabActive]} onPress={() => setFilterStatus('completed')}>
              <Text style={[styles.tabText, filterStatus === 'completed' && styles.tabTextActive]}>Completed ({courses.length - activeCourses})</Text>
            </Pressable>
            <Pressable style={[styles.tab, filterStatus === 'missed' && styles.tabActive]} onPress={() => setFilterStatus('missed')}>
              <Text style={[styles.tabText, filterStatus === 'missed' && styles.tabTextActive]}>Missed Doses ({courses.filter((c) => c.missed_doses > 0).length})</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search student name or roll number..."
            value={search}
            onChangeText={setSearch}
          />

          {classrooms.length > 0 && (
            <View style={styles.classroomFilters}>
              <Pressable style={[styles.chip, !selectedClassroom && styles.chipActive]} onPress={() => setSelectedClassroom('')}>
                <Text style={[styles.chipText, !selectedClassroom && styles.chipTextActive]}>All Classrooms</Text>
              </Pressable>
              {classrooms.map((c) => (
                <Pressable
                  key={c.classroom_id}
                  style={[styles.chip, selectedClassroom === String(c.classroom_id) && styles.chipActive]}
                  onPress={() => setSelectedClassroom(selectedClassroom === String(c.classroom_id) ? '' : String(c.classroom_id))}
                >
                  <Text style={[styles.chipText, selectedClassroom === String(c.classroom_id) && styles.chipTextActive]}>{classroomLabel(c)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Courses List */}
        <View style={styles.coursesList}>
          {visibleCourses.length ? (
            visibleCourses.map((c) => {
              const isCompleted = c.end_date < todayStr;
              const isExpanded = expandedCourseId === c.course_id;
              const doses = dosesMap[c.course_id] || [];

              return (
                <View key={c.course_id} style={styles.courseCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        {c.first_name} {c.last_name}
                      </Text>
                      <Text style={styles.meta}>
                        Roll {c.roll_number} • {c.grade_name && c.section_name ? `${c.grade_name} – ${c.section_name}` : c.class_name || 'Classroom'}
                      </Text>
                    </View>
                    <View style={[styles.badge, isCompleted ? styles.badgeGray : styles.badgeGreen]}>
                      <Text style={[styles.badgeText, isCompleted ? styles.badgeTextGray : styles.badgeTextGreen]}>
                        {isCompleted ? 'Completed' : 'Active'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <Text style={styles.detailText}>
                      Duration: {c.start_date} to {c.end_date}
                    </Text>
                    {c.hb_level ? (
                      <Text style={styles.detailText}>
                        Baseline Hb: {c.hb_level} g/dL ({c.test_date})
                      </Text>
                    ) : null}
                  </View>

                  {/* Dose Counts Row */}
                  <View style={styles.doseRowSummary}>
                    <Text style={styles.dosePill}>Total: {c.total_doses || 0}</Text>
                    <Text style={[styles.dosePill, styles.dosePillGreen]}>Taken: {c.taken_doses || 0}</Text>
                    {(c.missed_doses || 0) > 0 && (
                      <Text style={[styles.dosePill, styles.dosePillRed]}>Missed: {c.missed_doses}</Text>
                    )}
                    {(c.upcoming_doses || 0) > 0 && (
                      <Text style={[styles.dosePill, styles.dosePillBlue]}>Upcoming: {c.upcoming_doses}</Text>
                    )}
                  </View>

                  {/* Card Actions */}
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.toggleButton}
                      onPress={() => toggleDoses(c.course_id)}
                    >
                      <Text style={styles.toggleButtonText}>
                        {isExpanded ? 'Hide schedule' : 'View dose schedule'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.studentLink}
                      onPress={() => router.push(`/school/students/${c.student_id}`)}
                    >
                      <Text style={styles.studentLinkText}>Student details →</Text>
                    </Pressable>
                  </View>

                  {/* Expanded Doses List */}
                  {isExpanded && (
                    <View style={styles.dosesContainer}>
                      <Text style={styles.dosesHeader}>Dose Administration Schedule</Text>
                      {loadingDoses === c.course_id ? (
                        <ActivityIndicator style={{ padding: 12 }} />
                      ) : doses.length ? (
                        doses.map((d) => {
                          const isMissed = (d.status === 'scheduled' || d.status === 'missed') && d.scheduled_date < todayStr;
                          const statusLabel = d.status === 'taken'
                            ? `Taken${d.taken_at ? ` (${d.taken_at.slice(0, 10)})` : ''}`
                            : (isMissed || d.status === 'missed' ? 'Overdue' : 'Scheduled');
                          const statusColor = d.status === 'taken' ? '#027a48' : (isMissed ? '#b42318' : '#667085');

                          return (
                            <View key={d.dose_id} style={styles.doseItem}>
                              <Text style={styles.doseItemDate}>{d.scheduled_date}</Text>
                              <Text style={[styles.doseItemStatus, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.muted}>No doses found for this course.</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {courses.length ? 'No tablet courses match your filter criteria.' : 'No tablet supplementation courses recorded yet.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, padding: 20 },
  topBar: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: COLORS.primaryContainer, fontSize: 14, fontWeight: '700' },
  topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { backgroundColor: COLORS.low, borderRadius: 16, padding: 20 },
  eyebrow: { color: COLORS.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, marginTop: 3 },
  heroText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  muted: { color: COLORS.muted, fontSize: 13 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  navLink: { color: COLORS.secondary, fontWeight: '700', fontSize: 12 },
  logout: { color: '#93000a', fontWeight: '700', fontSize: 12 },
  errorText: { color: '#93000a', backgroundColor: '#ffdad6', padding: 12, borderRadius: 10 },
  retryButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '700' },

  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { flex: 1, minWidth: 140, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ead8df' },
  metricLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 22, fontWeight: '700', marginTop: 4, color: COLORS.primary },

  filterSection: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: '#ead8df' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.low },
  tabActive: { backgroundColor: COLORS.primaryContainer },
  tabText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  search: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text },
  classroomFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.secondaryFixed, borderColor: COLORS.secondary },
  chipText: { fontSize: 12, color: COLORS.muted },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },

  coursesList: { gap: 12 },
  courseCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ead8df', gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentInfo: { gap: 2 },
  studentName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.muted },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#edfcf2' },
  badgeGray: { backgroundColor: '#f2f4f7' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextGreen: { color: '#027a48' },
  badgeTextGray: { color: '#667085' },

  cardDetails: { gap: 4 },
  detailText: { fontSize: 13, color: COLORS.muted },

  doseRowSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dosePill: { fontSize: 12, fontWeight: '600', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: COLORS.low, color: COLORS.muted },
  dosePillGreen: { backgroundColor: COLORS.tertiaryFixed, color: COLORS.tertiary },
  dosePillRed: { backgroundColor: '#fef3f2', color: '#b42318' },
  dosePillBlue: { backgroundColor: COLORS.secondaryFixed, color: COLORS.primary },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f2f4f7' },
  toggleButton: { paddingVertical: 4 },
  toggleButtonText: { color: COLORS.secondary, fontWeight: '600', fontSize: 13 },
  studentLink: { paddingVertical: 4 },
  studentLinkText: { color: '#475467', fontWeight: '600', fontSize: 13 },

  dosesContainer: { backgroundColor: COLORS.low, borderRadius: 10, padding: 12, marginTop: 8, gap: 6 },
  dosesHeader: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  doseItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#eaecf0' },
  doseItemDate: { fontSize: 13, color: '#344054' },
  doseItemStatus: { fontSize: 13, fontWeight: '700' },

  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#ead8df' },
  emptyText: { color: COLORS.muted, fontSize: 14 },
});
