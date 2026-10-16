const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function registerSchool(input: {
  school_name: string;
  email: string;
  password: string;
}) {
  const response = await fetch(`${API_URL}/schools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? 'Unable to create your account');
  }

  return body as { message: string; token: string; school_id: number };
}

export async function loginSchool(email: string, password: string) {
  const response = await fetch(`${API_URL}/schools/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'Invalid email or password');
  return body as { token: string; school_id: number };
}

export async function getSchoolSummary(token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const [teachers, classrooms] = await Promise.all([
    fetch(`${API_URL}/teachers`, { headers }).then((r) => r.json()),
    fetch(`${API_URL}/classrooms`, { headers }).then((r) => r.json()),
  ]);
  return { teachers: teachers.teachers ?? [], classrooms: classrooms.classrooms ?? [] };
}
