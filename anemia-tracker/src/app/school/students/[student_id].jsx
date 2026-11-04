import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getClassrooms, getStudent, getStudentHbTests, getStudentParents, getStudentTabletCourses, getStudentTabletDoses, updateStudent } from '../../../lib/school-api';
const classroomLabel = (item) => item?.grade_name && item?.section_name ? `${item.grade_name} – ${item.section_name}` : `Legacy: ${item?.class_name || 'classroom'}`;
const COLORS = { background: '#fcf9f4', surface: '#ffffff', low: '#f6f3ee', surfaceHigh: '#ebe8e3', primary: '#59253e', primaryContainer: '#743b55', secondary: '#97425d', secondaryFixed: '#ffd9e1', tertiary: '#1d3d33', tertiaryFixed: '#c7eadc', text: '#1c1c19', muted: '#514348', outline: '#837378', outlineVariant: '#d5c2c7' };

export default function StudentDetails() {
  const { student_id: studentId } = useLocalSearchParams(); const [token, setToken] = useState(''); const [student, setStudent] = useState(null); const [classrooms, setClassrooms] = useState([]); const [linked, setLinked] = useState([]); const [hbTests, setHbTests] = useState([]); const [tabletCourses, setTabletCourses] = useState([]); const [tabletDoses, setTabletDoses] = useState([]); const [expandedCourseId, setExpandedCourseId] = useState(null); const [editingProfile, setEditingProfile] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  async function expire(e) { if (e.code === 'SESSION_EXPIRED') { await clearSchoolSession(); router.replace('/school/login?reason=session_expired'); return true; } return false; }
  async function load(value) { const [s, c, l, h, tc, td] = await Promise.all([getStudent(value, studentId), getClassrooms(value), getStudentParents(value, studentId), getStudentHbTests(value, studentId).catch(() => ({ hb_tests: [] })), getStudentTabletCourses(value, studentId).catch(() => ({ tablet_courses: [] })), getStudentTabletDoses(value, studentId).catch(() => ({ tablet_doses: [] }))]); setStudent(s.student); setClassrooms(c.classrooms || []); setLinked(l.parents || []); setHbTests(h.hb_tests || []); setTabletCourses(tc.tablet_courses || []); setTabletDoses(td.tablet_doses || []); }
  useEffect(() => { AsyncStorage.getItem('token').then(async (value) => { if (!value) return router.replace('/school/login'); setToken(value); try { await load(value); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to load student.'); } finally { setLoading(false); } }); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() { const first = student?.first_name?.trim() || ''; const last = student?.last_name?.trim() || ''; if (!first || !last || first.length > 50 || last.length > 50 || !student.roll_number || Number(student.roll_number) <= 0 || !student.classroom_id) return setError('Choose a classroom and enter valid required student details.'); setSaving(true); setError(''); try { await updateStudent(token, studentId, { first_name: first, last_name: last, roll_number: Number(student.roll_number), classroom_id: Number(student.classroom_id) }); await load(token); setEditingProfile(false); setError('Student details saved.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to save student.'); } finally { setSaving(false); } }
  async function toggleFlagged() { setSaving(true); setError(''); try { await updateStudent(token, studentId, { is_flagged: !student.is_flagged }); await load(token); setError(student.is_flagged ? 'Flag removed.' : 'Student flagged for follow-up.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to update flag.'); } finally { setSaving(false); } }
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!student) return <View style={styles.center}><Text style={styles.error}>{error || 'Student not found.'}</Text><Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/school/dashboard')}><Text style={styles.link}>Back to dashboard</Text></Pressable></View>;
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/students')}><Text style={styles.back}>‹  Student directory</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Student profile</Text>
              <Text style={styles.id}>Student ID: {student.student_id}</Text>
            </View>
            <Pressable disabled={saving} style={styles.editButton} onPress={() => setEditingProfile((current) => !current)}>
              <Text style={styles.editButtonText}>{editingProfile ? 'Close' : 'Edit profile'}</Text>
            </Pressable>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryName}>{student.first_name} {student.last_name}</Text>
            <Text style={styles.muted}>{classrooms.find((c) => Number(c.classroom_id) === Number(student.classroom_id)) ? classroomLabel(classrooms.find((c) => Number(c.classroom_id) === Number(student.classroom_id))) : 'Classroom not assigned'} · Roll #{student.roll_number || '—'}</Text>
          </View>
          <View style={styles.flagRow}>
            <Text style={student.is_flagged ? styles.flagged : styles.notFlagged}>{student.is_flagged ? '⚑ Flagged for follow-up' : 'Not flagged'}</Text>
            <Pressable disabled={saving} style={styles.flagButton} onPress={toggleFlagged}>
              <Text style={styles.flagButtonText}>{student.is_flagged ? 'Remove flag' : 'Flag for follow-up'}</Text>
            </Pressable>
          </View>
          {editingProfile ? (
            <View style={styles.editSection}>
              <Text style={styles.editTitle}>Edit profile details</Text>
              <Text style={styles.muted}>Update the student’s classroom, roll number, or name.</Text>
              <Text style={styles.label}>Classroom</Text>
              <View style={styles.choices}>
                {classrooms.map((c) => (
                  <Pressable key={c.classroom_id} disabled={saving} style={[styles.choice, Number(student.classroom_id) === c.classroom_id && styles.selected]} onPress={() => setStudent({ ...student, classroom_id: c.classroom_id })}>
                    <Text>{classroomLabel(c)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={styles.input} placeholder="Roll number" keyboardType="numeric" value={String(student.roll_number)} onChangeText={(v) => setStudent({ ...student, roll_number: v })} />
              <TextInput style={styles.input} placeholder="First name" value={student.first_name} onChangeText={(v) => setStudent({ ...student, first_name: v })} />
              <TextInput style={styles.input} placeholder="Last name" value={student.last_name} onChangeText={(v) => setStudent({ ...student, last_name: v })} />
              <Pressable disabled={saving} style={styles.button} onPress={save}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save changes</Text>}
              </Pressable>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.heading}>Hb Records</Text>
          <Text style={styles.teacherRecordNote}>Hb screenings are recorded by the teacher assigned to this classroom. This page is read-only for school administrators.</Text>
          {hbTests.length
            ? hbTests.map((h) => (
                <View style={styles.parent} key={h.test_id}>
                  <Text>{h.test_date} • Hb {h.hb_level} g/dL</Text>
                  <Text style={styles.muted}>Recorded by teacher ID {h.recorded_by}</Text>
                </View>
              ))
            : <Text style={styles.muted}>No Hb records yet.</Text>}

          <Text style={styles.heading}>Tablet Supplementation</Text>
          {tabletCourses.length
            ? tabletCourses.map((tc) => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const courseDoses = tabletDoses.filter((d) => d.course_id === tc.course_id);
                const takenCount = courseDoses.filter((d) => d.status === 'taken').length;
                const missedCount = courseDoses.filter((d) => d.status === 'scheduled' && d.scheduled_date < todayStr).length;
                const isExpanded = expandedCourseId === tc.course_id;
                const isCompleted = tc.end_date < todayStr;
                return (
                  <View style={styles.parent} key={tc.course_id}>
                    <View style={styles.courseHeader}>
                      <Text style={styles.bold}>Course #{tc.course_id}: {tc.start_date} to {tc.end_date}</Text>
                      <Text style={[styles.badge, isCompleted ? styles.badgeCompleted : styles.badgeActive]}>{isCompleted ? 'Completed' : 'Active'}</Text>
                    </View>
                    <Text style={styles.muted}>
                      Doses: {courseDoses.length} scheduled • {takenCount} taken{missedCount > 0 ? ` • ${missedCount} missed` : ''}
                    </Text>
                    <Pressable onPress={() => setExpandedCourseId(isExpanded ? null : tc.course_id)}>
                      <Text style={styles.link}>{isExpanded ? 'Hide doses' : 'View dose schedule'}</Text>
                    </Pressable>
                    {isExpanded ? (
                      <View style={styles.doseList}>
                        {courseDoses.length ? courseDoses.map((d) => {
                          const isMissed = d.status === 'scheduled' && d.scheduled_date < todayStr;
                          const statusLabel = d.status === 'taken' ? `Taken${d.taken_at ? ` on ${d.taken_at.slice(0, 10)}` : ''}` : (isMissed ? 'Missed' : 'Scheduled');
                          const statusColor = d.status === 'taken' ? '#027a48' : (isMissed ? '#b42318' : '#667085');
                          return (
                            <View key={d.dose_id} style={styles.doseRow}>
                              <Text style={styles.doseDate}>{d.scheduled_date}</Text>
                              <Text style={[styles.doseStatus, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                          );
                        }) : <Text style={styles.muted}>No doses scheduled for this course.</Text>}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : <Text style={styles.muted}>No tablet courses recorded for this student.</Text>}

          <Text style={styles.heading}>Parent links</Text>
          {linked.length
            ? linked.map((p) => (
                <View style={styles.parent} key={p.parent_id}>
                  <Text>{p.phone_number} • {p.relationship || 'Relationship not provided'} • {p.link_status}</Text>
                  <Text style={styles.muted}>Link status: {p.link_status || 'Unknown'}</Text>
                </View>
              ))
            : <Text style={styles.muted}>No parent links yet.</Text>}

          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/school/dashboard')}>
            <Text style={styles.link}>Back to dashboard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: COLORS.background }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: COLORS.background }, topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: COLORS.primaryContainer, fontSize: 14, fontWeight: '700' }, topLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#ead8df' }, titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }, titleCopy: { flex: 1, minWidth: 160 }, title: { color: COLORS.primary, fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, fontWeight: '500' }, id: { color: COLORS.muted, fontSize: 12, marginTop: 5 }, editButton: { borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }, editButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' }, summaryCard: { backgroundColor: COLORS.low, borderRadius: 12, padding: 15, marginTop: 18 }, summaryName: { color: COLORS.primary, fontSize: 19, fontWeight: '700' }, flagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant }, flagged: { color: '#93000a', fontWeight: '700' }, notFlagged: { color: COLORS.muted }, flagButton: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 12 }, flagButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' }, editSection: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#ead8df', borderRadius: 12, padding: 16, marginTop: 18 }, editTitle: { color: COLORS.primary, fontSize: 17, fontWeight: '700' }, heading: { color: COLORS.primary, fontSize: 19, fontWeight: '700', marginTop: 24 }, teacherRecordNote: { color: COLORS.tertiary, backgroundColor: COLORS.tertiaryFixed, borderRadius: 9, padding: 10, marginTop: 6, fontSize: 12, lineHeight: 18 }, label: { color: COLORS.text, fontWeight: '700', marginTop: 18 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, choice: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 9, padding: 9, backgroundColor: COLORS.surface }, selected: { backgroundColor: COLORS.secondaryFixed, borderColor: COLORS.secondary }, input: { borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10, padding: 13, marginTop: 10, color: COLORS.text, backgroundColor: COLORS.surface }, button: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 14 }, buttonText: { color: '#fff', fontWeight: '700' }, parent: { borderBottomWidth: 1, borderBottomColor: COLORS.surfaceHigh, paddingVertical: 12 }, error: { color: '#93000a', minHeight: 22, marginTop: 10 }, muted: { color: COLORS.muted, marginTop: 5, lineHeight: 18 }, link: { color: COLORS.secondary, marginTop: 10, textAlign: 'center', fontWeight: '700' }, courseHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, bold: { color: COLORS.text, fontWeight: '700' }, badge: { fontSize: 12, fontWeight: '700' }, badgeActive: { color: COLORS.tertiary }, badgeCompleted: { color: COLORS.muted }, doseList: { marginTop: 8, gap: 4 }, doseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.surfaceHigh }, doseDate: { color: COLORS.muted, fontSize: 13 }, doseStatus: { fontSize: 13, fontWeight: '700' } });
