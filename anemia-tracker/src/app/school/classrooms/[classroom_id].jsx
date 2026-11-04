import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, createClassroom, deleteClassroom, getClassroom, getClassroomStudents, getClassrooms, getTeachers, suggestNextSectionLetter, updateClassroom } from '../../../lib/school-api';

const defaults = ['A', 'B', 'C', 'D'];
const labelFor = (x) => (x?.grade_name && x?.section_name ? `${x.grade_name} – ${x.section_name}` : `Legacy: ${x?.class_name || 'classroom'}`);

export default function ClassroomDetails() {
  const { classroom_id: id, return_to: returnToParam } = useLocalSearchParams();
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
  const [token, setToken] = useState('');
  const [item, setItem] = useState(null);
  const [allClassrooms, setAllClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);

  // Edit current section state
  const [editSection, setEditSection] = useState('');
  const [customSection, setCustomSection] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState(null);
  const [legacyClassName, setLegacyClassName] = useState('');

  // Add new section state
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionDraft, setNewSectionDraft] = useState('');
  const [newTeacherId, setNewTeacherId] = useState(null);

  // Status and messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const expire = useCallback(async (e) => {
    if (e.code === 'SESSION_EXPIRED') {
      await clearSchoolSession();
      router.replace('/school/login?reason=session_expired');
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (value) => {
    const [c, s, t, ac] = await Promise.all([
      getClassroom(value, id),
      getClassroomStudents(value, id),
      getTeachers(value),
      getClassrooms(value),
    ]);
    const classroomData = c.classroom;
    setItem(classroomData);
    setEditSection(classroomData.section_name || '');
    setCustomSection(Boolean(classroomData.section_name && !defaults.includes(classroomData.section_name)));
    setEditTeacherId(classroomData.teacher_id !== undefined ? classroomData.teacher_id : null);
    setLegacyClassName(classroomData.class_name || '');
    setStudents(s.students || []);
    setTeachers(t.teachers || []);
    setAllClassrooms(ac.classrooms || []);
  }, [id]);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (value) => {
      if (!value) return router.replace('/school/login');
      setToken(value);
      try {
        await load(value);
      } catch (e) {
        if (!(await expire(e))) setError(e.message || 'Unable to load classroom.');
      } finally {
        setLoading(false);
      }
    });
  }, [expire, id, load]);

  const sectionsInGrade = item?.grade_name ? allClassrooms.filter((c) => c.grade_name === item.grade_name) : [];
  const existingSectionNames = sectionsInGrade.map((c) => c.section_name).filter(Boolean);
  const suggestedNextLetter = suggestNextSectionLetter(existingSectionNames);

  function openAddSectionForm() {
    setError('');
    setSuccess('');
    setNewSectionDraft(suggestedNextLetter || '');
    setNewTeacherId(null);
    setShowAddSection(true);
  }

  function closeAddSectionForm() {
    setError('');
    setShowAddSection(false);
    setNewSectionDraft('');
    setNewTeacherId(null);
  }

  async function handleSaveChanges() {
    setError('');
    setSuccess('');
    const payload = {};

    if (item.grade_name) {
      const normalized = editSection.trim().toUpperCase();
      if (!normalized) return setError('Section name is required.');
      if (!/^[A-Z0-9][A-Z0-9 ._-]*$/.test(normalized) || normalized.length > 20) {
        return setError('Enter a valid section of 20 characters or fewer.');
      }
      // Check duplicate section if changed
      if (normalized !== item.section_name && existingSectionNames.includes(normalized)) {
        return setError(`Section ${normalized} already exists in ${item.grade_name}.`);
      }
      payload.grade_name = item.grade_name;
      payload.section_name = normalized;
    } else {
      const trimmedClass = legacyClassName.trim();
      if (!trimmedClass) return setError('Class name is required.');
      if (trimmedClass.length > 50) return setError('Class name must be 50 characters or fewer.');
      payload.class_name = trimmedClass;
    }

    payload.teacher_id = editTeacherId;

    setSaving(true);
    try {
      await updateClassroom(token, id, payload);
      await load(token);
      if (returnTo) {
        router.replace(returnTo);
        return;
      }
      setSuccess('Classroom changes saved successfully.');
    } catch (e) {
      if (!(await expire(e))) setError(e.message || 'Unable to save classroom changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSection() {
    setError('');
    setSuccess('');
    const normalized = newSectionDraft.trim().toUpperCase();
    if (!normalized) return setError('Section name is required.');
    if (!/^[A-Z0-9][A-Z0-9 ._-]*$/.test(normalized) || normalized.length > 20) {
      return setError('Enter a valid section of 20 characters or fewer.');
    }
    if (existingSectionNames.includes(normalized)) {
      return setError(`Section ${normalized} already exists in ${item.grade_name}.`);
    }

    setSaving(true);
    try {
      await createClassroom(token, {
        grade_name: item.grade_name,
        section_name: normalized,
        ...(newTeacherId !== null ? { teacher_id: newTeacherId } : {}),
      });
      await load(token);
      closeAddSectionForm();
      setSuccess(`Section ${normalized} added successfully.`);
    } catch (e) {
      if (!(await expire(e))) setError(e.message || 'Unable to create new section.');
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    const text = 'A class-section with students or related history cannot be removed. No historical data will be deleted.';
    if (Platform.OS === 'web' && window.confirm(text)) doRemove();
    else if (Platform.OS !== 'web') Alert.alert('Remove section?', text, [{ text: 'Cancel' }, { text: 'Remove', onPress: doRemove }]);
  }

  async function doRemove() {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await deleteClassroom(token, id);
      router.replace('/school/dashboard');
    } catch (e) {
      if (!(await expire(e))) {
        if (e.message?.includes('related records') || e.message?.includes('Cannot delete')) {
          setError('Cannot remove section: this classroom has registered students or related health records. Historical data is preserved.');
        } else {
          setError(e.message || 'Section cannot be removed while it is in use.');
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!item) return <View style={styles.center}><Text style={styles.error}>{error || 'Classroom not found.'}</Text><Back /></View>;

  const assignedTeacher = teachers.find((x) => x.teacher_id === item.teacher_id);
  const activeTeachers = teachers.filter((x) => x.is_active);
  const editOptions = Array.from(new Set([...defaults, ...(item.section_name ? [item.section_name] : [])]));

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/school/classrooms')}><Text style={styles.back}>‹  Classroom directory</Text></Pressable>
          <Text style={styles.topLabel}>SCHOOL ADMIN</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.hero}>
            <View style={styles.classMark}><Text style={styles.classMarkText}>{(item.section_name || item.class_name || 'CL').slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>School structure</Text>
              <Text style={styles.title}>{labelFor(item)}</Text>
              <Text style={styles.heroText}>Manage this section, its primary teacher, and enrolled students.</Text>
            </View>
          </View>

          <View style={styles.navRow}>
            <Pressable onPress={() => router.push('/school/students')}><Text style={styles.navLink}>Students</Text></Pressable>
            <Pressable onPress={() => router.push('/school/teachers')}><Text style={styles.navLink}>Teachers</Text></Pressable>
            <Pressable onPress={() => router.push('/school/reports')}><Text style={styles.navLink}>Reports</Text></Pressable>
            <Pressable onPress={() => router.push('/school/profile')}><Text style={styles.navLink}>Profile</Text></Pressable>
          </View>

          {/* Section switcher for same grade */}
          {sectionsInGrade.length > 1 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Sections in {item.grade_name}</Text>
              <View style={styles.choices}>
                {sectionsInGrade.map((c) => (
                  <Pressable
                    key={c.classroom_id}
                    disabled={saving}
                    style={[styles.choice, c.classroom_id === item.classroom_id && styles.selected]}
                    onPress={() => {
                      if (c.classroom_id !== item.classroom_id) {
                        router.push(`/school/classrooms/${c.classroom_id}`);
                      }
                    }}
                  >
                    <Text>{c.section_name || c.class_name}{c.classroom_id === item.classroom_id ? ' (current)' : ''}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Edit current classroom */}
          {item.grade_name ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Section</Text>
              <View style={styles.choices}>
                {editOptions.map((value) => (
                  <Pressable
                    key={value}
                    disabled={saving}
                    style={[styles.choice, editSection === value && !customSection && styles.selected]}
                    onPress={() => {
                      setError('');
                      setSuccess('');
                      setEditSection(value);
                      setCustomSection(false);
                    }}
                  >
                    <Text>{value}</Text>
                  </Pressable>
                ))}
                <Pressable
                  disabled={saving}
                  style={[styles.choice, customSection && styles.selected]}
                  onPress={() => {
                    setError('');
                    setSuccess('');
                    setCustomSection(true);
                  }}
                >
                  <Text>Custom section</Text>
                </Pressable>
              </View>
              {customSection ? (
                <TextInput
                  style={styles.input}
                  value={editSection}
                  onChangeText={(v) => {
                    setError('');
                    setEditSection(v.toUpperCase());
                  }}
                  placeholder="Custom section (e.g. E)"
                  editable={!saving}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <Text style={styles.helper}>Legacy classroom preserved; section management is available for new structured records.</Text>
              <Text style={styles.label}>Class name</Text>
              <TextInput
                style={styles.input}
                value={legacyClassName}
                onChangeText={(v) => {
                  setError('');
                  setLegacyClassName(v);
                }}
                placeholder="Class name"
                editable={!saving}
              />
            </View>
          )}

          {/* Primary teacher assignment */}
          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Primary teacher</Text>
            <Text style={styles.muted}>
              Current: {assignedTeacher ? `${assignedTeacher.first_name} ${assignedTeacher.last_name}` : 'Not assigned'}
            </Text>
            <View style={styles.choices}>
              <Pressable
                disabled={saving}
                style={[styles.choice, editTeacherId === null && styles.selected]}
                onPress={() => {
                  setError('');
                  setSuccess('');
                  setEditTeacherId(null);
                }}
              >
                <Text>Not assigned</Text>
              </Pressable>
              {activeTeachers.map((x) => (
                <Pressable
                  key={x.teacher_id}
                  disabled={saving}
                  style={[styles.choice, editTeacherId === x.teacher_id && styles.selected]}
                  onPress={() => {
                    setError('');
                    setSuccess('');
                    setEditTeacherId(x.teacher_id);
                  }}
                >
                  <Text>{x.first_name} {x.last_name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Save changes action */}
          <Pressable disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={handleSaveChanges}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save changes</Text>}
          </Pressable>

          {/* Add another section for this grade */}
          {item.grade_name ? (
            <View style={styles.addSectionContainer}>
              {!showAddSection ? (
                <Pressable
                  disabled={saving}
                  style={styles.outlineButton}
                  onPress={openAddSectionForm}
                >
                  <Text style={styles.outlineButtonText}>+ Add another section for {item.grade_name}</Text>
                </Pressable>
              ) : (
                <View style={styles.addSectionBox}>
                  <Text style={styles.subheading}>Add section to {item.grade_name}</Text>
                  <Text style={styles.label}>New section name</Text>
                  <TextInput
                    style={styles.input}
                    autoFocus
                    placeholder={suggestedNextLetter ? `e.g. ${suggestedNextLetter}` : 'New section'}
                    value={newSectionDraft}
                    onChangeText={(v) => {
                      setError('');
                      setNewSectionDraft(v.toUpperCase());
                    }}
                    editable={!saving}
                  />
                  <Text style={styles.label}>Assign teacher (optional)</Text>
                  <View style={styles.choices}>
                    <Pressable
                      disabled={saving}
                      style={[styles.choice, newTeacherId === null && styles.selected]}
                      onPress={() => setNewTeacherId(null)}
                    >
                      <Text>Not assigned</Text>
                    </Pressable>
                    {activeTeachers.map((x) => (
                      <Pressable
                        key={x.teacher_id}
                        disabled={saving}
                        style={[styles.choice, newTeacherId === x.teacher_id && styles.selected]}
                        onPress={() => setNewTeacherId(x.teacher_id)}
                      >
                        <Text>{x.first_name} {x.last_name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.addSectionActions}>
                    <Pressable
                      disabled={saving}
                      style={[styles.smallAddButton, saving && styles.disabled]}
                      onPress={handleAddSection}
                    >
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add section</Text>}
                    </Pressable>
                    <Pressable
                      disabled={saving}
                      style={styles.cancelButton}
                      onPress={closeAddSectionForm}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Messages */}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          {/* Students List */}
          <View style={styles.sectionBlock}>
            <Text style={styles.label}>
              Students ({students.length})
              {students.filter((s) => s.is_flagged).length > 0 ? ` • ${students.filter((s) => s.is_flagged).length} flagged` : ''}
            </Text>
            {students.length ? (
              students.map((s) => (
                <Pressable key={s.student_id} onPress={() => router.push(`/school/students/${s.student_id}`)}>
                  <Text style={styles.row}>
                    {s.first_name} {s.last_name} • Roll {s.roll_number}
                    {s.is_flagged ? ' • ⚑ Flagged' : ''}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.muted}>No students in this section.</Text>
            )}
          </View>

          {/* Remove section */}
          <Pressable disabled={saving} style={[styles.delete, saving && styles.disabled]} onPress={remove}>
            <Text style={styles.deleteText}>Remove section</Text>
          </Pressable>

          <Back />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Back() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/school/dashboard'))}>
      <Text style={styles.link}>Back to dashboard</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fcf9f4' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 14, borderWidth: 1, borderColor: '#ead8df' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#fcf9f4' },
  topBar: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  back: { color: '#743b55', fontSize: 14, fontWeight: '700' },
  topLabel: { color: '#97425d', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 13, backgroundColor: '#f6f3ee', borderRadius: 14, padding: 16 },
  classMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#ffd9e1', alignItems: 'center', justifyContent: 'center' },
  classMarkText: { color: '#59253e', fontSize: 14, fontWeight: '700' },
  heroCopy: { flex: 1, minWidth: 180 },
  eyebrow: { color: '#97425d', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#59253e', fontFamily: 'Georgia', fontSize: 26, lineHeight: 34, marginTop: 2 },
  heroText: { color: '#514348', fontSize: 13, lineHeight: 19, marginTop: 4 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  navLink: { color: '#97425d', fontSize: 12, fontWeight: '700' },
  sectionBlock: { gap: 6 },
  subheading: { fontSize: 16, fontWeight: '700', color: '#59253e' },
  label: { fontWeight: '700', marginTop: 8, color: '#1c1c19' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  choice: { borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  selected: { backgroundColor: '#ffd9e1', borderColor: '#97425d' },
  input: { borderWidth: 1, borderColor: '#d5c2c7', borderRadius: 10, padding: 12, marginTop: 4, backgroundColor: '#fff' },
  button: { backgroundColor: '#59253e', borderRadius: 10, padding: 14, marginTop: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  outlineButton: { borderWidth: 1, borderColor: '#97425d', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  outlineButtonText: { color: '#97425d', fontWeight: '700' },
  addSectionContainer: { marginTop: 4 },
  addSectionBox: { backgroundColor: '#f6f3ee', borderWidth: 1, borderColor: '#ead8df', borderRadius: 12, padding: 16, gap: 10 },
  addSectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  smallAddButton: { backgroundColor: '#743b55', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  cancelButton: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#667085', fontWeight: '600' },
  delete: { borderWidth: 1, borderColor: '#b42318', padding: 13, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  deleteText: { color: '#b42318', fontWeight: '600' },
  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f2e4e9', color: '#1c1c19' },
  helper: { color: '#514348', fontSize: 13 },
  muted: { color: '#514348', marginTop: 2 },
  error: { color: '#b42318', minHeight: 20, marginTop: 4 },
  success: { color: '#1d3d33', backgroundColor: '#c7eadc', borderRadius: 9, padding: 10, minHeight: 20, marginTop: 4, fontWeight: '600' },
  link: { color: '#97425d', textAlign: 'center', marginTop: 14, fontWeight: '700' },
});
