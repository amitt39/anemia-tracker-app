import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, createClassroom, createStudent, createTeacher, getClassrooms, getSchoolProfile, getStudents, getTeachers, SUPPORTED_GRADES, suggestNextSectionLetter, updateClassroom, validateIndianMobileNumber } from './api';

const classroomLabel = (item) => item?.grade_name && item?.section_name ? `${item.grade_name} – ${item.section_name}` : `Legacy: ${item?.class_name || 'classroom'}`;
const emptyStudent = { classroom_id: '', roll_number: '', first_name: '', last_name: '', parent_phone: '', relationship: '', relationship_description: '', parent_contact_unavailable: false };
const emptyTeacher = { first_name: '', last_name: '', email: '', password: '' };

export default function Dashboard() {
  const [token, setToken] = useState(''); const [profile, setProfile] = useState(null); const [teachers, setTeachers] = useState([]); const [classrooms, setClassrooms] = useState([]); const [students, setStudents] = useState([]); const [active, setActive] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true); const [teacher, setTeacher] = useState(emptyTeacher); const [grade, setGrade] = useState(''); const [section, setSection] = useState(''); const [assignedTeacher, setAssignedTeacher] = useState(''); const [student, setStudent] = useState(emptyStudent); const [studentSearch, setStudentSearch] = useState(''); const [studentClassroom, setStudentClassroom] = useState('');
  async function refresh(value) { const [p, t, c, s] = await Promise.all([getSchoolProfile(value), getTeachers(value), getClassrooms(value), getStudents(value)]); setProfile(p.school || null); setTeachers(t.teachers || []); setClassrooms(c.classrooms || []); setStudents(s.students || []); }
  async function protectedError(error) { if (error.code === 'SESSION_EXPIRED') { await clearSchoolSession(); router.replace('/school/login?reason=session_expired'); return true; } return false; }
  useEffect(() => { AsyncStorage.getItem('token').then(async (value) => { if (!value) return router.replace('/school/login'); setToken(value); try { await refresh(value); } catch (e) { if (!(await protectedError(e))) setMessage(e.message || 'Unable to load dashboard.'); } finally { setLoading(false); } }); }, []);
  useFocusEffect(useCallback(() => { if (!token) return undefined; let mounted = true; refresh(token).catch(async (e) => { if (mounted && !(await protectedError(e))) setMessage(e.message || 'Unable to refresh dashboard.'); }); return () => { mounted = false; }; }, [token]));
  function validateStudent() { if (!student.classroom_id || !student.roll_number || !student.first_name.trim() || !student.last_name.trim() || !Number.isInteger(Number(student.roll_number)) || Number(student.roll_number) <= 0 || student.first_name.trim().length > 50 || student.last_name.trim().length > 50) return 'Choose a class-section, enter a positive roll number, and provide names of 50 characters or fewer.'; if (student.parent_contact_unavailable) return ''; if (!student.parent_phone.trim()) return 'Enter a parent mobile number or select contact unavailable.'; const phone = validateIndianMobileNumber(student.parent_phone); if (!phone.valid) return phone.reason === 'prefix' ? 'Indian mobile numbers must start with 6, 7, 8, or 9.' : 'Enter a valid Indian mobile number.'; if (!student.relationship) return 'Choose the parent or guardian relationship.'; if (student.relationship === 'Other' && (!student.relationship_description.trim() || student.relationship_description.trim().length > 30)) return 'Enter an Other relationship of 30 characters or fewer.'; return ''; }
  async function save(kind) { setMessage(''); if (kind === 'classroom') { const normalized = section.trim().toUpperCase(); if (!grade) return setMessage('Choose a class.'); if (!normalized) return setMessage('Section is required.'); if (!/^[A-Z0-9][A-Z0-9 ._-]*$/.test(normalized) || normalized.length > 20) return setMessage('Enter a valid section of 20 characters or fewer.'); if (classrooms.some((c) => c.grade_name === grade && c.section_name === normalized)) return setMessage(`That class and section already exists.`); try { await createClassroom(token, { grade_name: grade, section_name: normalized, ...(assignedTeacher ? { teacher_id: Number(assignedTeacher) } : {}) }); setGrade(''); setSection(''); setAssignedTeacher(''); } catch (e) { if (!(await protectedError(e))) return setMessage(e.message || 'Unable to create class-section.'); } } else if (kind === 'teacher') { try { await createTeacher(token, teacher); setTeacher(emptyTeacher); } catch (e) { if (!(await protectedError(e))) return setMessage(e.message || 'Unable to create teacher.'); } } else { const validation = validateStudent(); if (validation) return setMessage(validation); try { await createStudent(token, { classroom_id: Number(student.classroom_id), roll_number: Number(student.roll_number), first_name: student.first_name.trim(), last_name: student.last_name.trim(), parent_contact_unavailable: Boolean(student.parent_contact_unavailable), ...(!student.parent_contact_unavailable ? { parent_phone: student.parent_phone.trim(), relationship: student.relationship, relationship_description: student.relationship === 'Other' ? student.relationship_description.trim() : undefined } : {}) }); setStudent(emptyStudent); } catch (e) { if (!(await protectedError(e))) return setMessage(e.message || 'Unable to register student.'); } } try { await refresh(token); setActive(''); setMessage('Saved successfully.'); } catch (e) { if (!(await protectedError(e))) setMessage(e.message || 'Saved, but the dashboard could not refresh.'); } }
  async function assign(classroomId, teacherId) { setMessage(''); try { await updateClassroom(token, classroomId, { teacher_id: teacherId }); await refresh(token); setMessage('Teacher assignment updated.'); } catch (e) { if (!(await protectedError(e))) setMessage(e.message || 'Unable to update teacher assignment.'); } }
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  const visible = students.filter((item) => (!studentSearch.trim() || `${item.first_name} ${item.last_name} ${item.roll_number}`.toLowerCase().includes(studentSearch.trim().toLowerCase())) && (!studentClassroom || String(item.classroom_id) === studentClassroom));
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>School dashboard</Text>
            <Text style={styles.muted}>{profile?.school_name || 'School profile unavailable'}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => router.push('/school/tablets')}><Text style={styles.link}>Tablets</Text></Pressable>
            <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.link}>Reports</Text></Pressable>
            <Pressable onPress={() => router.push('/school/parents')}><Text style={styles.link}>Parents</Text></Pressable>
            <Pressable onPress={async () => { await clearSchoolSession(); router.replace('/school/login'); }}><Text style={styles.logout}>Logout</Text></Pressable>
          </View>
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.healthTitle}>Health & Supplementation Program</Text>
              <Text style={styles.muted}>Monitor tablet supplementation, dose adherence, Hb records, and student follow-ups.</Text>
            </View>
            <View style={styles.healthActions}>
              <Pressable style={styles.healthBtn} onPress={() => router.push('/school/tablets')}>
                <Text style={styles.healthBtnText}>Supplementation</Text>
              </Pressable>
              <Pressable style={[styles.healthBtn, styles.healthBtnAlt]} onPress={() => router.push('/school/reports')}>
                <Text style={[styles.healthBtnText, styles.healthBtnTextAlt]}>Reports & Follow-ups</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Section title="Teachers" add={() => setActive(active === 'teacher' ? '' : 'teacher')}>
          {teachers.length
            ? teachers.map((t) => (
                <Pressable key={t.teacher_id} onPress={() => router.push(`/school/teachers/${t.teacher_id}`)}>
                  <Text style={styles.row}>{t.first_name} {t.last_name} • {t.email} • {t.is_active ? 'Active' : 'Inactive'}</Text>
                </Pressable>
              ))
            : <Text style={styles.muted}>No teachers yet.</Text>}
          {active === 'teacher' ? <>
            <Input placeholder="First name" value={teacher.first_name} onChangeText={(v) => setTeacher({ ...teacher, first_name: v })} />
            <Input placeholder="Last name" value={teacher.last_name} onChangeText={(v) => setTeacher({ ...teacher, last_name: v })} />
            <Input placeholder="Email" value={teacher.email} onChangeText={(v) => setTeacher({ ...teacher, email: v })} />
            <Input placeholder="Temporary password" secureTextEntry value={teacher.password} onChangeText={(v) => setTeacher({ ...teacher, password: v })} />
            <Save onPress={() => save('teacher')} />
          </> : null}
        </Section>

        <Section title="Classrooms" add={() => setActive(active === 'classroom' ? '' : 'classroom')}>
          <Text style={styles.helper}>Class-section records with legacy classrooms preserved.</Text>
          {classrooms.length
            ? classrooms.map((item) => {
                const assignedT = teachers.find((t) => t.teacher_id === item.teacher_id);
                return (
                  <View key={item.classroom_id} style={styles.classroom}>
                    <Pressable onPress={() => router.push(`/school/classrooms/${item.classroom_id}`)}>
                      <Text style={styles.row}>{classroomLabel(item)}</Text>
                    </Pressable>
                    <Text style={styles.muted}>Primary teacher: {assignedT ? `${assignedT.first_name} ${assignedT.last_name}` : 'Not assigned'}</Text>
                    <View style={styles.choices}>
                      <Pressable style={[styles.choice, !item.teacher_id && styles.selected]} onPress={() => assign(item.classroom_id, null)}><Text>Not assigned</Text></Pressable>
                      {teachers.filter((t) => t.is_active).map((t) => (
                        <Pressable key={t.teacher_id} style={[styles.choice, item.teacher_id === t.teacher_id && styles.selected]} onPress={() => assign(item.classroom_id, t.teacher_id)}>
                          <Text>{t.first_name} {t.last_name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })
            : <Text style={styles.muted}>No classrooms yet.</Text>}
          {active === 'classroom' ? <>
            <Text style={styles.label}>Class / grade</Text>
            <View style={styles.choices}>
              {SUPPORTED_GRADES.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.choice, grade === value && styles.selected]}
                  onPress={() => {
                    setGrade(value);
                    setSection('');
                    setMessage('');
                  }}
                >
                  <Text>{value}</Text>
                </Pressable>
              ))}
            </View>
            <SectionPicker
              grade={grade}
              existingSections={classrooms.filter((c) => c.grade_name === grade).map((c) => c.section_name)}
              value={section}
              onChange={setSection}
            />
            <Text style={styles.label}>Primary teacher (optional)</Text>
            <View style={styles.choices}>
              <Pressable style={[styles.choice, !assignedTeacher && styles.selected]} onPress={() => setAssignedTeacher('')}><Text>Not assigned</Text></Pressable>
              {teachers.filter((t) => t.is_active).map((t) => (
                <Pressable key={t.teacher_id} style={[styles.choice, assignedTeacher === String(t.teacher_id) && styles.selected]} onPress={() => setAssignedTeacher(String(t.teacher_id))}>
                  <Text>{t.first_name} {t.last_name}</Text>
                </Pressable>
              ))}
            </View>
            <Save onPress={() => save('classroom')} />
          </> : null}
        </Section>

        <Section title="Students" add={() => setActive(active === 'student' ? '' : 'student')}>
          <Input placeholder="Search students" value={studentSearch} onChangeText={setStudentSearch} />
          <View style={styles.choices}>
            <Pressable style={styles.choice} onPress={() => setStudentClassroom('')}><Text>All class-sections</Text></Pressable>
            {classrooms.map((c) => (
              <Pressable key={c.classroom_id} style={[styles.choice, studentClassroom === String(c.classroom_id) && styles.selected]} onPress={() => setStudentClassroom(String(c.classroom_id))}>
                <Text>{classroomLabel(c)}</Text>
              </Pressable>
            ))}
          </View>
          {visible.length
            ? visible.map((item) => (
                <Pressable key={item.student_id} onPress={() => router.push(`/school/students/${item.student_id}`)}>
                  <Text style={styles.row}>{item.first_name} {item.last_name} • Roll {item.roll_number} • {classroomLabel(classrooms.find((c) => c.classroom_id === item.classroom_id))}{item.is_flagged ? ' • ⚑ Flagged' : ''}</Text>
                </Pressable>
              ))
            : <Text style={styles.muted}>{students.length ? 'No students match your search.' : 'No students yet.'}</Text>}
          {active === 'student' ? <>
            <Text style={styles.label}>Class-section</Text>
            <View style={styles.choices}>
              {classrooms.map((c) => (
                <Pressable key={c.classroom_id} style={[styles.choice, student.classroom_id === String(c.classroom_id) && styles.selected]} onPress={() => setStudent({ ...student, classroom_id: String(c.classroom_id) })}>
                  <Text>{classroomLabel(c)}</Text>
                </Pressable>
              ))}
            </View>
            <Input placeholder="Roll number" keyboardType="numeric" value={student.roll_number} onChangeText={(v) => setStudent({ ...student, roll_number: v })} />
            <Input placeholder="First name" value={student.first_name} onChangeText={(v) => setStudent({ ...student, first_name: v })} />
            <Input placeholder="Last name" value={student.last_name} onChangeText={(v) => setStudent({ ...student, last_name: v })} />
            <Text style={styles.label}>Parent/guardian contact</Text>
            <Pressable style={[styles.choice, student.parent_contact_unavailable && styles.selected]} onPress={() => setStudent({ ...student, parent_contact_unavailable: !student.parent_contact_unavailable, ...(student.parent_contact_unavailable ? {} : { parent_phone: '', relationship: '', relationship_description: '' }) })}>
              <Text>{student.parent_contact_unavailable ? 'Contact unavailable (selected)' : 'Parent/guardian contact unavailable'}</Text>
            </Pressable>
            {!student.parent_contact_unavailable ? <>
              <Input placeholder="Parent phone number" value={student.parent_phone} onChangeText={(v) => setStudent({ ...student, parent_phone: v })} />
              <View style={styles.choices}>
                {['Mother', 'Father', 'Guardian', 'Other'].map((v) => (
                  <Pressable key={v} style={[styles.choice, student.relationship === v && styles.selected]} onPress={() => setStudent({ ...student, relationship: v })}>
                    <Text>{v}</Text>
                  </Pressable>
                ))}
              </View>
              {student.relationship === 'Other' ? <Input placeholder="Relationship description" value={student.relationship_description} onChangeText={(v) => setStudent({ ...student, relationship_description: v })} /> : null}
            </> : null}
            <Save onPress={() => save('student')} />
          </> : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
function Section({ title, add, children }) { return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={add}><Text style={styles.link}>Add</Text></Pressable></View>{children}</View>; }
function Input(props) { return <TextInput {...props} style={styles.input} />; }
function SectionPicker({ grade, existingSections = [], value, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const defaults = ['A', 'B', 'C', 'D'];
  const suggestedLetter = suggestNextSectionLetter(existingSections);

  function startAdding() {
    setError('');
    setDraft(suggestedLetter || '');
    setAdding(true);
  }

  function add() {
    const normalized = draft.trim().toUpperCase();
    if (!normalized) return setError('Section name is required.');
    if (!/^[A-Z0-9][A-Z0-9 ._-]*$/.test(normalized) || normalized.length > 20) {
      return setError('Use up to 20 letters, numbers, spaces, dots, hyphens, or underscores.');
    }
    if (existingSections.includes(normalized)) {
      return setError(`Section ${normalized} already exists in ${grade || 'this class'}.`);
    }
    setError('');
    onChange(normalized);
    setDraft('');
    setAdding(false);
  }

  return (
    <View>
      <Text style={styles.label}>Section</Text>
      <View style={styles.choices}>
        {defaults.map((item) => (
          <Pressable
            key={item}
            style={[styles.choice, value === item && !adding && styles.selected]}
            onPress={() => {
              setAdding(false);
              setError('');
              onChange(item);
            }}
          >
            <Text>{item}</Text>
          </Pressable>
        ))}
        {Boolean(value) && !defaults.includes(value) ? (
          <Pressable
            style={[styles.choice, !adding && styles.selected]}
            onPress={() => {
              setAdding(false);
              setError('');
            }}
          >
            <Text>{value}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.choice, adding && styles.selected]}
          onPress={startAdding}
        >
          <Text>Add new section</Text>
        </Pressable>
      </View>
      {adding ? (
        <View style={styles.addSection}>
          <TextInput
            style={styles.input}
            autoFocus
            placeholder={suggestedLetter ? `e.g. ${suggestedLetter}` : 'New section'}
            value={draft}
            onChangeText={(v) => {
              setError('');
              setDraft(v);
            }}
          />
          <Pressable style={styles.smallButton} onPress={add}>
            <Text style={styles.smallButtonText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
function Save({ onPress }) { const [busy, setBusy] = useState(false); return <Pressable disabled={busy} style={styles.save} onPress={async () => { if (busy) return; setBusy(true); try { await onPress(); } finally { setBusy(false); } }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}</Pressable>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fa' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24, gap: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, actions: { flexDirection: 'row', gap: 16 }, title: { fontSize: 28, fontWeight: '700' }, section: { backgroundColor: '#fff', borderRadius: 12, padding: 18, gap: 8 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { fontSize: 20, fontWeight: '700' }, label: { fontWeight: '700', marginTop: 8 }, helper: { color: '#667085' }, muted: { color: '#667085' }, link: { color: '#1769aa', fontWeight: '700' }, logout: { color: '#b42318', fontWeight: '700' }, row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#eaecf0' }, classroom: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eaecf0' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }, choice: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 9 }, selected: { backgroundColor: '#dbeafe', borderColor: '#1769aa' }, input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 12, marginTop: 4, flex: 1 }, addSection: { flexDirection: 'row', alignItems: 'center', gap: 8 }, smallButton: { backgroundColor: '#1769aa', borderRadius: 8, padding: 12, marginTop: 4 }, smallButtonText: { color: '#fff', fontWeight: '700' }, error: { color: '#b42318' }, save: { backgroundColor: '#1769aa', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 }, saveText: { color: '#fff', fontWeight: '700' }, message: { color: '#1769aa' }, healthCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#eaecf0' }, healthCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, healthTitle: { fontSize: 18, fontWeight: '700', color: '#101828' }, healthActions: { flexDirection: 'row', gap: 8 }, healthBtn: { backgroundColor: '#1769aa', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }, healthBtnAlt: { backgroundColor: '#f2f4f7' }, healthBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 }, healthBtnTextAlt: { color: '#344054', fontWeight: '700', fontSize: 13 } });
