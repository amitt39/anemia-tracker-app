import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  getMyParentStudents,
  getMyParentHbTests,
  getMyParentTabletCourses,
} from '../school/api';

async function clearParentSession() {
  await AsyncStorage.removeItem('parent_token');
  await AsyncStorage.removeItem('parent_id');
  await AsyncStorage.removeItem('parent_phone');
}

export default function ParentDashboard() {
  const [token, setToken] = useState('');
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hbTests, setHbTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function init() {
      const savedToken = await AsyncStorage.getItem('parent_token');

      if (!savedToken) {
        router.replace('/parent/login');
        return;
      }

      setToken(savedToken);

      try {
        const result = await getMyParentStudents(savedToken);
        setStudents(result.students || []);
      } catch (error) {
        if (error.code === 'SESSION_EXPIRED') {
          await clearParentSession();
          router.replace('/parent/login');
        } else {
          setMessage(error.message || 'Unable to load linked children.');
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  async function openStudent(student) {
    setSelected(student);
    setDetailLoading(true);
    setMessage('');
    setHbTests([]);
    setCourses([]);

    try {
      const [hb, tablet] = await Promise.all([
        getMyParentHbTests(token, student.student_id),
        getMyParentTabletCourses(token, student.student_id),
      ]);

      setHbTests(hb.hb_tests || []);
      setCourses(tablet.tablet_courses || []);
    } catch (error) {
      setMessage(error.message || 'Unable to load student records.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function logout() {
    await clearParentSession();
    router.replace('/parent/login');
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.title}>Parent dashboard</Text>
          <Pressable onPress={logout}>
            <Text style={s.logout}>Logout</Text>
          </Pressable>
        </View>

        {message ? <Text style={s.message}>{message}</Text> : null}

        <Text style={s.heading}>My children</Text>

        {students.length === 0 ? (
          <Text style={s.muted}>
            No verified children are linked to your account yet. Please contact your school.
          </Text>
        ) : (
          students.map((student) => (
            <Pressable
              key={student.student_id}
              style={[
                s.card,
                selected?.student_id === student.student_id && s.selectedCard,
              ]}
              onPress={() => openStudent(student)}
            >
              <Text style={s.name}>
                {student.first_name} {student.last_name}
              </Text>
              <Text style={s.muted}>
                {student.school_name} · {student.class_name}
              </Text>
              <Text style={s.action}>View health records</Text>
            </Pressable>
          ))
        )}

        {selected ? (
          <>
            <Text style={s.heading}>
              {selected.first_name}'s health records
            </Text>

            {detailLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <>
                <Text style={s.subheading}>Hb test history</Text>
                {hbTests.length === 0 ? (
                  <Text style={s.muted}>No Hb tests recorded.</Text>
                ) : (
                  hbTests.map((test) => (
                    <View key={test.test_id} style={s.record}>
                      <Text style={s.name}>
                        Hb: {test.hb_level}
                      </Text>
                      <Text style={s.muted}>
                        Date: {String(test.test_date).slice(0, 10)}
                      </Text>
                    </View>
                  ))
                )}

                <Text style={s.subheading}>Tablet courses</Text>
                {courses.length === 0 ? (
                  <Text style={s.muted}>No tablet courses recorded.</Text>
                ) : (
                  courses.map((course) => (
                    <View key={course.course_id} style={s.record}>
                      <Text style={s.name}>Course #{course.course_id}</Text>
                      <Text style={s.muted}>
                        Start: {String(course.start_date).slice(0, 10)}
                      </Text>
                      <Text style={s.muted}>
                        End: {course.end_date
                          ? String(course.end_date).slice(0, 10)
                          : 'Not specified'}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { maxWidth: 850, width: '100%', alignSelf: 'center', padding: 24, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 21, fontWeight: '700', marginTop: 14 },
  subheading: { fontSize: 17, fontWeight: '700', marginTop: 10 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, gap: 6 },
  selectedCard: { borderWidth: 1, borderColor: '#1769aa' },
  record: { backgroundColor: '#fff', borderRadius: 8, padding: 14, gap: 5 },
  name: { fontSize: 17, fontWeight: '700' },
  muted: { color: '#667085' },
  action: { color: '#1769aa', fontWeight: '700', marginTop: 4 },
  logout: { color: '#b42318', fontWeight: '700' },
  message: { color: '#b42318' },
});
