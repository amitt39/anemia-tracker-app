import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getSchoolProfile, getSchoolReports, updateStudent } from './api';

const classroomLabel = (item) => item?.grade_name && item?.section_name ? `${item.grade_name} – ${item.section_name}` : `Legacy: ${item?.class_name || 'classroom'}`;

export default function SchoolReports() {
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [queueFilter, setQueueFilter] = useState('all');
  const [busyStudentId, setBusyStudentId] = useState(null);

  const expire = useCallback(async (e) => {
    if (e.code === 'SESSION_EXPIRED') {
      await clearSchoolSession();
      router.replace('/school/login?reason=session_expired');
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (authToken) => {
    const [p, r] = await Promise.all([
      getSchoolProfile(authToken),
      getSchoolReports(authToken),
    ]);
    setProfile(p.school || null);
    setReport(r || null);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (val) => {
      if (!val) return router.replace('/school/login');
      setToken(val);
      try {
        await load(val);
      } catch (e) {
        if (!(await expire(e))) setError(e.message || 'Unable to load school reports.');
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
        if (mounted && !(await expire(e))) setError(e.message || 'Unable to refresh reports.');
      });
      return () => { mounted = false; };
    }, [token, load, expire])
  );

  async function toggleFlag(studentId, currentFlag) {
    setBusyStudentId(studentId);
    setError('');
    setMessage('');
    try {
      await updateStudent(token, studentId, { is_flagged: !currentFlag });
      await load(token);
      setMessage(currentFlag ? 'Flag removed from student.' : 'Student flagged for follow-up.');
    } catch (e) {
      if (!(await expire(e))) setError(e.message || 'Unable to update student flag.');
    } finally {
      setBusyStudentId(null);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const summary = report?.summary || {};
  const followUpQueue = report?.follow_up_queue || [];
  const classrooms = report?.classrooms || [];

  const filteredQueue = followUpQueue.filter((item) => {
    if (queueFilter === 'flagged') return Boolean(item.is_flagged);
    if (queueFilter === 'missed') return (item.missed_doses || 0) > 0;
    return true;
  });

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reports & Follow-up</Text>
            <Text style={styles.muted}>{profile?.school_name || 'School health program analytics'}</Text>
          </View>
          <View style={styles.nav}>
            <Pressable onPress={() => router.push('/school/dashboard')}><Text style={styles.navLink}>Dashboard</Text></Pressable>
            <Pressable onPress={() => router.push('/school/tablets')}><Text style={styles.navLink}>Tablets</Text></Pressable>
            <Pressable onPress={() => router.push('/school/parents')}><Text style={styles.navLink}>Parents</Text></Pressable>
            <Pressable onPress={async () => { await clearSchoolSession(); router.replace('/school/login'); }}><Text style={styles.logout}>Logout</Text></Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        {/* Tab Navigation */}
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, activeTab === 'overview' && styles.tabActive]} onPress={() => setActiveTab('overview')}>
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Program Overview</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'followup' && styles.tabActive]} onPress={() => setActiveTab('followup')}>
            <Text style={[styles.tabText, activeTab === 'followup' && styles.tabTextActive]}>
              Follow-up Queue ({followUpQueue.length})
            </Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'classrooms' && styles.tabActive]} onPress={() => setActiveTab('classrooms')}>
            <Text style={[styles.tabText, activeTab === 'classrooms' && styles.tabTextActive]}>
              Classroom Breakdown ({classrooms.length})
            </Text>
          </Pressable>
        </View>

        {/* Tab 1: Program Overview */}
        {activeTab === 'overview' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Program Health Summary</Text>
            <View style={styles.grid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Students Enrolled</Text>
                <Text style={styles.statNumber}>{summary.total_students || 0}</Text>
                <Text style={styles.statSub}>Across {summary.total_classrooms || 0} classrooms</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Flagged for Follow-up</Text>
                <Text style={[styles.statNumber, { color: summary.flagged_students > 0 ? '#b42318' : '#344054' }]}>
                  {summary.flagged_students || 0}
                </Text>
                <Text style={styles.statSub}>Require clinical or parent review</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Hb Tests Recorded</Text>
                <Text style={styles.statNumber}>{summary.total_hb_tests || 0}</Text>
                <Text style={styles.statSub}>Total screening records</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Adherence Rate</Text>
                <Text style={[styles.statNumber, { color: '#027a48' }]}>
                  {summary.adherence_rate !== null && summary.adherence_rate !== undefined ? `${summary.adherence_rate}%` : '—'}
                </Text>
                <Text style={styles.statSub}>Doses taken vs total due</Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 16 }]}>Supplementation Overview</Text>
            <View style={styles.card}>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Total Tablet Courses</Text>
                <Text style={styles.rowValue}>{summary.total_courses || 0}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Active Courses</Text>
                <Text style={[styles.rowValue, { color: '#027a48' }]}>{summary.active_courses || 0}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Completed Courses</Text>
                <Text style={styles.rowValue}>{summary.completed_courses || 0}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Total Doses Scheduled</Text>
                <Text style={styles.rowValue}>{summary.total_doses || 0}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Doses Administered (Taken)</Text>
                <Text style={[styles.rowValue, { color: '#027a48' }]}>{summary.taken_doses || 0}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>Doses Missed</Text>
                <Text style={[styles.rowValue, { color: summary.missed_doses > 0 ? '#b42318' : '#344054' }]}>
                  {summary.missed_doses || 0}
                </Text>
              </View>
              <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
                <Text style={styles.rowLabel}>Upcoming Scheduled Doses</Text>
                <Text style={styles.rowValue}>{summary.upcoming_doses || 0}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 2: Follow-up Queue */}
        {activeTab === 'followup' && (
          <View style={styles.sectionContainer}>
            <View style={styles.queueHeader}>
              <View>
                <Text style={styles.sectionHeading}>Students Needing Follow-up</Text>
                <Text style={styles.muted}>Students flagged or with missed supplementation doses</Text>
              </View>
              <View style={styles.subTabs}>
                <Pressable
                  style={[styles.subTab, queueFilter === 'all' && styles.subTabActive]}
                  onPress={() => setQueueFilter('all')}
                >
                  <Text style={[styles.subTabText, queueFilter === 'all' && styles.subTabTextActive]}>All ({followUpQueue.length})</Text>
                </Pressable>
                <Pressable
                  style={[styles.subTab, queueFilter === 'flagged' && styles.subTabActive]}
                  onPress={() => setQueueFilter('flagged')}
                >
                  <Text style={[styles.subTabText, queueFilter === 'flagged' && styles.subTabTextActive]}>
                    Flagged ({followUpQueue.filter((s) => s.is_flagged).length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.subTab, queueFilter === 'missed' && styles.subTabActive]}
                  onPress={() => setQueueFilter('missed')}
                >
                  <Text style={[styles.subTabText, queueFilter === 'missed' && styles.subTabTextActive]}>
                    Missed Doses ({followUpQueue.filter((s) => (s.missed_doses || 0) > 0).length})
                  </Text>
                </Pressable>
              </View>
            </View>

            {filteredQueue.length ? (
              filteredQueue.map((item) => (
                <View key={item.student_id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View>
                      <Text style={styles.studentName}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Text style={styles.meta}>
                        Roll {item.roll_number} • {classroomLabel(item)}
                      </Text>
                    </View>
                    <View style={styles.badgeGroup}>
                      {item.is_flagged && (
                        <View style={styles.badgeRed}>
                          <Text style={styles.badgeRedText}>⚑ Flagged</Text>
                        </View>
                      )}
                      {(item.missed_doses || 0) > 0 && (
                        <View style={styles.badgeOrange}>
                          <Text style={styles.badgeOrangeText}>{item.missed_doses} missed doses</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.studentStatsRow}>
                    <Text style={styles.detailText}>
                      Latest Hb: {item.latest_hb_level ? `${item.latest_hb_level} g/dL (${item.latest_hb_date})` : 'Not recorded'}
                    </Text>
                    <Text style={styles.detailText}>
                      Doses taken: {item.taken_doses || 0}
                    </Text>
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable
                      disabled={busyStudentId === item.student_id}
                      style={styles.actionBtn}
                      onPress={() => toggleFlag(item.student_id, item.is_flagged)}
                    >
                      {busyStudentId === item.student_id ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Text style={styles.actionBtnText}>
                          {item.is_flagged ? 'Remove flag' : 'Flag for follow-up'}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.actionBtnSecondary}
                      onPress={() => router.push(`/school/students/${item.student_id}`)}
                    >
                      <Text style={styles.actionBtnSecondaryText}>View student details →</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {followUpQueue.length ? 'No students match your filter.' : 'Great job! No students currently require follow-up.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Classroom Breakdown */}
        {activeTab === 'classrooms' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Classroom Performance & Status</Text>
            {classrooms.length ? (
              classrooms.map((c) => (
                <View key={c.classroom_id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.studentName}>{classroomLabel(c)}</Text>
                    <Pressable onPress={() => router.push(`/school/classrooms/${c.classroom_id}`)}>
                      <Text style={styles.linkText}>View classroom →</Text>
                    </Pressable>
                  </View>

                  <View style={styles.classGrid}>
                    <View style={styles.classStat}>
                      <Text style={styles.classStatLabel}>Students</Text>
                      <Text style={styles.classStatVal}>{c.student_count || 0}</Text>
                    </View>
                    <View style={styles.classStat}>
                      <Text style={styles.classStatLabel}>Flagged</Text>
                      <Text style={[styles.classStatVal, { color: c.flagged_count > 0 ? '#b42318' : '#344054' }]}>
                        {c.flagged_count || 0}
                      </Text>
                    </View>
                    <View style={styles.classStat}>
                      <Text style={styles.classStatLabel}>Courses</Text>
                      <Text style={styles.classStatVal}>{c.course_count || 0}</Text>
                    </View>
                    <View style={styles.classStat}>
                      <Text style={styles.classStatLabel}>Doses Taken</Text>
                      <Text style={[styles.classStatVal, { color: '#027a48' }]}>{c.taken_doses || 0}</Text>
                    </View>
                    <View style={styles.classStat}>
                      <Text style={styles.classStatLabel}>Doses Missed</Text>
                      <Text style={[styles.classStatVal, { color: c.missed_doses > 0 ? '#b42318' : '#344054' }]}>
                        {c.missed_doses || 0}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No classrooms registered yet.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  muted: { color: '#667085', fontSize: 13 },
  nav: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  navLink: { color: '#1769aa', fontWeight: '700', fontSize: 14 },
  logout: { color: '#b42318', fontWeight: '700', fontSize: 14 },
  errorText: { color: '#b42318', backgroundColor: '#fef3f2', padding: 12, borderRadius: 8 },
  messageText: { color: '#027a48', backgroundColor: '#edfcf2', padding: 12, borderRadius: 8 },

  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eaecf0' },
  tabActive: { backgroundColor: '#1769aa', borderColor: '#1769aa' },
  tabText: { color: '#344054', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  sectionContainer: { gap: 12 },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: '#101828' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { flex: 1, minWidth: 160, backgroundColor: '#fff', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#eaecf0' },
  statLabel: { color: '#667085', fontSize: 13, fontWeight: '600' },
  statNumber: { fontSize: 28, fontWeight: '700', marginTop: 4, color: '#101828' },
  statSub: { color: '#667085', fontSize: 12, marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#eaecf0', gap: 10 },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f2f4f7' },
  rowLabel: { fontSize: 14, color: '#475467' },
  rowValue: { fontSize: 14, fontWeight: '700', color: '#101828' },

  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  subTabs: { flexDirection: 'row', gap: 6 },
  subTab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#f2f4f7' },
  subTabActive: { backgroundColor: '#1769aa' },
  subTabText: { fontSize: 12, color: '#344054', fontWeight: '600' },
  subTabTextActive: { color: '#fff' },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { fontSize: 16, fontWeight: '700', color: '#101828' },
  meta: { fontSize: 13, color: '#667085' },
  badgeGroup: { flexDirection: 'row', gap: 6 },
  badgeRed: { backgroundColor: '#fef3f2', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeRedText: { color: '#b42318', fontSize: 11, fontWeight: '700' },
  badgeOrange: { backgroundColor: '#fffaeb', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeOrangeText: { color: '#b54708', fontSize: 11, fontWeight: '700' },

  studentStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 2 },
  detailText: { fontSize: 13, color: '#475467' },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f2f4f7' },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#d0d5dd' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  actionBtnSecondary: { paddingVertical: 6 },
  actionBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: '#1769aa' },

  linkText: { color: '#1769aa', fontSize: 13, fontWeight: '600' },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  classStat: { flex: 1, minWidth: 90, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10 },
  classStatLabel: { fontSize: 11, color: '#667085', fontWeight: '600' },
  classStatVal: { fontSize: 18, fontWeight: '700', marginTop: 2, color: '#101828' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 10, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#eaecf0' },
  emptyText: { color: '#667085', fontSize: 14 },
});
