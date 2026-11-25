# Student Course and Academic Management System

React (Vite) frontend + Flask REST API + MySQL. Role-based dashboards for Admin, Faculty and Students.

```
student-academic-management/
├── database/   schema.sql, sample_data.sql, queries.sql
├── backend/    Flask API (app.py, auth.py, database.py, errors.py, config/, models/, routes/)
├── frontend/   React app (src/pages, components, layouts, services, context, hooks, utils)
├── ARCHITECTURE.md   architecture, ER diagram description, normalization
└── README.md
```

## Requirements
- Python 3.10+
- Node.js 18+ (only to build/run the React dev tools; the app itself is React, not a Node backend)
- MySQL 8.0.16+ and MySQL Workbench

## 1. Database (MySQL Workbench)
1. Connect to your local MySQL server.
2. File → Open SQL Script → `database/schema.sql` → run all (lightning icon).
3. Open and run `database/sample_data.sql`.

## 2. Backend
```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate        macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `backend/.env` and set `DB_PASSWORD` (your MySQL root password) and a long random `SECRET_KEY`. Then:
```bash
python app.py
```
Check http://localhost:5000/api/health, which should return `{"status":"ok",...}`.

## 3. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. In development Vite forwards `/api` requests to Flask on port 5000.

## Sample logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@college.edu | Admin@123 |
| Faculty | rajesh.kumar@college.edu | Faculty@123 |
| Faculty | meena.iyer@college.edu | Faculty@123 |
| Student | aarav.sharma@college.edu | Student@123 |
| Student | priya.verma@college.edu | Student@123 |

(Students can also self-register on the login page. Faculty accounts are created by the admin.)

## End-to-end demo script
1. Admin: add a student (Students page) → check it in Workbench: `SELECT * FROM students;`
2. Admin: Courses → assign faculty to "CS399 Elective: Machine Learning".
3. Student (Rohan, `rohan.mehta@college.edu`): Enrollments → enroll in a current-semester course.
4. Faculty (Meena): Attendance → pick CS301 → mark and save → Workbench: `SELECT * FROM vw_attendance_report;`
5. Faculty: Exams and Marks → open CS301 "Internal Test 1" → Marks → enter and save. Grades recalculate through the stored procedure.
6. Student: Marks and Grades / Dashboard now show the new marks, grade and CGPA.
7. Try forbidden actions: a faculty member only sees their own courses, and a student gets 403 on admin endpoints.

## API overview (all JSON, `Authorization: Bearer <token>`)
| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `/register`, `GET /auth/me`, `POST /auth/change-password` |
| Students (admin) | `GET/POST /api/students`, `GET/PUT/DELETE /api/students/<id>`, `GET/PUT /api/students/me` |
| Faculty (admin) | `GET/POST /api/faculty`, `GET/PUT/DELETE /api/faculty/<id>`, `GET /api/faculty/me` |
| Departments / semesters | `/api/departments`, `/api/semesters` (CRUD, admin) |
| Courses | `GET /api/courses`, `POST/PUT/DELETE`, `PUT /api/courses/<id>/faculty`, `GET /api/courses/<id>/students` |
| Enrollments | `GET/POST /api/enrollments`, `POST /<id>/drop`, `PUT/DELETE /<id>` |
| Attendance | `GET/POST /api/attendance/course/<id>`, `GET /api/attendance/report`, `GET /api/attendance/me` |
| Exams / marks | `/api/exams`, `GET/POST /api/exams/<id>/marks`, `GET /api/marks/me` |
| Reports | `/api/dashboard/stats`, `/api/reports/performance`, `/cgpa`, `/course/<id>`, `/history` |

Status codes: 200/201 success, 400 validation, 401 not logged in, 403 not allowed, 404 not found, 409 duplicate or in use, 503 database unreachable.

## Security notes
- Passwords are hashed with PBKDF2-SHA256 (Werkzeug); plain text is never stored.
- The user's role is re-read from the database on every request, not trusted from the token.
- Students and faculty are scoped by the logged-in user's id. A student cannot pass another student's id to see their data, and faculty can only touch courses assigned to them.
- All SQL uses parameter placeholders (no string-built queries from user input).
- Secrets and DB credentials come from `backend/.env`, which you should never commit.

## Troubleshooting
- **"Database connection failed"**: check `DB_PASSWORD` in `.env` and that MySQL is running.
- **Login says invalid password**: re-run `sample_data.sql` on a fresh `schema.sql`.
- **CORS errors**: use http://localhost:5173 (with the dev server) or add your origin to `CORS_ORIGINS`.
- **`cryptography` install problems**: `pip install --upgrade pip` first.
- **MySQL older than 8.0.16**: CHECK constraints are parsed but not enforced; upgrade MySQL.

## Viva material
`database/queries.sql` holds JOIN, aggregate, subquery and view queries; `ARCHITECTURE.md` explains the ER diagram, cascade rules and 3NF.
