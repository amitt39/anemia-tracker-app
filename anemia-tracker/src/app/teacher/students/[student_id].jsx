import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../../../lib/teacher-api';
import { AUTH } from '../../../components/auth-ui';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function doseLabel(dose) {
  if (dose.status === 'taken') return 'Taken';
  const today = getTodayString();
  if (dose.status === 'scheduled' && dose.scheduled_date < today) return 'Overdue';
  if (dose.status === 'scheduled' && dose.scheduled_date === today) return 'Due today';
  return 'Scheduled';
}

export default function TeacherStudentDetail() {
  const { student_id } = useLocalSearchParams();
  const scrollRef = useRef(null);
  const [token, setToken] = useState(null);
  const [student, setStudent] = useState(null);
  const [parentContacts, setParentContacts] = useState([]);
  const [hbTests, setHbTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  async function redirectIfSessionExpired(error) {
    if (error.code !== 'SESSION_EXPIRED') return false;
    await clearTeacherSession();
    router.replace('/teacher/login?reason=session_expired');
    return true;
  }

  const loadData = useCallback(async (authToken) => {
    try {
      setError('');
      const [stuRes, hbRes, courseRes, doseRes] = await Promise.all([
        getTeacherStudent(authToken, student_id),
        getTeacherStudentHbTests(authToken, student_id),
        getTeacherStudentTabletCourses(authToken, student_id),
        getTeacherStudentTabletDoses(authToken, student_id),
      ]);

      setStudent(stuRes.student);
      setParentContacts(Array.isArray(stuRes.student?.parent_contacts) ? stuRes.student.parent_contacts : []);
      setHbTests(hbRes.hb_tests || []);
      setCourses(courseRes.tablet_courses || []);
      setDoses(doseRes.tablet_doses || []);

      setSelectedTestId((current) => {
        const tests = hbRes.hb_tests || [];
        if (!tests.length) return '';
        return tests.some((test) => String(test.test_id) === current)
          ? current
          : String(tests[0].test_id);
      });
      return true;
    } catch (e) {
      if (await redirectIfSessionExpired(e)) return;
      setError(e.message || 'Unable to load student information.');
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student_id]);

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
    const hbValue = newHbLevel.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(hbValue)) {
      setHbError('Hemoglobin level must be a number between 2.0 and 25.0 g/dL.');
      return;
    }
    const level = Number(hbValue);
    if (!Number.isFinite(level) || level < 2.0 || level > 25.0) {
      setHbError('Hemoglobin level must be a number between 2.0 and 25.0 g/dL.');
      return;
    }
    if (!isValidDateString(newHbDate.trim())) {
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
      const refreshed = await loadData(token);
      if (!refreshed) setHbError('Hb test was saved, but the student record could not be refreshed.');
    } catch (e) {
      if (await redirectIfSessionExpired(e)) return;
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
    if (!isValidDateString(startDate.trim()) || !isValidDateString(endDate.trim())) {
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

      let doseScheduleFailed = false;
      if (dates.length > 0 && result.tablet_course?.course_id) {
        try {
          await createTeacherTabletDoses(token, result.tablet_course.course_id, {
            scheduled_dates: dates,
          });
        } catch (_) {
          doseScheduleFailed = true;
        }
      }

      setCourseSuccess(doseScheduleFailed
        ? 'Tablet course created, but scheduled doses could not be created.'
        : 'Tablet course created successfully.');
      setShowCourseForm(false);
      const refreshed = await loadData(token);
      if (!refreshed) setCourseError('Course was created, but the student record could not be refreshed.');
    } catch (e) {
      if (await redirectIfSessionExpired(e)) return;
      setCourseError(e.message || 'Failed to create tablet course.');
    } finally {
      setSubmittingCourse(false);
    }
  }

  async function retry() {
    if (!token) return;
    setLoading(true);
    await loadData(token);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AUTH.secondary} />
        <Text style={styles.loadingText}>Loading student records...</Text>
      </SafeAreaView>
    );
  }

  if (!student && error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        <Pressable style={styles.backBtn} onPress={() => router.push('/teacher/students')}><Text style={styles.backBtnText}>Back to Students</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        ref={scrollRef}
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
            <Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></Pressable>
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
            <View style={styles.quickActionRow}>
              <View style={styles.quickActionCopy}>
                <Text style={styles.quickActionTitle}>Need to add today’s screening?</Text>
                <Text style={styles.quickActionText}>Record a new Hb result for this student in one step.</Text>
              </View>
              <Pressable
                style={styles.recordHbQuickButton}
                accessibilityRole="button"
                accessibilityLabel="Record Hb result"
                onPress={() => scrollRef.current?.scrollTo({ y: 360, animated: true })}
              >
                <Text style={styles.recordHbQuickButtonText}>+ Record Hb</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Parent/Guardian Information</Text>
          <Text style={styles.sectionSubtitle}>Verified contact information linked to this student</Text>

          {student?.parent_contact_unavailable ? (
            <View style={styles.contactEmptyBox}>
              <Text style={styles.emptyText}>Parent/guardian contact was marked unavailable when this student was registered.</Text>
            </View>
          ) : parentContacts.length === 0 ? (
            <View style={styles.contactEmptyBox}>
              <Text style={styles.emptyText}>No verified parent/guardian contact is linked to this student.</Text>
            </View>
          ) : (
            <View style={styles.contactList}>
              {parentContacts.map((contact, index) => (
                <View key={`${contact.phone_number || 'contact'}-${index}`} style={styles.contactCard}>
                  <Text style={styles.contactTitle}>Parent/Guardian {index + 1}</Text>
                  <Text style={styles.contactValue}>
                    Phone: {contact.phone_number || 'Phone number unavailable'}
                  </Text>
                  <Text style={styles.contactValue}>
                    Relationship: {contact.relationship || 'Not recorded'}
                  </Text>
                  <Text style={styles.contactNote}>Parent name is not stored in the available record.</Text>
                </View>
              ))}
            </View>
          )}
        </View>

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
                  <Text style={styles.recordSub}>Recorded result</Text>
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
                Iron/folic acid courses prescribed and scheduled. Parents report doses; teachers review the status here.
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
                            <Text style={[styles.doseStatus, doseLabel(dose) === 'Overdue' && styles.doseOverdue]}>{doseLabel(dose)}</Text>
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
    backgroundColor: AUTH.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: AUTH.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: AUTH.muted,
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: AUTH.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
  },
  backBtnText: {
    color: AUTH.muted,
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
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: AUTH.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdca',
  },
  retryText: {
    color: '#b42318',
    fontWeight: '700',
  },
  studentCard: {
    backgroundColor: AUTH.surface,
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
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ead8df',
  },
  quickActionCopy: {
    flex: 1,
  },
  quickActionTitle: {
    color: '#59253e',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionText: {
    color: AUTH.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  recordHbQuickButton: {
    backgroundColor: '#743b55',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  recordHbQuickButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  studentInfoLeft: {
    flex: 1,
    minWidth: 200,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '700',
    color: AUTH.primary,
  },
  studentClass: {
    fontSize: 14,
    color: AUTH.muted,
    marginTop: 4,
    fontWeight: '500',
  },
  studentSub: {
    fontSize: 13,
    color: AUTH.muted,
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
    backgroundColor: AUTH.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
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
    color: AUTH.primary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: AUTH.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  contactList: {
    gap: 8,
  },
  contactCard: {
    backgroundColor: AUTH.surfaceLow,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    borderRadius: 8,
    padding: 12,
    gap: 3,
  },
  contactTitle: {
    color: AUTH.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  contactValue: {
    color: AUTH.muted,
    fontSize: 14,
  },
  contactNote: {
    color: AUTH.muted,
    fontSize: 12,
    marginTop: 3,
  },
  contactEmptyBox: {
    backgroundColor: AUTH.surfaceLow,
    borderRadius: 8,
    padding: 12,
  },
  formContainer: {
    backgroundColor: AUTH.surfaceLow,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AUTH.primary,
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
    color: AUTH.muted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
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
    backgroundColor: AUTH.primary,
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
    backgroundColor: AUTH.secondaryFixed,
    borderRadius: 6,
  },
  toggleCourseBtnText: {
    color: AUTH.primary,
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
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: AUTH.primary,
    borderColor: AUTH.primary,
  },
  chipText: {
    fontSize: 13,
    color: AUTH.muted,
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
    backgroundColor: AUTH.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f2f4f7',
  },
  recordMain: {
    fontSize: 16,
    fontWeight: '700',
    color: AUTH.primary,
  },
  recordSub: {
    fontSize: 12,
    color: AUTH.muted,
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
    backgroundColor: AUTH.surface,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AUTH.outlineVariant,
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
    color: AUTH.primary,
  },
  courseDoseCount: {
    fontSize: 13,
    color: AUTH.muted,
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
  doseOverdue: {
    color: '#b42318',
    fontWeight: '700',
  },
  doseTaken: {
    backgroundColor: '#ecfdf3',
    borderColor: '#a6f4c5',
  },
  doseScheduled: {
    backgroundColor: AUTH.surfaceHigh,
    borderColor: AUTH.outlineVariant,
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
    color: AUTH.muted,
    fontSize: 13,
  },
});
