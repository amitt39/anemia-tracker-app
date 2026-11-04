# Anemia Tracker frontend

Expo Router frontend for the Anemia Tracker school-health workspace. The app supports web, Android, and iOS from the same `src/app` route tree.

## Run locally

```bash
npm install
cp .env.example .env
npm run web
```

For a native device or emulator, set `EXPO_PUBLIC_API_URL` in `.env` to an API address reachable from that device. `localhost` usually refers to the device itself, not the computer running the API.

```bash
npx expo start
```

## Checks

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform web
```

## Workspaces

### Public and authentication

- `/` — session-aware welcome screen
- `/role-selection` — choose School Admin, Teacher, or Parent
- `/school/login`, `/school/register`, `/school/forgot-password`, `/school/reset-password`
- `/teacher/login`
- `/parent/login`

### School Admin

- `/school/dashboard`
- `/school/students` and `/school/students/:student_id`
- `/school/teachers` and `/school/teachers/:teacher_id`
- `/school/classrooms` and `/school/classrooms/:classroom_id`
- `/school/parents`
- `/school/tablets`
- `/school/reports`
- `/school/profile`

School Admins manage people, classrooms, parent links, tablet follow-up, and reports. Hb history is read-only for them; Hb results are recorded by the teacher assigned to the student’s classroom.

### Teacher

- `/teacher/dashboard`
- `/teacher/classrooms` and `/teacher/classrooms/:classroom_id`
- `/teacher/students` and `/teacher/students/:student_id`
- `/teacher/hb-tests`
- `/teacher/tablet-doses`

Teachers can only access assigned classrooms and students. Hb results and tablet actions are recorded from the teacher workspace.

### Parent

- `/parent/dashboard`

Parents can accept school invitations, confirm child links, view verified Hb and tablet records, and mark an authorized scheduled dose as taken.

The legacy `/login`, `/dashboard`, `/register`, and `/explore` paths remain safe redirects for older bookmarks.
