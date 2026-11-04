import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AUTH } from './auth-ui';
import { classroomLabel, clearTeacherSession, getTeacherHbTests, getTeacherSession, getTeacherTabletDoses } from '../lib/teacher-api';

function formatDate(value) {
  return value ? String(value).slice(0, 10) : 'Date unavailable';
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function doseLabel(dose) {
  if (dose.status === 'taken') return 'Taken';
  if (dose.scheduled_date < todayString()) return 'Overdue';
  if (dose.scheduled_date === todayString()) return 'Due today';
  return 'Scheduled';
}

export default function TeacherRecords({ mode }) {
  const isHb = mode === 'hb';
  const [token, setToken] = useState(null);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (authToken) => {
    try {
      setError('');
      const result = isHb ? await getTeacherHbTests(authToken) : await getTeacherTabletDoses(authToken);
      setRecords(isHb ? (result.hb_tests || []) : (result.tablet_doses || []));
    } catch (requestError) {
      if (requestError.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(requestError.message || `Unable to load ${isHb ? 'Hb tests' : 'tablet doses'}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isHb]);

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

  const classrooms = useMemo(() => {
    const seen = new Map();
    records.forEach((record) => {
      if (!seen.has(record.classroom_id)) seen.set(record.classroom_id, record);
    });
    return Array.from(seen.values());
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (classroomFilter && String(record.classroom_id) !== classroomFilter) return false;
      if (!query) return true;
      return `${record.first_name || ''} ${record.last_name || ''}`.toLowerCase().includes(query)
        || classroomLabel(record).toLowerCase().includes(query)
        || (isHb ? String(record.hb_level || '').includes(query) : doseLabel(record).toLowerCase().includes(query));
    });
  }, [classroomFilter, isHb, records, search]);

  async function retry() {
    if (!token) return;
    setLoading(true);
    await load(token);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={AUTH.secondary} /><Text style={styles.muted}>Loading {isHb ? 'Hb tests' : 'tablet doses'}…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(token); }} />}>
        <View style={styles.topBar}>
          <View style={styles.topCopy}>
            <Text style={styles.eyebrow}>Teacher workspace</Text>
            <Text style={styles.title}>{isHb ? 'Hb Tests' : 'Tablet Doses'}</Text>
            <Text style={styles.subtitle}>{isHb ? 'Review screening history and record a new result for your assigned students.' : 'Review scheduled supplementation doses for your assigned students.'}</Text>
          </View>
          <Pressable style={styles.homeButton} onPress={() => router.push('/teacher/dashboard')}><Text style={styles.homeText}>Home</Text></Pressable>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/teacher/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/teacher/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/teacher/hb-tests')}><Text style={[styles.navLink, isHb && styles.navLinkActive]}>Hb Tests</Text></Pressable>
          <Pressable onPress={() => router.push('/teacher/tablet-doses')}><Text style={[styles.navLink, !isHb && styles.navLinkActive]}>Tablet Doses</Text></Pressable>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{filteredRecords.length}</Text><Text style={styles.summaryLabel}>{isHb ? 'Hb records shown' : 'Doses shown'}</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{classrooms.length}</Text><Text style={styles.summaryLabel}>Classrooms represented</Text></View>
        </View>

        <TextInput style={styles.search} placeholder="Search student, classroom, or status" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, !classroomFilter && styles.chipActive]} onPress={() => setClassroomFilter('')}><Text style={[styles.chipText, !classroomFilter && styles.chipTextActive]}>All classrooms</Text></Pressable>
          {classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.chip, classroomFilter === String(classroom.classroom_id) && styles.chipActive]} onPress={() => setClassroomFilter(String(classroom.classroom_id))}><Text style={[styles.chipText, classroomFilter === String(classroom.classroom_id) && styles.chipTextActive]}>{classroomLabel(classroom)}</Text></Pressable>)}
        </ScrollView>

        {filteredRecords.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No {isHb ? 'Hb tests' : 'tablet doses'} found</Text><Text style={styles.muted}>{records.length ? 'Try a different search or classroom.' : isHb ? 'Hb results will appear here after you record them from a student profile.' : 'Tablet schedules will appear here when courses are assigned.'}</Text></View>
        ) : (
          filteredRecords.map((record) => (
            <Pressable key={isHb ? record.test_id : record.dose_id} style={styles.recordCard} onPress={() => router.push(`/teacher/students/${record.student_id}`)}>
              <View style={styles.recordCopy}>
                <Text style={styles.recordTitle}>{record.first_name} {record.last_name}</Text>
                <Text style={styles.recordMeta}>{classroomLabel(record)} · Roll #{record.roll_number || '—'}</Text>
                {isHb ? <Text style={styles.recordDetail}>Tested {formatDate(record.test_date)}</Text> : <Text style={styles.recordDetail}>Scheduled {formatDate(record.scheduled_date)} · Course {formatDate(record.start_date)}–{formatDate(record.end_date)}</Text>}
              </View>
              {isHb ? <View style={styles.valueBadge}><Text style={styles.valueText}>Hb {record.hb_level} g/dL</Text></View> : <View style={[styles.valueBadge, doseLabel(record) === 'Overdue' && styles.overdueBadge, doseLabel(record) === 'Taken' && styles.takenBadge]}><Text style={styles.valueText}>{doseLabel(record)}</Text></View>}
              <Text style={styles.openLink}>Open student →</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AUTH.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 44 },
  center: { flex: 1, backgroundColor: AUTH.background, justifyContent: 'center', alignItems: 'center', gap: 10 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 12 },
  topCopy: { flex: 1 },
  eyebrow: { color: AUTH.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 28, fontWeight: '500', marginTop: 3 },
  subtitle: { color: AUTH.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  homeButton: { borderWidth: 1, borderColor: AUTH.outlineVariant, backgroundColor: AUTH.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  homeText: { color: AUTH.muted, fontWeight: '700', fontSize: 13 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  navLink: { color: AUTH.secondary, fontSize: 12, fontWeight: '700' },
  navLinkActive: { color: AUTH.primary },
  errorBox: { backgroundColor: '#ffdad6', borderRadius: 10, padding: 14, marginBottom: 14 },
  errorText: { color: '#93000a', fontSize: 14 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  retryText: { color: AUTH.secondary, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, minWidth: 150, backgroundColor: AUTH.surfaceLow, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 12, padding: 14 },
  summaryValue: { color: AUTH.primary, fontSize: 23, fontWeight: '700' },
  summaryLabel: { color: AUTH.muted, fontSize: 12, marginTop: 3 },
  search: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: AUTH.primary, borderColor: AUTH.primary },
  chipText: { color: AUTH.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  recordCard: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 15, marginBottom: 9, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  recordCopy: { flex: 1, minWidth: 210 },
  recordTitle: { color: AUTH.primary, fontSize: 15, fontWeight: '700' },
  recordMeta: { color: AUTH.muted, fontSize: 12, marginTop: 3 },
  recordDetail: { color: AUTH.muted, fontSize: 12, marginTop: 5 },
  valueBadge: { backgroundColor: AUTH.secondaryFixed, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  overdueBadge: { backgroundColor: '#ffdad6' },
  takenBadge: { backgroundColor: AUTH.tertiaryFixed },
  valueText: { color: AUTH.primary, fontSize: 12, fontWeight: '700' },
  openLink: { color: AUTH.secondary, fontSize: 12, fontWeight: '700' },
  empty: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 26, alignItems: 'center' },
  emptyTitle: { color: AUTH.primary, fontSize: 17, fontWeight: '700', marginBottom: 5 },
  muted: { color: AUTH.muted, fontSize: 13, lineHeight: 19 },
});
