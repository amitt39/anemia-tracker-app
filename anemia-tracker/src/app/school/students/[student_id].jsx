import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getClassrooms, getParents, getStudent, getStudentHbTests, getStudentParents, getStudentTabletCourses, getStudentTabletDoses, inviteSchoolParent, linkStudentParent, updateStudent, updateStudentParentStatus } from '../api';
const classroomLabel = (item) => item?.grade_name && item?.section_name ? `${item.grade_name} – ${item.section_name}` : `Legacy: ${item?.class_name || 'classroom'}`;

export default function StudentDetails() {
  const { student_id: studentId } = useLocalSearchParams(); const [token, setToken] = useState(''); const [student, setStudent] = useState(null); const [classrooms, setClassrooms] = useState([]); const [parents, setParents] = useState([]); const [linked, setLinked] = useState([]); const [hbTests, setHbTests] = useState([]); const [tabletCourses, setTabletCourses] = useState([]); const [tabletDoses, setTabletDoses] = useState([]); const [expandedCourseId, setExpandedCourseId] = useState(null); const [parentPhone, setParentPhone] = useState(''); const [parentId, setParentId] = useState(''); const [relationship, setRelationship] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  async function expire(e) { if (e.code === 'SESSION_EXPIRED') { await clearSchoolSession(); router.replace('/school/login?reason=session_expired'); return true; } return false; }
  async function load(value) { const [s, c, p, l, h, tc, td] = await Promise.all([getStudent(value, studentId), getClassrooms(value), getParents(value), getStudentParents(value, studentId), getStudentHbTests(value, studentId).catch(() => ({ hb_tests: [] })), getStudentTabletCourses(value, studentId).catch(() => ({ tablet_courses: [] })), getStudentTabletDoses(value, studentId).catch(() => ({ tablet_doses: [] }))]); setStudent(s.student); setClassrooms(c.classrooms || []); setParents(p.parents || []); setLinked(l.parents || []); setHbTests(h.hb_tests || []); setTabletCourses(tc.tablet_courses || []); setTabletDoses(td.tablet_doses || []); }
  useEffect(() => { AsyncStorage.getItem('token').then(async (value) => { if (!value) return router.replace('/school/login'); setToken(value); try { await load(value); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to load student.'); } finally { setLoading(false); } }); }, [studentId]);
  async function save() { const first = student?.first_name?.trim() || ''; const last = student?.last_name?.trim() || ''; if (!first || !last || first.length > 50 || last.length > 50 || !student.roll_number || Number(student.roll_number) <= 0 || !student.classroom_id) return setError('Choose a classroom and enter valid required student details.'); setSaving(true); setError(''); try { await updateStudent(token, studentId, { first_name: first, last_name: last, roll_number: Number(student.roll_number), classroom_id: Number(student.classroom_id) }); await load(token); setError('Student details saved.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to save student.'); } finally { setSaving(false); } }
  async function toggleFlagged() { setSaving(true); setError(''); try { await updateStudent(token, studentId, { is_flagged: !student.is_flagged }); await load(token); setError(student.is_flagged ? 'Flag removed.' : 'Student flagged for follow-up.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to update flag.'); } finally { setSaving(false); } }
  async function addParent() { if (!parentPhone.trim()) return setError('Enter a parent phone number.'); setSaving(true); setError(''); try { await inviteSchoolParent(token, parentPhone.trim()); setParentPhone(''); await load(token); setError('Invitation created. The parent must accept it before you can link them.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to invite parent.'); } finally { setSaving(false); } }
  async function link() { if (!parentId || !relationship.trim()) return setError('Select a parent and enter a relationship.'); setSaving(true); setError(''); try { await linkStudentParent(token, studentId, Number(parentId), relationship.trim()); await load(token); setParentId(''); setRelationship(''); setError('Parent linked as pending.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to link parent.'); } finally { setSaving(false); } }
  async function status(parent, newStatus) { setSaving(true); setError(''); try { await updateStudentParentStatus(token, studentId, parent.parent_id, newStatus); await load(token); setError('Parent link status updated.'); } catch (e) { if (!(await expire(e))) setError(e.message || 'Unable to update parent link.'); } finally { setSaving(false); } }
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!student) return <View style={styles.center}><Text style={styles.error}>{error || 'Student not found.'}</Text><Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/school/dashboard')}><Text style={styles.link}>Back to dashboard</Text></Pressable></View>;
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Student details</Text>
          <Text style={styles.id}>Student ID: {student.student_id}</Text>
          <View style={styles.flagRow}>
            <Text style={student.is_flagged ? styles.flagged : styles.notFlagged}>{student.is_flagged ? '⚑ Flagged for follow-up' : 'Not flagged'}</Text>
            <Pressable disabled={saving} style={styles.flagButton} onPress={toggleFlagged}>
              <Text style={styles.flagButtonText}>{student.is_flagged ? 'Remove flag' : 'Flag for follow-up'}</Text>
            </Pressable>
          </View>
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
          <Text style={styles.error}>{error}</Text>
          <Pressable disabled={saving} style={styles.button} onPress={save}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save student</Text>}
          </Pressable>

          <Text style={styles.heading}>Hb Records</Text>
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
                  {p.link_status === 'pending' && (p.parent_accepted_at
                    ? <Pressable disabled={saving} onPress={() => status(p, 'verified')}><Text style={styles.link}>Confirm accepted link</Text></Pressable>
                    : <Text style={styles.muted}>Waiting for parent acceptance</Text>)}
                  {p.link_status === 'verified' && <Pressable disabled={saving} onPress={() => status(p, 'pending')}><Text style={styles.link}>Mark pending</Text></Pressable>}
                </View>
              ))
            : <Text style={styles.muted}>No parent links yet.</Text>}

          <Text style={styles.heading}>Invite parent</Text>
          <TextInput style={styles.input} placeholder="Phone number" value={parentPhone} onChangeText={setParentPhone} />
          <Pressable disabled={saving} style={styles.secondary} onPress={addParent}><Text>Invite parent</Text></Pressable>

          <Text style={styles.heading}>Link existing school parent</Text>
          <View style={styles.choices}>
            {parents.filter((p) => p.association_status === 'active').map((p) => (
              <Pressable key={p.parent_id} disabled={saving} style={[styles.choice, parentId === String(p.parent_id) && styles.selected]} onPress={() => setParentId(String(p.parent_id))}>
                <Text>{p.phone_number}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Relationship" value={relationship} onChangeText={setRelationship} />
          <Pressable disabled={saving} style={styles.button} onPress={link}><Text style={styles.buttonText}>Link parent</Text></Pressable>

          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/school/dashboard')}>
            <Text style={styles.link}>Back to dashboard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fa' }, content: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 24 }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 24 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }, title: { fontSize: 28, fontWeight: '700' }, id: { color: '#667085', marginTop: 6 }, flagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eaecf0' }, flagged: { color: '#b42318', fontWeight: '700' }, notFlagged: { color: '#667085' }, flagButton: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }, flagButtonText: { fontSize: 13 }, heading: { fontSize: 20, fontWeight: '700', marginTop: 24 }, label: { fontWeight: '700', marginTop: 18 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, choice: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 9 }, selected: { backgroundColor: '#dbeafe', borderColor: '#1769aa' }, input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 13, marginTop: 10 }, button: { backgroundColor: '#1769aa', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 14 }, buttonText: { color: '#fff', fontWeight: '700' }, secondary: { borderWidth: 1, borderColor: '#d0d5dd', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 }, parent: { borderBottomWidth: 1, borderBottomColor: '#eaecf0', paddingVertical: 10 }, error: { color: '#b42318', minHeight: 22, marginTop: 10 }, muted: { color: '#667085', marginTop: 4 }, link: { color: '#1769aa', marginTop: 10, textAlign: 'center' }, courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bold: { fontWeight: '700' }, badge: { fontSize: 12, fontWeight: '700' }, badgeActive: { color: '#027a48' }, badgeCompleted: { color: '#667085' }, doseList: { marginTop: 8, gap: 4 }, doseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#f2f4f7' }, doseDate: { fontSize: 13 }, doseStatus: { fontSize: 13, fontWeight: '700' } });
