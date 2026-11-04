import { useCallback, useEffect, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  acceptParentStudentLink,
  getMyParentHbTests,
  getMyParentStudents,
  getMyParentTabletCourses,
  getMyParentTabletDoses,
  getParentInvitations,
  getPendingParentStudentLinks,
  markParentTabletDoseTaken,
  updateParentInvitation,
} from '../../lib/school-api';
import { AUTH } from '../../components/auth-ui';

function formatDate(value) {
  if (!value) return 'Date not available';
  return String(value).slice(0, 10);
}

function getStudentName(student) {
  return `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Linked child';
}

function getTodayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDoseLabel(dose) {
  if (dose.status === 'taken') return 'Taken';
  if (dose.scheduled_date < getTodayString()) return 'Overdue';
  if (dose.scheduled_date === getTodayString()) return 'Due today';
  return 'Scheduled';
}

async function clearParentSession() {
  await AsyncStorage.multiRemove(['parent_token', 'parent_id', 'parent_phone']);
}

export default function ParentDashboard() {
  const [token, setToken] = useState('');
  const [students, setStudents] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [hbTests, setHbTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [detailError, setDetailError] = useState('');
  const [hbError, setHbError] = useState('');
  const [courseError, setCourseError] = useState('');
  const [doseError, setDoseError] = useState('');
  const [accessError, setAccessError] = useState('');
  const requestId = useRef(0);

  const selectedStudent = students.find(
    (student) => String(student.student_id) === String(selectedStudentId),
  ) || null;

  const expireSession = useCallback(async () => {
    await clearParentSession();
    router.replace('/parent/login?reason=session_expired');
  }, []);

  const loadAccessRequests = useCallback(async (authToken) => {
    const results = await Promise.allSettled([
      getParentInvitations(authToken),
      getPendingParentStudentLinks(authToken),
    ]);
    if (results.some((result) => result.status === 'rejected' && result.reason?.code === 'SESSION_EXPIRED')) {
      await expireSession();
      return;
    }

    const [invitationResult, linkResult] = results;
    setInvitations(invitationResult.status === 'fulfilled' ? invitationResult.value.invitations || [] : []);
    setPendingLinks(linkResult.status === 'fulfilled' ? linkResult.value.student_links || [] : []);
    setAccessError(results.some((result) => result.status === 'rejected')
      ? 'Some access requests could not be loaded. Pull to refresh and try again.'
      : '');
  }, [expireSession]);

  const loadChildren = useCallback(async (authToken) => {
    try {
      setMessage('');
      const result = await getMyParentStudents(authToken);
      const linkedStudents = Array.isArray(result.students) ? result.students : [];
      setStudents(linkedStudents);
      setSelectedStudentId((current) => (
        linkedStudents.some((student) => String(student.student_id) === String(current))
          ? current
          : linkedStudents[0]?.student_id || null
      ));
      await loadAccessRequests(authToken);
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') {
        await expireSession();
        return false;
      }
      setMessage(error.message || 'Unable to load your linked children.');
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return true;
  }, [expireSession, loadAccessRequests]);

  const loadStudentRecords = useCallback(async (authToken, studentId) => {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setDetailLoading(true);
    setDetailError('');
    setHbError('');
    setCourseError('');
    setDoseError('');
    setHbTests([]);
    setCourses([]);
    setDoses([]);

    try {
      const results = await Promise.allSettled([
        getMyParentHbTests(authToken, studentId),
        getMyParentTabletCourses(authToken, studentId),
        getMyParentTabletDoses(authToken, studentId),
      ]);
      if (currentRequestId !== requestId.current) return;
      if (results.some((result) => result.status === 'rejected' && result.reason?.code === 'SESSION_EXPIRED')) {
        await expireSession();
        return;
      }

      const [hbResult, courseResult, doseResult] = results;
      if (hbResult.status === 'fulfilled') setHbTests(hbResult.value.hb_tests || []);
      else setHbError('Hb history could not be loaded.');
      if (courseResult.status === 'fulfilled') setCourses(courseResult.value.tablet_courses || []);
      else setCourseError('Tablet-course information could not be loaded.');
      if (doseResult.status === 'fulfilled') setDoses(doseResult.value.tablet_doses || []);
      else setDoseError('Dose schedule could not be loaded.');
      if (results.some((result) => result.status === 'rejected')) {
        setDetailError('Some records could not be loaded. You can retry this child’s records.');
      }
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      if (error.code === 'SESSION_EXPIRED') await expireSession();
      else setDetailError(error.message || 'Unable to load this child’s records.');
    } finally {
      if (currentRequestId === requestId.current) setDetailLoading(false);
    }
  }, [expireSession]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const savedToken = await AsyncStorage.getItem('parent_token');
      if (!savedToken) {
        router.replace('/parent/login');
        return;
      }
      if (!mounted) return;
      setToken(savedToken);
      await loadChildren(savedToken);
    }
    init();
    return () => {
      mounted = false;
      requestId.current += 1;
    };
  }, [loadChildren]);

  useEffect(() => {
    if (!token || !selectedStudentId) return;
    const timer = setTimeout(() => loadStudentRecords(token, selectedStudentId), 0);
    return () => clearTimeout(timer);
  }, [loadStudentRecords, selectedStudentId, token]);

  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    await loadChildren(token);
    if (selectedStudentId) await loadStudentRecords(token, selectedStudentId);
  }

  async function retryDetails() {
    if (token && selectedStudent) await loadStudentRecords(token, selectedStudent.student_id);
  }

  async function respondToInvitation(schoolId, status) {
    const action = `invitation-${schoolId}`;
    setBusyAction(action);
    setMessage('');
    try {
      await updateParentInvitation(token, schoolId, status);
      await loadChildren(token);
      setMessage(status === 'active' ? 'School invitation accepted.' : 'School invitation declined.');
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') await expireSession();
      else setMessage(error.message || 'Unable to update this invitation.');
    } finally {
      setBusyAction('');
    }
  }

  async function respondToStudentLink(studentId, accepted) {
    const action = `link-${studentId}`;
    setBusyAction(action);
    setMessage('');
    try {
      await acceptParentStudentLink(token, studentId, accepted);
      await loadChildren(token);
      setMessage(accepted ? 'Child link accepted. The school must confirm it before records appear.' : 'Child link declined.');
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') await expireSession();
      else setMessage(error.message || 'Unable to update this child link.');
    } finally {
      setBusyAction('');
    }
  }

  async function reportDoseTaken(doseId) {
    const action = `dose-${doseId}`;
    setBusyAction(action);
    setDoseError('');
    try {
      await markParentTabletDoseTaken(token, doseId);
      setMessage('Dose marked as taken.');
      await loadStudentRecords(token, selectedStudentId);
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') await expireSession();
      else setDoseError(error.message || 'Unable to report this dose.');
    } finally {
      setBusyAction('');
    }
  }

  async function logout() {
    await clearParentSession();
    router.replace('/parent/login');
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={AUTH.secondary} /><Text style={styles.muted}>Loading your parent workspace…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.eyebrow}>Parent portal</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Review verified health records and respond to school requests.</Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={logout}><Text style={styles.logoutText}>Sign out</Text></Pressable>
        </View>

        {message ? <View style={styles.successBox}><Text style={styles.successText}>{message}</Text></View> : null}
        {accessError ? <View style={styles.errorBox}><Text style={styles.errorText}>{accessError}</Text></View> : null}

        {invitations.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>School invitations</Text>
            <Text style={styles.sectionSubtitle}>Accept an invitation to activate your relationship with a school.</Text>
            {invitations.map((invitation) => {
              const action = `invitation-${invitation.school_id}`;
              return <View key={invitation.school_id} style={styles.requestCard}>
                <View style={styles.requestCopy}><Text style={styles.requestTitle}>{invitation.school_name}</Text><Text style={styles.muted}>Invited {formatDate(invitation.invited_at)}</Text></View>
                <View style={styles.requestActions}>
                  <Pressable disabled={busyAction === action} style={styles.acceptButton} onPress={() => respondToInvitation(invitation.school_id, 'active')}><Text style={styles.acceptText}>{busyAction === action ? 'Saving…' : 'Accept'}</Text></Pressable>
                  <Pressable disabled={busyAction === action} style={styles.declineButton} onPress={() => respondToInvitation(invitation.school_id, 'declined')}><Text style={styles.declineText}>Decline</Text></Pressable>
                </View>
              </View>;
            })}
          </View>
        ) : null}

        {pendingLinks.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Child link requests</Text>
            <Text style={styles.sectionSubtitle}>Confirm the children you are authorized to view. The school completes the final verification.</Text>
            {pendingLinks.map((link) => {
              const action = `link-${link.student_id}`;
              return <View key={`${link.school_id}-${link.student_id}`} style={styles.requestCard}>
                <View style={styles.requestCopy}><Text style={styles.requestTitle}>{getStudentName(link)}</Text><Text style={styles.muted}>{link.school_name} · {link.class_name || 'Classroom'} · Roll {link.roll_number ?? '—'}</Text><Text style={styles.muted}>Relationship: {link.relationship || 'Not provided'}</Text></View>
                <View style={styles.requestActions}>
                  <Pressable disabled={busyAction === action} style={styles.acceptButton} onPress={() => respondToStudentLink(link.student_id, true)}><Text style={styles.acceptText}>{busyAction === action ? 'Saving…' : 'Confirm'}</Text></Pressable>
                  <Pressable disabled={busyAction === action} style={styles.declineButton} onPress={() => respondToStudentLink(link.student_id, false)}><Text style={styles.declineText}>Decline</Text></Pressable>
                </View>
              </View>;
            })}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Your children</Text>
        <Text style={styles.sectionSubtitle}>Select a verified child to view their available health records.</Text>
        {students.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No verified children linked</Text><Text style={styles.muted}>Accepted child links appear here after the school confirms them. Contact your school if this is unexpected.</Text></View>
        ) : (
          <View style={styles.childList}>
            {students.map((student) => {
              const selected = String(selectedStudentId) === String(student.student_id);
              return <Pressable key={student.student_id} style={[styles.childCard, selected && styles.selectedChildCard]} onPress={() => setSelectedStudentId(student.student_id)} accessibilityRole="button" accessibilityLabel={`${getStudentName(student)}${selected ? ', selected' : ''}`}>
                <Text style={styles.childName}>{getStudentName(student)}</Text><Text style={styles.muted}>{student.school_name || 'School not available'}</Text><Text style={styles.muted}>{student.class_name || 'Classroom not available'} · Roll {student.roll_number ?? 'not available'}</Text><Text style={styles.cardAction}>{selected ? 'Currently selected' : 'View records'}</Text>
              </Pressable>;
            })}
          </View>
        )}

        {selectedStudent ? <View style={styles.recordsSection}>
          <Text style={styles.sectionTitle}>{getStudentName(selectedStudent)}’s records</Text>
          <Text style={styles.muted}>{selectedStudent.school_name || 'School not available'} · {selectedStudent.class_name || 'Classroom not available'}</Text>
          {detailLoading ? <View style={styles.detailLoading}><ActivityIndicator color={AUTH.secondary} /><Text style={styles.muted}>Loading available records…</Text></View> : <>
            {detailError ? <View style={styles.errorBox}><Text style={styles.errorText}>{detailError}</Text><Pressable style={styles.retryButton} onPress={retryDetails}><Text style={styles.retryText}>Retry records</Text></Pressable></View> : null}
            <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryNumber}>{hbTests.length}</Text><Text style={styles.summaryLabel}>Recorded Hb tests</Text></View><View style={styles.summaryCard}><Text style={styles.summaryNumber}>{courses.length}</Text><Text style={styles.summaryLabel}>Tablet courses</Text></View><View style={styles.summaryCard}><Text style={styles.summaryNumber}>{doses.filter((dose) => dose.status === 'taken').length}</Text><Text style={styles.summaryLabel}>Doses reported</Text></View></View>

            <Text style={styles.subheading}>Hb test history</Text>
            {hbError ? <Text style={styles.inlineError}>{hbError}</Text> : hbTests.length === 0 ? <Text style={styles.muted}>No Hb tests have been recorded for this child.</Text> : hbTests.map((test) => <View key={test.test_id} style={styles.recordCard}><Text style={styles.recordTitle}>Hb {test.hb_level} g/dL</Text><Text style={styles.muted}>Test date: {formatDate(test.test_date)}</Text></View>)}

            <Text style={styles.subheading}>Tablet supplementation</Text>
            {courseError ? <Text style={styles.inlineError}>{courseError}</Text> : courses.length === 0 ? <Text style={styles.muted}>No tablet courses have been recorded for this child.</Text> : courses.map((course) => <View key={course.course_id} style={styles.recordCard}><Text style={styles.recordTitle}>Course #{course.course_id}</Text><Text style={styles.muted}>Start: {formatDate(course.start_date)}</Text><Text style={styles.muted}>End: {formatDate(course.end_date)}</Text></View>)}

            <Text style={styles.subheading}>Dose schedule</Text>
            {doseError ? <Text style={styles.inlineError}>{doseError}</Text> : doses.length === 0 ? <Text style={styles.muted}>No dose schedule has been recorded for this child.</Text> : <View style={styles.doseList}>{doses.map((dose) => { const action = `dose-${dose.dose_id}`; const label = getDoseLabel(dose); return <View key={dose.dose_id} style={styles.doseRow}><View><Text style={styles.doseDate}>{formatDate(dose.scheduled_date)}</Text><Text style={[styles.doseStatus, label === 'Taken' ? styles.taken : label === 'Overdue' ? styles.overdue : styles.scheduled]}>{label}</Text></View>{dose.status === 'scheduled' ? <Pressable disabled={busyAction === action} style={styles.reportButton} onPress={() => reportDoseTaken(dose.dose_id)}><Text style={styles.reportText}>{busyAction === action ? 'Saving…' : 'Mark taken'}</Text></Pressable> : <Text style={styles.takenAt}>{dose.taken_at ? `Reported ${formatDate(dose.taken_at)}` : 'Reported'}</Text>}</View>; })}</View>}
          </>}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AUTH.background },
  content: { maxWidth: 820, width: '100%', alignSelf: 'center', padding: 16, paddingBottom: 44 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  headerInfo: { flex: 1, paddingRight: 12 },
  eyebrow: { color: AUTH.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 28, fontWeight: '500', marginTop: 4 },
  subtitle: { color: AUTH.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  logoutButton: { borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  logoutText: { color: AUTH.secondary, fontWeight: '700' },
  sectionTitle: { color: AUTH.primary, fontSize: 20, fontWeight: '700' },
  sectionSubtitle: { color: AUTH.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  sectionCard: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 16, padding: 16, marginBottom: 18 },
  requestCard: { borderTopWidth: 1, borderTopColor: AUTH.surfaceHigh, paddingTop: 12, marginTop: 8, gap: 10 },
  requestCopy: { gap: 3 },
  requestTitle: { color: AUTH.primary, fontSize: 16, fontWeight: '700' },
  requestActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  acceptButton: { backgroundColor: AUTH.primary, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineButton: { borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  declineText: { color: AUTH.muted, fontWeight: '700', fontSize: 13 },
  childList: { gap: 10 },
  childCard: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 16, gap: 4 },
  selectedChildCard: { borderColor: AUTH.secondary, borderWidth: 2 },
  childName: { color: AUTH.primary, fontSize: 17, fontWeight: '700' },
  cardAction: { color: AUTH.secondary, fontWeight: '700', marginTop: 5 },
  emptyCard: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 14, padding: 22, gap: 6 },
  emptyTitle: { color: AUTH.muted, fontSize: 17, fontWeight: '700' },
  recordsSection: { marginTop: 28 },
  detailLoading: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 12 },
  summaryCard: { flex: 1, minWidth: 130, backgroundColor: AUTH.surfaceLow, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 12, padding: 14 },
  summaryNumber: { color: AUTH.primary, fontSize: 24, fontWeight: '700' },
  summaryLabel: { color: AUTH.muted, fontSize: 13, marginTop: 3 },
  subheading: { color: AUTH.primary, fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  recordCard: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 12, padding: 14, marginBottom: 8, gap: 4 },
  recordTitle: { color: AUTH.primary, fontSize: 16, fontWeight: '700' },
  doseList: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 12, paddingHorizontal: 14 },
  doseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: AUTH.surfaceHigh },
  doseDate: { color: AUTH.muted, fontSize: 14, fontWeight: '600' },
  doseStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  taken: { color: AUTH.tertiary },
  overdue: { color: AUTH.error },
  scheduled: { color: AUTH.muted },
  reportButton: { borderWidth: 1, borderColor: AUTH.secondary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  reportText: { color: AUTH.secondary, fontSize: 12, fontWeight: '700' },
  takenAt: { color: AUTH.tertiary, fontSize: 12, fontWeight: '600' },
  muted: { color: AUTH.muted, fontSize: 13, lineHeight: 19 },
  errorBox: { backgroundColor: '#ffdad6', borderRadius: 10, padding: 14, marginBottom: 14, gap: 4 },
  errorText: { color: AUTH.error, fontSize: 14, lineHeight: 19 },
  successBox: { backgroundColor: AUTH.tertiaryFixed, borderRadius: 10, padding: 12, marginBottom: 14 },
  successText: { color: AUTH.tertiary, fontSize: 13, fontWeight: '600' },
  retryButton: { alignSelf: 'flex-start', backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 5 },
  retryText: { color: AUTH.secondary, fontWeight: '700' },
  inlineError: { color: AUTH.error, fontSize: 13, lineHeight: 18 },
});
