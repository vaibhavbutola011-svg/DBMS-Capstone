# Student Course and Academic Management System: Architecture and ER Design

## 1. Architecture

```
 React (Vite) SPA          Flask REST API (Python)            MySQL 8
 ┌───────────────┐  JSON   ┌───────────────────────┐   SQL   ┌────────────────┐
 │ Pages/Layouts │ ──────► │ routes/  (Blueprints) │ ──────► │ student_       │
 │ Components    │  JWT    │ auth, students, ...   │ PyMySQL │ academic_db    │
 │ Context(Auth) │ ◄────── │ database.py, config/  │ ◄────── │ 11 tables      │
 │ services/api  │         │ role-based decorators │         │ views, trigger │
 └───────────────┘         └───────────────────────┘         └────────────────┘
```

- **Frontend**: React with HTML5/CSS3/JavaScript. React Router for the 12 pages, an AuthContext holding the JWT and role, and an Axios service layer that attaches the token to every request.
- **Backend**: Flask with one Blueprint per module (auth, students, faculty, courses, enrollments, attendance, exams/marks, reports). A `@role_required` decorator enforces Admin/Faculty/Student access. Passwords are hashed with Werkzeug (PBKDF2-SHA256). Credentials come from `.env`.
- **Database**: MySQL 8 managed in MySQL Workbench. Business rules live in the schema (constraints, triggers, views, one stored procedure) so they hold no matter which client writes the data.
- **Access control**: every query for a student or faculty member is scoped by the `user_id` in the token (see section F of `queries.sql`). The client never sends a student id for its own data.

## 2. ER Diagram Description

### Entities, attributes and keys (PK = primary key, FK = foreign key, UQ = unique)

| Entity | Attributes |
|---|---|
| **departments** | **department_id (PK)**, dept_code (UQ), dept_name (UQ), created_at |
| **users** | **user_id (PK)**, email (UQ), password_hash, role (admin/faculty/student), is_active, created_at |
| **semesters** | **semester_id (PK)**, semester_number (1-8), academic_year, start_date, end_date, is_current; UQ(semester_number, academic_year) |
| **students** | **student_id (PK)**, user_id (FK→users, UQ), roll_number (UQ), first_name, last_name, date_of_birth, gender, phone, address, department_id (FK→departments), current_semester, admission_year, status |
| **faculty** | **faculty_id (PK)**, user_id (FK→users, UQ), employee_code (UQ), first_name, last_name, phone, designation, department_id (FK→departments), joining_date |
| **courses** | **course_id (PK)**, course_code, course_name, credits (1-6), department_id (FK), semester_id (FK), faculty_id (FK, nullable), max_seats; UQ(course_code, semester_id) |
| **enrollments** | **enrollment_id (PK)**, student_id (FK), course_id (FK), enrolled_on, status; UQ(student_id, course_id) |
| **attendance** | **attendance_id (PK)**, enrollment_id (FK), attendance_date, status, marked_by (FK→faculty); UQ(enrollment_id, attendance_date) |
| **examinations** | **exam_id (PK)**, course_id (FK), exam_name, exam_type, exam_date, max_marks; UQ(course_id, exam_name) |
| **marks** | **mark_id (PK)**, exam_id (FK), enrollment_id (FK), marks_obtained; UQ(exam_id, enrollment_id) |
| **grades** | **grade_id (PK)**, enrollment_id (FK, UQ), total_percentage, letter_grade, grade_points, computed_at |

### Relationships and cardinalities

| Relationship | Cardinality | Implemented by |
|---|---|---|
| users — students | 1 : 0..1 (one-to-one) | `students.user_id` UNIQUE |
| users — faculty | 1 : 0..1 (one-to-one) | `faculty.user_id` UNIQUE |
| departments — students | 1 : N | `students.department_id` |
| departments — faculty | 1 : N | `faculty.department_id` |
| departments — courses | 1 : N | `courses.department_id` |
| semesters — courses | 1 : N | `courses.semester_id` |
| faculty — courses | 1 : N (a course has at most one faculty) | `courses.faculty_id` |
| **students — courses** | **M : N** | resolved by the `enrollments` junction table |
| enrollments — attendance | 1 : N | `attendance.enrollment_id` |
| courses — examinations | 1 : N | `examinations.course_id` |
| examinations — marks | 1 : N | `marks.exam_id` |
| enrollments — marks | 1 : N | `marks.enrollment_id` |
| **examinations — enrollments** | **M : N** | resolved by the `marks` table |
| enrollments — grades | 1 : 0..1 (one-to-one) | `grades.enrollment_id` UNIQUE |
| faculty — attendance | 1 : N (who marked it) | `attendance.marked_by` |

### Text ER diagram

```
departments 1───N students N───1 users 1───N faculty... (1:1 each, via UNIQUE user_id)
departments 1───N faculty  1───N courses N───1 semesters
departments 1───N courses

students 1───N enrollments N───1 courses          (students M:N courses)
enrollments 1───N attendance N───0..1 faculty
courses 1───N examinations 1───N marks N───1 enrollments
enrollments 1───0..1 grades
```

## 3. Cascading rules

| FK | ON DELETE | Reason |
|---|---|---|
| students/faculty → users | CASCADE | removing the login removes the profile |
| enrollments → students/courses | CASCADE | an enrollment means nothing without either side |
| attendance, marks, grades → enrollments | CASCADE | dependent records go with the enrollment |
| examinations → courses, marks → examinations | CASCADE | same reason |
| students/faculty/courses → departments | RESTRICT | cannot delete a department that still has people or courses |
| courses → semesters | RESTRICT | protects academic history |
| courses.faculty_id → faculty | SET NULL | course survives, becomes "unassigned" |
| attendance.marked_by → faculty | SET NULL | keep attendance if the marker leaves |

## 4. Normalization (up to 3NF)

- **1NF**: every column holds one atomic value, and every table has a primary key.
- **2NF**: no partial dependencies. Junction tables (`enrollments`, `marks`) use surrogate keys, and every non-key column depends on the whole row. For example, `marks_obtained` depends on (exam, enrollment) together.
- **3NF**: no transitive dependencies. Department names live only in `departments`, faculty names only in `faculty`, and course details only in `courses`. Attendance percentage, CGPA and SGPA are **not stored**; they are derived in views, so they cannot go stale.
- **Deliberate exception**: `grades` stores `total_percentage` and the letter grade, which are derivable from `marks`. The assignment requires a Grades table, and it acts as a published result. It is only written through `sp_compute_grades`, so it stays consistent with `marks`.

## 5. Constraints and indexes used

- **UNIQUE**: emails, roll numbers, employee codes, one enrollment per student-course, one attendance row per enrollment-day, one mark per exam-enrollment.
- **CHECK**: semester 1-8, credits 1-6, max_seats > 0, max_marks > 0, marks >= 0, end_date > start_date, percentage 0-100, grade points 0-10, phone format.
- **DEFAULT**: statuses, `credits = 3`, `max_seats = 60`, `current_semester = 1`, timestamps.
- **NOT NULL**: on every mandatory column.
- **Triggers**: marks cannot exceed the exam's max marks (a CHECK cannot look at another table), and a course cannot be over-enrolled.
- **Indexes**: names (students, faculty, courses), department/faculty/semester foreign keys, `enrollments.course_id`, `attendance.attendance_date`, `examinations.exam_date`, `marks.enrollment_id`. The unique keys create their own indexes.

## 6. Sample logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@college.edu | Admin@123 |
| Faculty | rajesh.kumar@college.edu (also meena.iyer@, suresh.nair@) | Faculty@123 |
| Student | aarav.sharma@college.edu (also priya.verma@, rohan.mehta@, ananya.iyer@, karan.singh@, sneha.reddy@) | Student@123 |

## 7. Running the database part (Workbench)

1. Open MySQL Workbench and connect to your local server.
2. File → Open SQL Script → `database/schema.sql` → run it (lightning icon).
3. Open and run `database/sample_data.sql`.
4. Open `database/queries.sql` and run individual queries (select one, then Ctrl+Enter) for the viva.
5. Reverse-engineer the ER diagram in Workbench: Database → Reverse Engineer → `student_academic_db`.
