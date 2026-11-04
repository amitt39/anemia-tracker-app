import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getHbTests, getSchoolProfile, getSchoolReports, updateStudent } from '../../lib/school-api';

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

const classroomLabel = (item) => item?.grade_name && item?.section_name
  ? `${item.grade_name} – ${item.section_name}`
  : item?.class_name || 'Classroom';

export default function SchoolReports() {
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [hbTests, setHbTests] = useState([]);
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [busyStudentId, setBusyStudentId] = useState(null);

  const expire = useCallback(async (requestError) => {
    if (requestError.code !== 'SESSION_EXPIRED') return false;
    await clearSchoolSession();
    router.replace('/school/login?reason=session_expired');
    return true;
  }, []);

  const load = useCallback(async (authToken) => {
    const [profileResult, reportResult, hbResult] = await Promise.all([
      getSchoolProfile(authToken),
      getSchoolReports(authToken),
      getHbTests(authToken),
    ]);
    setProfile(profileResult.school || null);
    setReport(reportResult || null);
    setHbTests(hbResult.hb_tests || []);
    setLoadError('');
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (value) => {
      if (!value) return router.replace('/school/login');
      setToken(value);
      try {
        await load(value);
      } catch (requestError) {
        if (!(await expire(requestError))) setLoadError(requestError.message || 'Unable to load health reports.');
      } finally {
        setLoading(false);
      }
    });
  }, [expire, load]);

  useFocusEffect(useCallback(() => {
    if (!token) return undefined;
    let mounted = true;
    load(token).catch(async (requestError) => {
      if (mounted && !(await expire(requestError))) setLoadError(requestError.message || 'Unable to refresh health reports.');
    });
    return () => { mounted = false; };
  }, [expire, load, token]));

  const summary = report?.summary || {};
  const classrooms = report?.classrooms || [];
  const followUpQueue = useMemo(() => report?.follow_up_queue || [], [report]);
  const visibleFollowUp = useMemo(() => filterStudents(followUpQueue, search, selectedClassroom), [followUpQueue, search, selectedClassroom]);
  const visibleHb = useMemo(() => filterStudents(hbTests, search, selectedClassroom), [hbTests, search, selectedClassroom]);
  const priorityCount = followUpQueue.length;
  const totalStudents = Number(summary.total_students) || 0;
  const screenedStudents = hbTests.reduce((ids, test) => ids.add(test.student_id), new Set()).size;
  const screeningPercent = totalStudents ? Math.round((screenedStudents / totalStudents) * 100) : 0;

  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await load(token);
    } catch (requestError) {
      if (!(await expire(requestError))) setLoadError(requestError.message || 'Unable to refresh health reports.');
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleFlag(studentId, isFlagged) {
    setBusyStudentId(studentId);
    setActionError('');
    setMessage('');
    try {
      await updateStudent(token, studentId, { is_flagged: !isFlagged });
      await load(token);
      setMessage(isFlagged ? 'Follow-up flag removed.' : 'Student added to follow-up.');
    } catch (requestError) {
      if (!(await expire(requestError))) setActionError(requestError.message || 'Unable to update follow-up status.');
    } finally {
      setBusyStudentId(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Preparing your health summary…</Text></View>;

  if (loadError) return <View style={styles.center}><Text style={styles.errorText}>{loadError}</Text><Pressable style={styles.primaryButton} onPress={async () => { setLoading(true); setLoadError(''); try { await load(token); } catch (requestError) { if (!(await expire(requestError))) setLoadError(requestError.message || 'Unable to load health reports.'); } finally { setLoading(false); } }}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View>;

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
          <Text style={styles.eyebrow}>School health program</Text>
          <Text style={styles.title}>Health report</Text>
          <Text style={styles.heroText}>{profile?.school_name || 'One simple view of screening, follow-up, and supplementation.'}</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.navLink}>Teachers</Text></Pressable>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/school/tablets')}><Text style={styles.navLink}>Tablets</Text></Pressable>
          <Pressable onPress={() => router.push('/school/parents')}><Text style={styles.navLink}>Parents</Text></Pressable>
        </View>

        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        {message ? <Text style={styles.successText}>✓  {message}</Text> : null}

        <View style={[styles.priorityCard, priorityCount ? styles.priorityCardAlert : styles.priorityCardClear]}>
          <View style={styles.priorityIcon}><Text style={styles.priorityIconText}>{priorityCount ? '!' : '✓'}</Text></View>
          <View style={styles.priorityCopy}>
            <Text style={styles.priorityTitle}>{priorityCount ? `${priorityCount} student${priorityCount === 1 ? '' : 's'} need attention` : 'No follow-up cases right now'}</Text>
            <Text style={styles.priorityText}>{priorityCount ? 'Review flagged students or missed doses first.' : 'Your screening and supplementation queues are clear.'}</Text>
          </View>
          <Pressable style={styles.priorityButton} onPress={() => setView('followup')}><Text style={styles.priorityButtonText}>{priorityCount ? 'Review' : 'Open queue'}</Text></Pressable>
        </View>

        <View style={styles.viewTabs}>
          <Tab label="Overview" active={view === 'overview'} onPress={() => setView('overview')} />
          <Tab label={`Follow-up (${priorityCount})`} active={view === 'followup'} onPress={() => setView('followup')} />
          <Tab label={`Hb records (${hbTests.length})`} active={view === 'hb'} onPress={() => setView('hb')} />
        </View>

        {view === 'overview' ? (
          <Overview summary={summary} classrooms={classrooms} hbTests={hbTests} screeningPercent={screeningPercent} screenedStudents={screenedStudents} onOpenClassroom={(id) => router.push(`/school/classrooms/${id}`)} onOpenStudent={(id) => router.push(`/school/students/${id}`)} />
        ) : null}

        {view === 'followup' ? (
          <FollowUpView queue={visibleFollowUp} allQueue={followUpQueue} classrooms={classrooms} search={search} setSearch={setSearch} selectedClassroom={selectedClassroom} setSelectedClassroom={setSelectedClassroom} busyStudentId={busyStudentId} onToggleFlag={toggleFlag} />
        ) : null}

        {view === 'hb' ? (
          <HbView tests={visibleHb} allTests={hbTests} classrooms={classrooms} search={search} setSearch={setSearch} selectedClassroom={selectedClassroom} setSelectedClassroom={setSelectedClassroom} onOpenStudent={(id) => router.push(`/school/students/${id}`)} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Overview({ summary, classrooms, hbTests, screeningPercent, screenedStudents, onOpenClassroom, onOpenStudent }) {
  return (
    <View style={styles.stack}>
      <View style={styles.statsGrid}>
        <Stat label="Students" value={summary.total_students || 0} hint="enrolled" />
        <Stat label="Screened" value={`${screeningPercent}%`} hint={`${screenedStudents} students with Hb results`} />
        <Stat label="Follow-up" value={summary.flagged_students || 0} hint="flagged students" tone={summary.flagged_students ? 'alert' : 'normal'} />
        <Stat label="Adherence" value={summary.adherence_rate === null || summary.adherence_rate === undefined ? '—' : `${summary.adherence_rate}%`} hint="doses taken" tone="good" />
      </View>

      <SectionTitle title="Screening progress" hint="How many students have an Hb result" />
      {classrooms.length ? classrooms.map((classroom) => {
        const measured = hbTests.filter((test) => String(test.classroom_id) === String(classroom.classroom_id)).length;
        const total = Number(classroom.student_count) || 0;
        const percent = total ? Math.min(100, Math.round((measured / total) * 100)) : 0;
        return <Pressable key={classroom.classroom_id} style={styles.progressCard} onPress={() => onOpenClassroom(classroom.classroom_id)}><View style={styles.progressTop}><View><Text style={styles.cardTitle}>{classroomLabel(classroom)}</Text><Text style={styles.muted}>{measured} of {total} students screened</Text></View><Text style={styles.progressPercent}>{percent}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View><Text style={styles.link}>Open classroom →</Text></Pressable>;
      }) : <Empty title="No classrooms yet" text="Create a classroom to see screening progress." />}

      <SectionTitle title="Supplementation snapshot" hint="The numbers that need attention" />
      <View style={styles.snapshotCard}>
        <SnapshotRow label="Active tablet courses" value={summary.active_courses || 0} />
        <SnapshotRow label="Missed doses" value={summary.missed_doses || 0} tone={summary.missed_doses ? 'alert' : 'normal'} />
        <SnapshotRow label="Upcoming doses" value={summary.upcoming_doses || 0} />
      </View>

      <SectionTitle title="Recent Hb records" hint="Latest screening results" />
      {hbTests.slice(0, 5).map((test) => <Pressable key={test.test_id} style={styles.recordCard} onPress={() => onOpenStudent(test.student_id)}><View><Text style={styles.cardTitle}>{test.first_name} {test.last_name}</Text><Text style={styles.muted}>Roll {test.roll_number || '—'} · {test.test_date}</Text></View><Text style={styles.hbValue}>{test.hb_level} g/dL</Text></Pressable>)}
      {!hbTests.length ? <Empty title="No Hb records yet" text="Assigned classroom teachers record Hb results from their teacher workspace." /> : null}
    </View>
  );
}

function FollowUpView({ queue, allQueue, classrooms, search, setSearch, selectedClassroom, setSelectedClassroom, busyStudentId, onToggleFlag }) {
  return <View style={styles.stack}><SectionTitle title="Follow-up queue" hint="Flagged students and students with missed doses" /><FilterBar search={search} setSearch={setSearch} classrooms={classrooms} selectedClassroom={selectedClassroom} setSelectedClassroom={setSelectedClassroom} />{queue.length ? queue.map((item) => <View key={item.student_id} style={styles.followCard}><View style={styles.cardTop}><View><Text style={styles.cardTitle}>{item.first_name} {item.last_name}</Text><Text style={styles.muted}>Roll {item.roll_number || '—'} · {classroomLabel(item)}</Text></View><View style={styles.badges}>{item.is_flagged ? <Text style={styles.alertBadge}>Flagged</Text> : null}{item.missed_doses > 0 ? <Text style={styles.warningBadge}>{item.missed_doses} missed</Text> : null}</View></View><Text style={styles.detailText}>Latest Hb: {item.latest_hb_level ? `${item.latest_hb_level} g/dL (${item.latest_hb_date})` : 'Not recorded'}</Text><View style={styles.actionRow}><Pressable disabled={busyStudentId === item.student_id} style={styles.outlineAction} onPress={() => onToggleFlag(item.student_id, item.is_flagged)}><Text style={styles.outlineActionText}>{busyStudentId === item.student_id ? 'Saving…' : item.is_flagged ? 'Remove flag' : 'Flag student'}</Text></Pressable><Pressable onPress={() => router.push(`/school/students/${item.student_id}`)}><Text style={styles.link}>View profile →</Text></Pressable></View></View>) : <Empty title={allQueue.length ? 'No matches' : 'Nothing needs follow-up'} text={allQueue.length ? 'Try another search or classroom filter.' : 'There are no flagged students or missed doses right now.'} />}</View>;
}

function HbView({ tests, allTests, classrooms, search, setSearch, selectedClassroom, setSelectedClassroom, onOpenStudent }) {
  return <View style={styles.stack}><SectionTitle title="Hb records" hint="Search results from student screenings" /><FilterBar search={search} setSearch={setSearch} classrooms={classrooms} selectedClassroom={selectedClassroom} setSelectedClassroom={setSelectedClassroom} />{tests.length ? tests.map((test) => <Pressable key={test.test_id} style={styles.recordCard} onPress={() => onOpenStudent(test.student_id)}><View><Text style={styles.cardTitle}>{test.first_name} {test.last_name}</Text><Text style={styles.muted}>Roll {test.roll_number || '—'} · {classroomLabel(test)} · {test.test_date}</Text></View><Text style={styles.hbValue}>{test.hb_level} g/dL</Text></Pressable>) : <Empty title={allTests.length ? 'No matching records' : 'No Hb records yet'} text={allTests.length ? 'Try another search or classroom filter.' : 'Records appear here after a screening is saved.'} />}</View>;
}

function FilterBar({ search, setSearch, classrooms, selectedClassroom, setSelectedClassroom }) {
  return <><TextInput style={styles.search} placeholder="Search by student or roll number" placeholderTextColor={COLORS.muted} value={search} onChangeText={setSearch} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}><Pressable style={[styles.filterChip, !selectedClassroom && styles.filterChipActive]} onPress={() => setSelectedClassroom('')}><Text style={styles.filterText}>All classrooms</Text></Pressable>{classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.filterChip, selectedClassroom === String(classroom.classroom_id) && styles.filterChipActive]} onPress={() => setSelectedClassroom(String(classroom.classroom_id))}><Text style={styles.filterText}>{classroomLabel(classroom)}</Text></Pressable>)}</ScrollView></>;
}

function filterStudents(items, search, selectedClassroom) {
  const query = search.trim().toLowerCase();
  return items.filter((item) => {
    if (selectedClassroom && String(item.classroom_id) !== selectedClassroom) return false;
    if (!query) return true;
    return `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase().includes(query) || String(item.roll_number || '').includes(query);
  });
}

function Tab({ label, active, onPress }) { return <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function Stat({ label, value, hint, tone }) { return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, tone === 'alert' && styles.statAlert, tone === 'good' && styles.statGood]}>{value}</Text><Text style={styles.statHint}>{hint}</Text></View>; }
function SectionTitle({ title, hint }) { return <View style={styles.sectionTitleRow}><Text style={styles.sectionHeading}>{title}</Text><Text style={styles.sectionHint}>{hint}</Text></View>; }
function SnapshotRow({ label, value, tone }) { return <View style={styles.snapshotRow}><Text style={styles.snapshotLabel}>{label}</Text><Text style={[styles.snapshotValue, tone === 'alert' && styles.statAlert]}>{value}</Text></View>; }
function Empty({ title, text }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.muted}>{text}</Text></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.background, padding: 20 },
  topBar: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: COLORS.primaryContainer, fontSize: 14, fontWeight: '700' },
  topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { backgroundColor: COLORS.low, borderRadius: 16, padding: 20 },
  eyebrow: { color: COLORS.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 29, lineHeight: 37, marginTop: 3 },
  heroText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  navLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  errorText: { color: '#93000a', backgroundColor: '#ffdad6', padding: 12, borderRadius: 10 },
  successText: { color: COLORS.tertiary, backgroundColor: COLORS.tertiaryFixed, padding: 12, borderRadius: 10 },
  priorityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 15 },
  priorityCardAlert: { backgroundColor: '#ffdad6' },
  priorityCardClear: { backgroundColor: COLORS.tertiaryFixed },
  priorityIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  priorityIconText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  priorityCopy: { flex: 1 },
  priorityTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  priorityText: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  priorityButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  priorityButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  viewTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#ead8df', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  tabActive: { backgroundColor: COLORS.primaryContainer, borderColor: COLORS.primaryContainer },
  tabText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  stack: { gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: 145, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ead8df' },
  statLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  statValue: { color: COLORS.primary, fontSize: 26, fontWeight: '700', marginTop: 5 },
  statHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  statAlert: { color: '#b42318' },
  statGood: { color: COLORS.tertiary },
  sectionTitleRow: { marginTop: 4, gap: 3 },
  sectionHeading: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12 },
  progressCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#ead8df', gap: 8 },
  progressTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  progressPercent: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  track: { height: 9, borderRadius: 5, backgroundColor: '#f2e4e9', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primaryContainer, borderRadius: 5 },
  link: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  muted: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  snapshotCard: { backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ead8df' },
  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f2e4e9' },
  snapshotLabel: { color: COLORS.muted, fontSize: 13 },
  snapshotValue: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  recordCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ead8df' },
  hbValue: { color: COLORS.primary, fontSize: 17, fontWeight: '700' },
  search: { minHeight: 46, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text },
  filterRow: { gap: 8, paddingVertical: 1 },
  filterChip: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 8 },
  filterChipActive: { backgroundColor: COLORS.secondaryFixed, borderColor: COLORS.secondary },
  filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  followCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#ead8df', gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailText: { color: COLORS.muted, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' },
  alertBadge: { color: '#b42318', backgroundColor: '#ffdad6', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  warningBadge: { color: '#b54708', backgroundColor: '#fffaeb', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f2e4e9' },
  outlineAction: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  outlineActionText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  empty: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: '#ead8df', padding: 25, alignItems: 'center', gap: 5 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  primaryButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 11 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
