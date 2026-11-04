import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSchoolSession,
  getClassrooms,
  getSchoolParents,
  getStudentParents,
  getStudents,
  inviteSchoolParent,
  revokeSchoolParent,
  updateStudentParentStatus,
  validateIndianMobileNumber,
} from '../../lib/school-api';

const classroomLabel = (item) => item?.grade_name && item?.section_name
  ? `${item.grade_name} – ${item.section_name}`
  : item?.class_name || 'Classroom unavailable';

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

export default function Parents() {
  const [token, setToken] = useState('');
  const [parents, setParents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [query, setQuery] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [phone, setPhone] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLink, setBusyLink] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const expire = useCallback(async (requestError) => {
    if (requestError.code !== 'SESSION_EXPIRED') return false;
    await clearSchoolSession();
    router.replace('/school/login?reason=session_expired');
    return true;
  }, []);

  const load = useCallback(async (authToken) => {
    const [parentResult, studentResult, classroomResult] = await Promise.all([
      getSchoolParents(authToken),
      getStudents(authToken),
      getClassrooms(authToken),
    ]);
    const students = studentResult.students || [];
    const linksByStudent = await Promise.all(students.map(async (student) => {
      const result = await getStudentParents(authToken, student.student_id);
      return (result.parents || []).map((link) => ({
        ...link,
        student_id: student.student_id,
        student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student name unavailable',
        roll_number: student.roll_number,
        classroom_id: student.classroom_id,
        classroom: classroomResult.classrooms?.find((item) => item.classroom_id === student.classroom_id),
      }));
    }));

    const grouped = new Map((parentResult.parents || []).map((parent) => [
      parent.parent_id,
      { ...parent, links: [] },
    ]));
    linksByStudent.flat().forEach((link) => {
      const parent = grouped.get(link.parent_id);
      if (parent) parent.links.push(link);
    });
    setParents(Array.from(grouped.values()));
    setClassrooms(classroomResult.classrooms || []);
    setError('');
  }, []);

  const refresh = useCallback(async (authToken) => {
    setLoading(true);
    try {
      await load(authToken);
    } catch (requestError) {
      if (!(await expire(requestError))) setError(requestError.message || 'Unable to load parent records.');
    } finally {
      setLoading(false);
    }
  }, [expire, load]);

  useEffect(() => {
    AsyncStorage.getItem('token').then((value) => {
      if (!value) {
        router.replace('/school/login');
        return;
      }
      setToken(value);
      refresh(value);
    });
  }, [refresh]);

  useFocusEffect(useCallback(() => {
    if (token) refresh(token);
    return undefined;
  }, [refresh, token]));

  async function invite() {
    const validation = validateIndianMobileNumber(phone);
    if (!validation.valid) {
      setError(validation.reason === 'prefix'
        ? 'Indian mobile numbers must start with 6, 7, 8, or 9.'
        : 'Enter a valid Indian mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await inviteSchoolParent(token, validation.normalized);
      setPhone('');
      setShowInvite(false);
      setMessage('Parent invitation saved. The parent can accept it after signing in.');
      await load(token);
    } catch (requestError) {
      if (!(await expire(requestError))) setError(requestError.message || 'Unable to invite this parent.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(parentId) {
    setBusyLink(`revoke-${parentId}`);
    setError('');
    try {
      await revokeSchoolParent(token, parentId);
      setMessage('Parent access revoked for this school.');
      await load(token);
    } catch (requestError) {
      if (!(await expire(requestError))) setError(requestError.message || 'Unable to revoke parent access.');
    } finally {
      setBusyLink('');
    }
  }

  function confirmRevoke(parent) {
    const text = 'This removes the parent’s school association and hides linked records from the parent portal.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Revoke parent access?\n\n${text}`)) revoke(parent.parent_id);
      return;
    }
    Alert.alert('Revoke parent access?', text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => revoke(parent.parent_id) },
    ]);
  }

  async function confirmLink(link) {
    const action = `link-${link.parent_id}-${link.student_id}`;
    setBusyLink(action);
    setError('');
    setMessage('');
    try {
      await updateStudentParentStatus(token, link.student_id, link.parent_id, 'verified');
      setMessage(`${link.student_name} is now verified for this parent.`);
      await load(token);
    } catch (requestError) {
      if (!(await expire(requestError))) setError(requestError.message || 'The parent must accept this link before school confirmation.');
    } finally {
      setBusyLink('');
    }
  }

  const visible = parents.filter((parent) => {
    const q = query.trim().toLowerCase();
    const matchesClassroom = !classroomFilter || parent.links.some((link) => String(link.classroom_id) === classroomFilter);
    const searchable = [
      parent.phone_number,
      parent.parent_status,
      parent.association_status,
      ...parent.links.flatMap((link) => [link.student_name, link.roll_number, classroomLabel(link.classroom)]),
    ].join(' ').toLowerCase();
    return matchesClassroom && (!q || searchable.includes(q));
  });

  if (loading && !parents.length) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading parent access…</Text></View>;
  if (error && !parents.length) return <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => refresh(token)}><Text style={styles.retryText}>Retry</Text></Pressable></View>;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/dashboard')}><Text style={styles.link}>‹  Dashboard</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Family access</Text>
          <Text style={styles.title}>Parent connections</Text>
          <Text style={styles.helper}>Invite parent accounts and confirm which children they can access.</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
          <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.navLink}>Teachers</Text></Pressable>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.navLink}>Classrooms</Text></Pressable>
          <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Parent access</Text><Text style={styles.sectionHint}>{parents.length} parent accounts connected</Text></View>
          <Pressable style={styles.primaryButton} onPress={() => { setShowInvite((value) => !value); setError(''); }}><Text style={styles.primaryText}>{showInvite ? 'Close' : '+ Invite parent'}</Text></Pressable>
        </View>

        {showInvite ? <View style={styles.inviteCard}><Text style={styles.cardTitle}>Invite a parent</Text><Text style={styles.muted}>The parent will see this invitation after signing in with the matching phone number.</Text><TextInput style={styles.input} placeholder="Parent mobile number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!busy} /><Pressable disabled={busy} style={styles.primaryButtonWide} onPress={invite}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send invitation</Text>}</Pressable></View> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput style={styles.input} placeholder="Search parent, phone, student, or roll number" value={query} onChangeText={setQuery} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, !classroomFilter && styles.selected]} onPress={() => setClassroomFilter('')}><Text>All classrooms</Text></Pressable>
          {classrooms.map((classroom) => <Pressable key={classroom.classroom_id} style={[styles.chip, classroomFilter === String(classroom.classroom_id) && styles.selected]} onPress={() => setClassroomFilter(String(classroom.classroom_id))}><Text>{classroomLabel(classroom)}</Text></Pressable>)}
        </ScrollView>

        {visible.length ? visible.map((parent) => {
          const revoked = parent.association_status === 'revoked';
          const action = `revoke-${parent.parent_id}`;
          return <View style={styles.card} key={parent.parent_id}>
            <View style={styles.cardHeader}><View style={styles.cardCopy}><Text style={styles.name}>{parent.phone_number || 'Phone number unavailable'}</Text><Text style={styles.muted}>Parent account: {parent.parent_status || 'Unknown'} · School access: {parent.association_status || 'Unknown'}</Text></View><Pressable disabled={busyLink === action || revoked} style={[styles.outlineButton, (revoked || busyLink === action) && styles.disabled]} onPress={() => confirmRevoke(parent)}><Text style={styles.outlineText}>{revoked ? 'Revoked' : busyLink === action ? 'Revoking…' : 'Revoke'}</Text></Pressable></View>
            <Text style={styles.heading}>Linked students ({parent.links.length})</Text>
            {parent.links.length ? parent.links.map((link) => {
              const linkAction = `link-${link.parent_id}-${link.student_id}`;
              const awaitingParent = !link.parent_accepted_at;
              return <View key={`${parent.parent_id}-${link.student_id}`} style={styles.student}>
                <Pressable onPress={() => router.push(`/school/students/${link.student_id}`)}><Text style={styles.studentName}>{link.student_name}</Text><Text style={styles.muted}>Roll {link.roll_number ?? 'Unavailable'} · {classroomLabel(link.classroom)}</Text></Pressable>
                <Text style={styles.status}>Link: {link.link_status || 'Unknown'}{awaitingParent ? ' · awaiting parent acceptance' : ''}</Text>
                {link.link_status !== 'verified' ? <Pressable disabled={awaitingParent || busyLink === linkAction || revoked} style={[styles.confirmButton, (awaitingParent || revoked) && styles.disabled]} onPress={() => confirmLink(link)}><Text style={styles.confirmText}>{awaitingParent ? 'Awaiting parent acceptance' : busyLink === linkAction ? 'Confirming…' : 'Confirm student link'}</Text></Pressable> : <Text style={styles.verified}>✓ Verified for parent access</Text>}
              </View>;
            }) : <Text style={styles.muted}>No student links have been returned for this school association.</Text>}
          </View>;
        }) : <View style={styles.empty}><Text style={styles.cardTitle}>{parents.length ? 'No parent records match your search.' : 'No parent invitations yet.'}</Text><Text style={styles.muted}>Invite a parent using the phone number registered with their account.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: COLORS.background },
  topBar: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { backgroundColor: COLORS.low, borderRadius: 16, padding: 20 },
  eyebrow: { color: COLORS.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, marginTop: 3 },
  helper: { color: COLORS.muted, lineHeight: 20, marginTop: 7, fontSize: 14 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  navLink: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  link: { color: COLORS.primaryContainer, fontWeight: '700', paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  primaryButton: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryButtonWide: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  inviteCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: '#ead8df' },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: '#ead8df' },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  name: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, padding: 12, color: COLORS.text },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: COLORS.surface },
  selected: { backgroundColor: COLORS.secondaryFixed, borderColor: COLORS.secondary },
  heading: { fontWeight: '700', color: COLORS.text, marginTop: 5 },
  student: { borderTopWidth: 1, borderTopColor: '#f2e4e9', paddingTop: 10, marginTop: 2, gap: 5 },
  studentName: { fontWeight: '700', color: COLORS.text },
  status: { color: COLORS.muted, fontSize: 12 },
  confirmButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  confirmText: { color: COLORS.secondary, fontWeight: '700', fontSize: 12 },
  verified: { color: COLORS.tertiary, fontWeight: '700', fontSize: 12 },
  outlineButton: { borderWidth: 1, borderColor: '#fecdca', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  outlineText: { color: '#b42318', fontWeight: '700', fontSize: 12 },
  disabled: { opacity: 0.55 },
  muted: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  error: { color: '#b42318', backgroundColor: '#fef3f2', padding: 10, borderRadius: 8 },
  success: { color: '#027a48', backgroundColor: '#ecfdf3', padding: 10, borderRadius: 8 },
  retry: { backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { backgroundColor: COLORS.surface, padding: 28, borderRadius: 14, gap: 6, borderWidth: 1, borderColor: '#ead8df' },
});
