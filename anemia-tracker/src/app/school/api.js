import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.30.216.30:3000';

async function request(path, options = {}, isProtected = false) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error(
          isProtected
            ? 'Your session has expired. Please sign in again.'
            : 'Your email or password is incorrect.'
        );
        error.code = isProtected ? 'SESSION_EXPIRED' : 'INVALID_CREDENTIALS';
        throw error;
      }
      throw new Error(body.message || 'Something went wrong. Please try again.');
    }
    return body;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Unable to connect to the server. Check that the API is running.');
    throw error;
  }
}

export async function clearSchoolSession() {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('school_id');
}

export function registerSchool(data) { return request('/schools', { method: 'POST', body: JSON.stringify(data) }); }
export function loginSchool(data) { return request('/schools/login', { method: 'POST', body: JSON.stringify(data) }); }
export function getSchoolProfile(token) { return request('/schools/me', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getTeachers(token) { return request('/teachers', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getTeacher(token, teacherId) { return request(`/teachers/${teacherId}`, { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getClassrooms(token) { return request('/classrooms', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getClassroom(token, classroomId) { return request(`/classrooms/${classroomId}`, { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getClassroomStudents(token, classroomId) { return request(`/classrooms/${classroomId}/students`, { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getStudents(token) { return request('/students', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getStudent(token, studentId) { return request(`/students/${studentId}`, { headers: { Authorization: `Bearer ${token}` } }, true); }
export function updateStudent(token, studentId, data) { return request(`/students/${studentId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function createParent(token, phoneNumber) { return request('/parents', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone_number: phoneNumber }) }, true); }
export function getParents(token) { return request('/parents', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function getStudentParents(token, studentId) { return request(`/students/${studentId}/parents`, { headers: { Authorization: `Bearer ${token}` } }, true); }
export function linkStudentParent(token, studentId, parentId, relationship) { return request(`/students/${studentId}/parents`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ parent_id: parentId, relationship }) }, true); }
export function updateStudentParentStatus(token, studentId, parentId, status) { return request(`/students/${studentId}/parents/${parentId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }, true); }
export function createTeacher(token, data) { return request('/teachers', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateTeacher(token, teacherId, data) { return request(`/teachers/${teacherId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateTeacherStatus(token, teacherId, isActive) { return request(`/teachers/${teacherId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_active: isActive }) }, true); }
export function createClassroom(token, data) { return request('/classrooms', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateClassroom(token, classroomId, data) { return request(`/classrooms/${classroomId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function deleteClassroom(token, classroomId) { return request(`/classrooms/${classroomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, true); }
export function createStudent(token, data) { return request('/students', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
