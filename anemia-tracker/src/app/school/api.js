import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.30.216.30:3000';

export function validateIndianMobileNumber(input) {
  if (typeof input !== 'string' || input.trim() === '') return { valid: false, reason: 'required', normalized: '' };
  const value = input.trim();
  if (!/^[0-9+().\-\s]+$/.test(value) || /[+]/.test(value.slice(1)) || /^[.\-]|[.\-]$/.test(value) || /[+][().\-]|[().\-]\s*[+]/.test(value) || /[().\-]{2,}/.test(value)) return { valid: false, reason: 'format', normalized: '' };
  const compact = value.replace(/[\s().-]/g, '');
  let national = compact;
  if (compact.startsWith('+91')) national = compact.slice(3);
  else if (compact.startsWith('+')) return { valid: false, reason: 'country_code', normalized: '' };
  else if (compact.length === 12 && compact.startsWith('91')) return { valid: false, reason: 'country_code', normalized: '' };
  if (national.length !== 10) return { valid: false, reason: 'incomplete', normalized: '' };
  if (!/^\d+$/.test(national)) return { valid: false, reason: 'format', normalized: '' };
  if (!/^[6-9]/.test(national)) return { valid: false, reason: 'prefix', normalized: '' };
  return { valid: true, reason: '', normalized: `+91${national}` };
}

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
export function getSchoolParents(token) { return request('/school/parents', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function inviteSchoolParent(token, phoneNumber) { return request('/school/parents/invitations', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone_number: phoneNumber }) }, true); }
export function revokeSchoolParent(token, parentId) { return request(`/school/parents/${parentId}/revoke`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({}) }, true); }
export function requestParentOtp(phoneNumber) { return request('/parents/login/request-otp', { method: 'POST', body: JSON.stringify({ phone_number: phoneNumber }) }); }
export function verifyParentOtp(phoneNumber, otp) { return request('/parents/login/verify-otp', { method: 'POST', body: JSON.stringify({ phone_number: phoneNumber, otp }) }); }
export function getParentInvitations(token) { return request('/parents/me/school-invitations', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function updateParentInvitation(token, schoolId, status) { return request(`/parents/me/school-invitations/${schoolId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }, true); }
export function getPendingParentStudentLinks(token) { return request('/parents/me/pending-student-links', { headers: { Authorization: `Bearer ${token}` } }, true); }
export function acceptParentStudentLink(token, studentId, accepted) { return request(`/parents/me/students/${studentId}/accept`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ accepted }) }, true); }
export function createTeacher(token, data) { return request('/teachers', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateTeacher(token, teacherId, data) { return request(`/teachers/${teacherId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateTeacherStatus(token, teacherId, isActive) { return request(`/teachers/${teacherId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_active: isActive }) }, true); }
export function createClassroom(token, data) { return request('/classrooms', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function updateClassroom(token, classroomId, data) { return request(`/classrooms/${classroomId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
export function deleteClassroom(token, classroomId) { return request(`/classrooms/${classroomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, true); }
export function createStudent(token, data) { return request('/students', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }, true); }
