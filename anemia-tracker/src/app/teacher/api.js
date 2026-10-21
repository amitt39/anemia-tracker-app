import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.30.216.30:3000';

export function classroomLabel(classroom) {
  if (!classroom) return 'Unassigned';
  if (classroom.grade_name && classroom.section_name) {
    return `${classroom.grade_name} - Section ${classroom.section_name}`;
  }
  return classroom.class_name || 'Classroom';
}

async function request(path, options = {}, isProtected = false) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error(
          isProtected
            ? 'Your session has expired. Please sign in again.'
            : (body.message || 'Invalid email or password.')
        );
        error.code = isProtected ? 'SESSION_EXPIRED' : 'INVALID_CREDENTIALS';
        throw error;
      }
      throw new Error(body.message || 'Something went wrong. Please try again.');
    }
    return body;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to connect to the server. Check that the API is running.');
    }
    throw error;
  }
}

export async function saveTeacherSession(authData) {
  await AsyncStorage.setItem('teacher_token', authData.token);
  if (authData.teacher_id) await AsyncStorage.setItem('teacher_id', String(authData.teacher_id));
  if (authData.school_id) await AsyncStorage.setItem('teacher_school_id', String(authData.school_id));
  if (authData.teacher) {
    await AsyncStorage.setItem('teacher_name', `${authData.teacher.first_name || ''} ${authData.teacher.last_name || ''}`.trim());
    await AsyncStorage.setItem('teacher_email', authData.teacher.email || '');
    if (authData.teacher.school_name) {
      await AsyncStorage.setItem('teacher_school_name', authData.teacher.school_name);
    }
  }
}

export async function getTeacherSession() {
  const token = await AsyncStorage.getItem('teacher_token');
  const teacherId = await AsyncStorage.getItem('teacher_id');
  const schoolId = await AsyncStorage.getItem('teacher_school_id');
  const teacherName = await AsyncStorage.getItem('teacher_name');
  const teacherEmail = await AsyncStorage.getItem('teacher_email');
  const schoolName = await AsyncStorage.getItem('teacher_school_name');
  return { token, teacherId, schoolId, teacherName, teacherEmail, schoolName };
}

export async function clearTeacherSession() {
  await AsyncStorage.removeItem('teacher_token');
  await AsyncStorage.removeItem('teacher_id');
  await AsyncStorage.removeItem('teacher_school_id');
  await AsyncStorage.removeItem('teacher_name');
  await AsyncStorage.removeItem('teacher_email');
  await AsyncStorage.removeItem('teacher_school_name');
}

export function loginTeacher(credentials) {
  return request('/teachers/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function getTeacherProfile(token) {
  return request('/teachers/me', {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherClassrooms(token) {
  return request('/teacher/classrooms', {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherClassroom(token, classroomId) {
  return request(`/teacher/classrooms/${classroomId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherClassroomStudents(token, classroomId) {
  return request(`/teacher/classrooms/${classroomId}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherStudents(token) {
  return request('/teacher/students', {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherStudent(token, studentId) {
  return request(`/teacher/students/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function getTeacherStudentHbTests(token, studentId) {
  return request(`/teacher/students/${studentId}/hb-tests`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function createTeacherHbTest(token, studentId, data) {
  return request(`/students/${studentId}/hb-tests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }, true);
}

export function getTeacherStudentTabletCourses(token, studentId) {
  return request(`/teacher/students/${studentId}/tablet-courses`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function createTeacherTabletCourse(token, studentId, data) {
  return request(`/students/${studentId}/tablet-courses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }, true);
}

export function getTeacherStudentTabletDoses(token, studentId) {
  return request(`/teacher/students/${studentId}/tablet-doses`, {
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}

export function createTeacherTabletDoses(token, courseId, data) {
  return request(`/tablet-courses/${courseId}/tablet-doses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }, true);
}

export function markTeacherTabletDoseTaken(token, doseId) {
  return request(`/teacher/tablet-doses/${doseId}/take`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, true);
}
