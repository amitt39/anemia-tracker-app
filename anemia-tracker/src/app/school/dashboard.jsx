import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getClassrooms, getHbTests, getSchoolProfile, getSchoolReports, getStudents, getTeachers } from '../../lib/school-api';

const COLORS = {
  background: '#fcf9f4',
  surface: '#ffffff',
  low: '#f6f3ee',
  high: '#ebe8e3',
  highest: '#e5e2dd',
  primary: '#59253e',
  primaryContainer: '#743b55',
  secondary: '#97425d',
  secondaryFixed: '#ffd9e1',
  tertiary: '#1d3d33',
  tertiaryFixed: '#c7eadc',
  text: '#1c1c19',
  muted: '#514348',
  outline: '#837378',
};

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ students: null, teachers: null, classrooms: null });
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [hbTests, setHbTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (value) => {
    const [profileResult, teachersResult, classroomsResult, studentsResult, reportsResult, hbResult] = await Promise.all([
      getSchoolProfile(value),
      getTeachers(value),
      getClassrooms(value),
      getStudents(value),
      getSchoolReports(value),
      getHbTests(value),
    ]);
    setProfile(profileResult.school || null);
    setCounts({
      students: Array.isArray(studentsResult.students) ? studentsResult.students.length : 0,
      teachers: Array.isArray(teachersResult.teachers) ? teachersResult.teachers.length : 0,
      classrooms: Array.isArray(classroomsResult.classrooms) ? classroomsResult.classrooms.length : 0,
    });
    setTeachers(Array.isArray(teachersResult.teachers) ? teachersResult.teachers : []);
    setClassrooms(Array.isArray(reportsResult.classrooms) ? reportsResult.classrooms : []);
    setHbTests(Array.isArray(hbResult.hb_tests) ? hbResult.hb_tests : []);
    setError('');
  }, []);

  const handleProtectedError = useCallback(async (requestError) => {
    if (requestError.code === 'SESSION_EXPIRED') {
      await clearSchoolSession();
      router.replace('/school/login?reason=session_expired');
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (value) => {
    setLoading(true);
    try {
      await refresh(value);
    } catch (requestError) {
      if (!(await handleProtectedError(requestError))) setError(requestError.message || 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [handleProtectedError, refresh]);

  useEffect(() => {
    AsyncStorage.getItem('token').then((value) => {
      if (!value) {
        router.replace('/school/login');
        return;
      }
      setToken(value);
      load(value);
    });
  }, [load]);

  useFocusEffect(useCallback(() => {
    if (!token) return undefined;
    load(token);
    return undefined;
  }, [load, token]));

  if (loading && counts.students === null) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Loading dashboard…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <View style={[styles.topHeader, compact && styles.topHeaderCompact]}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Text style={styles.brandDrop}>＋</Text></View>
              <View>
                <View style={styles.brandLabelRow}><Text style={styles.brandLabel}>ANEMIA TRACKER</Text></View>
                <Text style={styles.headerContext}>School Dashboard</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/school/profile')} style={styles.profileBlock} accessibilityRole="button" accessibilityLabel="Open school profile">
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>●</Text></View>
            </Pressable>
          </View>

          <View style={styles.campusHeader}>
            <View style={styles.campusTitleRow}>
              <View style={styles.campusTitleCopy}><Text style={styles.campusTitle}>{profile?.school_name || 'School overview'}</Text></View>
              <Pressable style={styles.settingsButton} onPress={() => router.push('/school/reports')}><Text style={styles.settingsIcon}>⚙</Text></Pressable>
            </View>
          </View>

          {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load(token)}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}

          <View style={styles.metricGrid}>
            <Metric label="Students" value={counts.students} note="Total enrolled" icon="♧" />
            <Metric label="Teachers" value={counts.teachers} note="Active faculty" icon="▣" />
            <Metric label="Classrooms" value={counts.classrooms} note="All sections" icon="▦" />
          </View>

          <SectionHeading title="Administrative Tools" detail="Quick Access" />
          <View style={styles.shortcutGrid}>
            <Shortcut title="Student Directory" note="Search & grade filters" icon="⌕" onPress={() => router.push('/school/students')} />
            <Shortcut title="Teacher Roster" note="Screening duty roles" icon="▣" onPress={() => router.push('/school/teachers')} />
            <Shortcut title="Classroom Directory" note={`${counts.classrooms || 0} sections configured`} icon="▦" onPress={() => router.push('/school/classrooms')} />
            <Shortcut title="School Health Reports" note="District sync stats" icon="▥" onPress={() => router.push('/school/reports')} />
          </View>

          <View style={styles.actionDeck}>
            <Pressable style={styles.primaryAction} onPress={() => router.push('/school/students')}><Text style={styles.actionIcon}>＋</Text><Text style={styles.primaryActionText}>Enroll New Student</Text></Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => router.push('/school/reports')}><Text style={styles.actionIconSecondary}>↓</Text><Text style={styles.secondaryActionText}>Download Compliance Report (CSV/PDF)</Text></Pressable>
          </View>

          <SectionHeading title="Screening Progress" detail={`${classrooms.length} monitored`} action="View All" onAction={() => router.push('/school/reports')} />
          <View style={styles.progressList}>
            {classrooms.length ? classrooms.slice(0, 6).map((classroom) => <ProgressCard key={classroom.classroom_id} classroom={classroom} hbTests={hbTests} teachers={teachers} />) : <View style={styles.emptyCard}><Text style={styles.muted}>No classroom screening data yet.</Text></View>}
          </View>

        </ScrollView>

        <View style={styles.bottomNav}>
          <NavItem icon="⌂" label="Dashboard" active onPress={() => {}} />
          <NavItem icon="♧" label="Students" onPress={() => router.push('/school/students')} />
          <NavItem icon="✚" label="Records" onPress={() => router.push('/school/reports')} />
          <NavItem icon="⚙" label="Role" onPress={() => router.push('/school/teachers')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value, note, icon, featured = false }) {
  return <View style={[styles.metric, featured && styles.metricFeatured]}><Text style={[styles.metricLabel, featured && styles.metricLabelFeatured]}>{label.toUpperCase()}</Text><Text style={[styles.metricValue, featured && styles.metricValueFeatured]}>{value == null ? '—' : value}</Text><Text style={[styles.metricNote, featured && styles.metricNoteFeatured]}>{note}</Text></View>;
}

function SectionHeading({ title, detail, action, onAction }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionHeadingTitle}><Text style={styles.sectionTitle}>{title}</Text>{detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}</View>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function Shortcut({ title, note, icon, onPress }) {
  return <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]} onPress={onPress}><View style={styles.shortcutIcon}><Text style={styles.shortcutIconText}>{icon}</Text></View><View><Text style={styles.shortcutTitle} numberOfLines={2}>{title}</Text><Text style={styles.shortcutNote} numberOfLines={2}>{note}</Text></View></Pressable>;
}

function ProgressCard({ classroom, hbTests, teachers }) {
  const measured = hbTests.filter((test) => String(test.classroom_id) === String(classroom.classroom_id)).length;
  const total = Number(classroom.student_count) || 0;
  const progress = total ? Math.min(100, Math.round((measured / total) * 100)) : 0;
  const label = classroom.grade_name && classroom.section_name ? `${classroom.grade_name} – ${classroom.section_name}` : classroom.class_name || 'Classroom';
  const teacher = teachers.find((item) => String(item.teacher_id) === String(classroom.teacher_id));
  const teacherName = teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() : 'Teacher unassigned';
  return <View style={styles.progressCard}><View style={styles.progressTop}><View style={styles.classroomIdentity}><View style={styles.classroomMark}><Text style={styles.classroomMarkText}>{(classroom.section_name || classroom.class_name || 'CL').slice(0, 2).toUpperCase()}</Text></View><View><Text style={styles.progressTitle}>{label}</Text><Text style={styles.progressNote}>Lead: {teacherName}</Text></View></View><Text style={styles.progressBadge}>{progress}% {progress === 100 ? 'Completed' : 'Screened'}</Text></View><View style={styles.progressMeta}><Text style={styles.muted}>Measured {measured} of {total}</Text><Text style={styles.progressStatus}>{progress === 100 ? 'Complete' : progress ? `${Math.max(total - measured, 0)} Remaining` : 'Pending'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View></View>;
}

function NavItem({ icon, label, active, onPress }) {
  return <Pressable style={styles.navItem} onPress={onPress}><Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  contentCompact: { paddingHorizontal: 12, gap: 13 },
  topHeader: { minHeight: 72, marginHorizontal: -20, paddingHorizontal: 20, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#ead8df', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topHeaderCompact: { marginHorizontal: -12, paddingHorizontal: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  brandMark: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#234ca2', alignItems: 'center', justifyContent: 'center' },
  brandDrop: { color: '#fff', fontSize: 18 },
  brandLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandLabel: { color: COLORS.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  brandPill: { color: COLORS.muted, backgroundColor: COLORS.high, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, fontSize: 9 },
  headerContext: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  profileBlock: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 160 },
  profileText: { alignItems: 'flex-end', flexShrink: 1 },
  profileName: { color: COLORS.text, fontSize: 10, fontWeight: '600' },
  profileRole: { color: COLORS.secondary, fontSize: 10, marginTop: 2 },
  profileAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 13 },
  campusHeader: { gap: 8, paddingTop: 4 },
  campusMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaBadge: { color: '#782944', backgroundColor: COLORS.secondaryFixed, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  liveBadge: { color: COLORS.primary, backgroundColor: COLORS.high, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '600' },
  term: { flex: 1, color: COLORS.muted, fontSize: 10, textAlign: 'right' },
  campusTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  campusTitleCopy: { flex: 1 },
  campusTitle: { color: COLORS.text, fontFamily: 'Georgia', fontSize: 25, lineHeight: 32 },
  campusSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  settingsButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.high, alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { color: COLORS.primary, fontSize: 19 },
  errorCard: { backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: '#93000a', flex: 1, fontSize: 13 },
  retry: { color: COLORS.primary, fontWeight: '700', paddingLeft: 12 },
  metricGrid: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 138, backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, justifyContent: 'space-between', borderWidth: 1, borderColor: '#ead8df', shadowColor: COLORS.primary, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  metricFeatured: { backgroundColor: COLORS.primaryContainer },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  metricLabelFeatured: { color: '#f4a9c8' },
  metricIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.low, alignItems: 'center', justifyContent: 'center' },
  metricIconFeatured: { backgroundColor: COLORS.primary },
  metricIconText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  metricIconTextFeatured: { color: '#fff' },
  metricValue: { color: COLORS.text, fontSize: 30, fontWeight: '700', marginTop: 7 },
  metricValueFeatured: { color: '#fff' },
  metricNote: { color: COLORS.muted, fontSize: 10 },
  metricNoteFeatured: { color: '#f4a9c8' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionHeadingTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  sectionDetail: { color: COLORS.muted, fontSize: 10 },
  sectionAction: { color: COLORS.secondary, fontSize: 11, fontWeight: '700' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { flex: 1, minWidth: 140, minHeight: 140, backgroundColor: COLORS.surface, borderRadius: 10, padding: 16, justifyContent: 'space-between', borderWidth: 1, borderColor: '#ead8df', shadowColor: COLORS.primary, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  shortcutIcon: { width: 40, height: 40, borderRadius: 6, backgroundColor: COLORS.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  shortcutIconText: { color: COLORS.primary, fontSize: 19, fontWeight: '700' },
  shortcutTitle: { color: COLORS.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  shortcutNote: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  actionDeck: { gap: 8 },
  primaryAction: { minHeight: 48, borderRadius: 12, backgroundColor: COLORS.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionIcon: { color: '#fff', fontSize: 20 },
  secondaryAction: { minHeight: 48, borderRadius: 12, backgroundColor: COLORS.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryActionText: { flex: 1, color: COLORS.primary, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  actionIconSecondary: { color: COLORS.primary, fontSize: 20 },
  progressList: { gap: 8 },
  progressCard: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 20, borderWidth: 1, borderColor: '#ead8df', shadowColor: COLORS.primary, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  classroomIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  classroomMark: { width: 36, height: 36, borderRadius: 9, backgroundColor: COLORS.low, alignItems: 'center', justifyContent: 'center' },
  classroomMarkText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  progressTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  progressNote: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  progressBadge: { color: COLORS.primary, backgroundColor: COLORS.secondaryFixed, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, fontSize: 10, fontWeight: '700' },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 },
  progressStatus: { color: COLORS.secondary, fontSize: 10, fontWeight: '700' },
  progressTrack: { height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: '#f2e4e9' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.primary },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 18 },
  bottomNav: { flexShrink: 0, height: 68, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.high, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6 },
  navItem: { minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIcon: { color: COLORS.muted, fontSize: 22 },
  navLabel: { color: COLORS.muted, fontSize: 10 },
  navActive: { color: COLORS.primary, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  muted: { color: COLORS.muted, fontSize: 12 },
});
