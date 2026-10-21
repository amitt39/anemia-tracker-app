import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  classroomLabel,
  clearTeacherSession,
  createTeacherHbTest,
  createTeacherTabletCourse,
  createTeacherTabletDoses,
  getTeacherSession,
  getTeacherStudent,
  getTeacherStudentHbTests,
  getTeacherStudentTabletCourses,
  getTeacherStudentTabletDoses,
  markTeacherTabletDoseTaken,
} from '../api';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TeacherStudentDetail() {
  const { student_id } = useLocalSearchParams();
  const [token, setToken] = useState(null);
  const [student, setStudent] = useState(null);
  const [hbTests, setHbTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [takingDoseId, setTakingDoseId] = useState(null);

  // Hb Test Form State
  const [newHbLevel, setNewHbLevel] = useState('');
  const [newHbDate, setNewHbDate] = useState(getTodayString());
  const [submittingHb, setSubmittingHb] = useState(false);
  const [hbSuccess, setHbSuccess] = useState('');
  const [hbError, setHbError] = useState('');

  // New Course Form State
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState('');
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [courseSuccess, setCourseSuccess] = useState('');
  const [courseError, setCourseError] = useState('');

  const loadData = useCallback(async (authToken) => {
    try {
      setError('');
      const [stuRes, hbRes, courseRes, doseRes] = await Promise.all([
        getTeacherStudent(authToken, student_id),
        getTeacherStudentHbTests(authToken, student_id).catch(() => ({ hb_tests: [] })),
        getTeacherStudentTabletCourses(authToken, student_id).catch(() => ({ tablet_courses: [] })),
        getTeacherStudentTabletDoses(authToken, student_id).catch(() => ({ tablet_doses: [] })),
      ]);

      setStudent(stuRes.student);
      setHbTests(hbRes.hb_tests || []);
      setCourses(courseRes.tablet_courses || []);
      setDoses(doseRes.tablet_doses || []);

      if (hbRes.hb_tests && hbRes.hb_tests.length > 0 && !selectedTestId) {
        setSelectedTestId(String(hbRes.hb_tests[0].test_id));
      }
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') {
        await clearTeacherSession();
        router.replace('/teacher/login?reason=session_expired');
        return;
      }
      setError(e.message || 'Unable to load student information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student_id, selectedTestId]);

  useEffect(() => {
    async function init() {
      const session = await getTeacherSession();
      if (!session.token) {
        router.replace('/teacher/login');
        return;
      }
      setToken(session.token);
      await loadData(session.token);
    }
    init();
  }, [loadData]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    await loadData(token);
  }

  async function handleRecordHb() {
    setHbError('');
    setHbSuccess('');
    const level = parseFloat(newHbLevel.trim());
    if (Number.isNaN(level) || level < 2.0 || level > 25.0) {
      setHbError('Hemoglobin level must be a number between 2.0 and 25.0 g/dL.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHbDate.trim())) {
      setHbError('Date must be in YYYY-MM-DD format.');
      return;
    }

    setSubmittingHb(true);
    try {
      await createTeacherHbTest(token, student_id, {
        hb_level: level,
        test_date: newHbDate.trim(),
      });
      setHbSuccess('Hb test recorded successfully.');
      setNewHbLevel('');
      await loadData(token);
    } catch (e) {
      setHbError(e.message || 'Failed to record Hb test.');
    } finally {
      setSubmittingHb(false);
    }
  }

  async function handleCreateCourse() {
    setCourseError('');
    setCourseSuccess('');
    if (!selectedTestId) {
      setCourseError('Please select a reference Hb test for this course.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      setCourseError('Start and end dates must be in YYYY-MM-DD format.');
      return;
    }
    if (endDate.trim() < startDate.trim()) {
      setCourseError('End date must be on or after start date.');
      return;
    }

    setSubmittingCourse(true);
    try {
      const result = await createTeacherTabletCourse(token, student_id, {
        test_id: parseInt(selectedTestId, 10),
        start_date: startDate.trim(),
        end_date: endDate.trim(),
      });

      // Automatically generate weekly scheduled dose dates within start and end date
      const dates = [];
      const current = new Date(startDate.trim());
      const end = new Date(endDate.trim());
      while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 7);
      }

      if (dates.length > 0 && result.tablet_course?.course_id) {
        try {
          await createTeacherTabletDoses(token, result.tablet_course.course_id, {
            scheduled_dates: dates,
          });
        } catch (_) {
          // If auto dose scheduling fails, course creation still succeeded
        }
      }

      setCourseSuccess('Tablet course created successfully.');
      setShowCourseForm(false);
      await loadData(token);
    } catch (e) {
      setCourseError(e.message || 'Failed to create tablet course.');
    } finally {
      setSubmittingCourse(false);
    }
  }

  async function handleMarkDoseTaken(doseId) {
    setError('');
    setTakingDoseId(doseId);
    try {
      await markTeacherTabletDoseTaken(token, doseId);
      await loadData(token);
    } catch (e) {
      setError(e.message || 'Unable to mark this dose as taken.');
    } finally {
      setTakingDoseId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1565c0" />
        <Text style={styles.loadingText}>Loading student records...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Navigation */}
        <View style={styles.navRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (student?.classroom_id) {
                router.push(`/teacher/classrooms/${student.classroom_id}`);
              } else {
                router.push('/teacher/dashboard');
              }
            }}
          >
            <Text style={styles.backBtnText}>← Back to Class</Text>
          </Pressable>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.push('/teacher/dashboard')}
          >
            <Text style={styles.backBtnText}>Dashboard</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Student Profile Card */}
        {student ? (
          <View style={styles.studentCard}>
            <View style={styles.studentCardTop}>
              <View style={styles.studentInfoLeft}>
                <Text style={styles.studentName}>
                  {student.first_name} {student.last_name}
                </Text>
                <Text style={styles.studentClass}>
                  Roll #{student.roll_number || 'N/A'} • {classroomLabel(student)}
                </Text>
                <Text style={styles.studentSub}>
                  {student.parent_contact_unavailable
                    ? 'Parent contact unavailable'
                    : 'Family contact on file'}
                </Text>
              </View>
              {student.is_flagged ? (
                <View style={styles.flagBadge}>
                  <Text style={styles.flagBadgeText}>⚑ Flagged for Follow-up</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Section: Hb Test History & Record New */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hemoglobin (Hb) History</Text>
          <Text style={styles.sectionSubtitle}>
            Recorded test measurements for this student
          </Text>

          {/* Record New Hb Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Record New Hb Test</Text>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Hb Level (g/dL)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10.5"
                  keyboardType="numeric"
                  value={newHbLevel}
                  onChangeText={setNewHbLevel}
                  editable={!submittingHb}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Test Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={newHbDate}
                  onChangeText={setNewHbDate}
                  editable={!submittingHb}
                />
              </View>
            </View>

            {hbError ? <Text style={styles.formErrorText}>{hbError}</Text> : null}
            {hbSuccess ? <Text style={styles.formSuccessText}>{hbSuccess}</Text> : null}

            <Pressable
              style={[styles.actionBtn, submittingHb && styles.btnDisabled]}
              disabled={submittingHb}
              onPress={handleRecordHb}
            >
              {submittingHb ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Save Hb Test</Text>
              )}
            </Pressable>
          </View>

          {/* Hb Tests List */}
          {hbTests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No Hb tests recorded yet for this student.</Text>
            </View>
          ) : (
            <View style={styles.recordList}>
              {hbTests.map((test) => (
                <View key={test.test_id} style={styles.recordRow}>
                  <View>
                    <Text style={styles.recordMain}>{test.hb_level} g/dL</Text>
                    <Text style={styles.recordSub}>Tested on {test.test_date}</Text>
                  </View>
                  <View
                    style={[
                      styles.hbLevelTag,
                      test.hb_level < 11.0 ? styles.hbLow : styles.hbNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.hbLevelTagText,
                        test.hb_level < 11.0 ? styles.hbLowText : styles.hbNormalText,
                      ]}
                    >
                      {test.hb_level < 11.0 ? 'Below 11.0 g/dL' : 'Normal range'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section: Tablet Courses & Doses */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tablet Supplementation Courses</Text>
              <Text style={styles.sectionSubtitle}>
                Iron/folic acid courses prescribed and scheduled
              </Text>
            </View>
            <Pressable
              style={styles.toggleCourseBtn}
              onPress={() => setShowCourseForm(!showCourseForm)}
            >
              <Text style={styles.toggleCourseBtnText}>
                {showCourseForm ? 'Cancel' : '+ New Course'}
              </Text>
            </Pressable>
          </View>

          {/* New Course Form */}
          {showCourseForm ? (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Initiate Tablet Course</Text>
              {hbTests.length === 0 ? (
                <Text style={styles.formErrorText}>
                  Please record an Hb test above before creating a course.
                </Text>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Select Reference Hb Test:</Text>
                  <View style={styles.pickerRow}>
                    {hbTests.map((t) => (
                      <Pressable
                        key={t.test_id}
                        style={[
                          styles.chip,
                          selectedTestId === String(t.test_id) && styles.chipActive,
                        ]}
                        onPress={() => setSelectedTestId(String(t.test_id))}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedTestId === String(t.test_id) && styles.chipTextActive,
                          ]}
                        >
                          {t.test_date} ({t.hb_level} g/dL)
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={startDate}
                        onChangeText={setStartDate}
                        editable={!submittingCourse}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={endDate}
                        onChangeText={setEndDate}
                        editable={!submittingCourse}
                      />
                    </View>
                  </View>

                  {courseError ? (
                    <Text style={styles.formErrorText}>{courseError}</Text>
                  ) : null}
                  {courseSuccess ? (
                    <Text style={styles.formSuccessText}>{courseSuccess}</Text>
                  ) : null}

                  <Pressable
                    style={[styles.actionBtn, submittingCourse && styles.btnDisabled]}
                    disabled={submittingCourse}
                    onPress={handleCreateCourse}
                  >
                    {submittingCourse ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnText}>Create Course & Schedule Doses</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          {/* Courses List */}
          {courses.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No tablet courses started for this student.</Text>
            </View>
          ) : (
            <View style={styles.recordList}>
              {courses.map((course) => {
                const courseDoses = doses.filter((d) => d.course_id === course.course_id);
                const takenDoses = courseDoses.filter((d) => d.status === 'taken');
                return (
                  <View key={course.course_id} style={styles.courseCard}>
                    <View style={styles.courseHeader}>
                      <Text style={styles.courseTitle}>
                        Course #{course.course_id}: {course.start_date} to {course.end_date}
                      </Text>
                      <Text style={styles.courseDoseCount}>
                        {takenDoses.length} / {courseDoses.length} doses taken
                      </Text>
                    </View>
                    {courseDoses.length > 0 ? (
                      <View style={styles.doseGrid}>
                        {courseDoses.map((dose) => (
                          <View
                            key={dose.dose_id}
                            style={[
                              styles.doseChip,
                              dose.status === 'taken' && styles.doseTaken,
                              dose.status === 'scheduled' && styles.doseScheduled,
                              dose.status === 'missed' && styles.doseMissed,
                            ]}
                          >
                            <Text style={styles.doseDate}>{dose.scheduled_date}</Text>
                            <Text style={styles.doseStatus}>{dose.status}</Text>
                            {dose.status === 'scheduled' ? (
                              <Pressable
                                disabled={takingDoseId === dose.dose_id}
                                style={[styles.takeDoseBtn, takingDoseId === dose.dose_id && styles.btnDisabled]}
                                onPress={() => handleMarkDoseTaken(dose.dose_id)}
                              >
                                {takingDoseId === dose.dose_id ? (
                                  <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                  <Text style={styles.takeDoseBtnText}>Mark as taken</Text>
                                )}
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#667085',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  backBtnText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee4e2',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
  },
  studentCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  studentCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  studentInfoLeft: {
    flex: 1,
    minWidth: 200,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  studentClass: {
    fontSize: 14,
    color: '#344054',
    marginTop: 4,
    fontWeight: '500',
  },
  studentSub: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  flagBadge: {
    backgroundColor: '#fee4e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b42318',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 20,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
    marginBottom: 14,
  },
  formContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  formCol: {
    flex: 1,
    minWidth: 160,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475467',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  formErrorText: {
    color: '#b42318',
    fontSize: 13,
    marginBottom: 8,
  },
  formSuccessText: {
    color: '#027a48',
    fontSize: 13,
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: '#1565c0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleCourseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
  },
  toggleCourseBtnText: {
    color: '#0d47a1',
    fontWeight: '600',
    fontSize: 13,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  chipText: {
    fontSize: 13,
    color: '#344054',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  recordList: {
    gap: 8,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f2f4f7',
  },
  recordMain: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },
  recordSub: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },
  hbLevelTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  hbLow: {
    backgroundColor: '#fee4e2',
  },
  hbLowText: {
    color: '#b42318',
    fontWeight: '700',
    fontSize: 12,
  },
  hbNormal: {
    backgroundColor: '#ecfdf3',
  },
  hbNormalText: {
    color: '#027a48',
    fontWeight: '700',
    fontSize: 12,
  },
  courseCard: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eaecf0',
    marginBottom: 8,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  courseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101828',
  },
  courseDoseCount: {
    fontSize: 13,
    color: '#667085',
  },
  doseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  doseChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  doseDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  doseStatus: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
  takeDoseBtn: {
    marginTop: 5,
    backgroundColor: '#1565c0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  takeDoseBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  doseTaken: {
    backgroundColor: '#ecfdf3',
    borderColor: '#a6f4c5',
  },
  doseScheduled: {
    backgroundColor: '#f2f4f7',
    borderColor: '#d0d5dd',
  },
  doseMissed: {
    backgroundColor: '#fee4e2',
    borderColor: '#fecdca',
  },
  emptyBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#667085',
    fontSize: 13,
  },
});
