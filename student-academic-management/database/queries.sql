-- =====================================================================
-- queries.sql  -  Demo queries for DBMS practical / viva
-- Run schema.sql and sample_data.sql first.
-- =====================================================================
USE student_academic_db;

-- =====================================================================
-- A. BASIC CRUD (what the Flask API executes)
-- =====================================================================

-- A1. Add a student (user row first, then the student profile)
INSERT INTO users (email, password_hash, role)
VALUES ('new.student@college.edu', 'hash-goes-here', 'student');
INSERT INTO students (user_id, roll_number, first_name, last_name, date_of_birth,
                      gender, phone, department_id, current_semester, admission_year)
VALUES (LAST_INSERT_ID(), '21CSE099', 'Neha', 'Gupta', '2004-04-04',
        'Female', '9876500099', 1, 5, 2023);

-- A2. Update a student
UPDATE students SET phone = '9000000000', current_semester = 6
WHERE roll_number = '21CSE099';

-- A3. Delete a student (ON DELETE CASCADE removes enrollments, attendance, marks, grades;
--     deleting the user cascades to the student row)
DELETE FROM users WHERE email = 'new.student@college.edu';

-- A4. Assign a faculty member to a course
UPDATE courses SET faculty_id = 1
WHERE course_code = 'CS399' AND semester_id = 3;

-- A5. Enroll a student in a course
INSERT INTO enrollments (student_id, course_id) VALUES (4, 6);
-- (a duplicate enrollment fails on uq_enrollment; a full course fails on the seat trigger)
DELETE FROM enrollments WHERE student_id = 4 AND course_id = 6 AND status = 'enrolled';

-- A6. Faculty marks attendance (insert or update the same day)
INSERT INTO attendance (enrollment_id, attendance_date, status, marked_by)
VALUES (17, '2026-10-26', 'present', 2)
ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by);

-- A7. Faculty enters / updates marks, then grades are recalculated
INSERT INTO marks (exam_id, enrollment_id, marks_obtained)
VALUES (9, 17, 26.5)
ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained);
CALL sp_compute_grades(5);

-- A8. Trigger demo: this fails with "marks_obtained cannot exceed the exam max_marks"
-- INSERT INTO marks (exam_id, enrollment_id, marks_obtained) VALUES (9, 18, 99);

-- =====================================================================
-- B. JOIN QUERIES
-- =====================================================================

-- B1. Students with their department (INNER JOIN)
SELECT s.roll_number, CONCAT(s.first_name,' ',s.last_name) AS student, d.dept_name
FROM students s
JOIN departments d ON d.department_id = s.department_id
ORDER BY s.roll_number;

-- B2. Courses with department, semester and faculty (LEFT JOIN keeps unassigned courses)
SELECT c.course_code, c.course_name, d.dept_code,
       sem.semester_number, sem.academic_year,
       COALESCE(CONCAT(f.first_name,' ',f.last_name), 'Not assigned') AS faculty
FROM courses c
JOIN departments d  ON d.department_id = c.department_id
JOIN semesters sem  ON sem.semester_id = c.semester_id
LEFT JOIN faculty f ON f.faculty_id = c.faculty_id
ORDER BY sem.semester_number, c.course_code;

-- B3. Courses a student is enrolled in (4-table join)
SELECT s.roll_number, c.course_code, c.course_name, c.credits,
       CONCAT(f.first_name,' ',f.last_name) AS faculty, en.status
FROM enrollments en
JOIN students s ON s.student_id = en.student_id
JOIN courses  c ON c.course_id  = en.course_id
LEFT JOIN faculty f ON f.faculty_id = c.faculty_id
WHERE s.roll_number = '21CSE001'
ORDER BY c.semester_id, c.course_code;

-- B4. Marks sheet: student, course, exam, marks (6-table join)
SELECT s.roll_number, CONCAT(s.first_name,' ',s.last_name) AS student,
       c.course_code, ex.exam_name, m.marks_obtained, ex.max_marks
FROM marks m
JOIN examinations ex ON ex.exam_id = m.exam_id
JOIN enrollments en  ON en.enrollment_id = m.enrollment_id
JOIN students s      ON s.student_id = en.student_id
JOIN courses c       ON c.course_id = en.course_id
ORDER BY c.course_code, s.roll_number, ex.exam_date;

-- B5. Students with NO enrollment in the current semester (LEFT JOIN + IS NULL)
SELECT s.roll_number, s.first_name, s.last_name
FROM students s
LEFT JOIN (
    SELECT en.student_id
    FROM enrollments en
    JOIN courses c ON c.course_id = en.course_id
    JOIN semesters sem ON sem.semester_id = c.semester_id
    WHERE sem.is_current = TRUE
) cur ON cur.student_id = s.student_id
WHERE cur.student_id IS NULL;

-- =====================================================================
-- C. AGGREGATE QUERIES (COUNT, SUM, AVG, GROUP BY, HAVING)
-- =====================================================================

-- C1. Dashboard statistics
SELECT (SELECT COUNT(*) FROM students) AS total_students,
       (SELECT COUNT(*) FROM faculty)  AS total_faculty,
       (SELECT COUNT(*) FROM courses)  AS total_courses,
       (SELECT COUNT(*) FROM enrollments WHERE status = 'enrolled') AS active_enrollments;

-- C2. Students per department
SELECT d.dept_name, COUNT(s.student_id) AS students
FROM departments d
LEFT JOIN students s ON s.department_id = d.department_id
GROUP BY d.department_id, d.dept_name;

-- C3. Enrollment count and seats left per course
SELECT c.course_code, c.course_name,
       COUNT(en.enrollment_id) AS enrolled,
       c.max_seats - COUNT(en.enrollment_id) AS seats_left
FROM courses c
LEFT JOIN enrollments en ON en.course_id = c.course_id AND en.status <> 'dropped'
GROUP BY c.course_id, c.course_code, c.course_name, c.max_seats;

-- C4. Average marks percentage per course
SELECT c.course_code, c.course_name,
       ROUND(AVG(m.marks_obtained / ex.max_marks * 100), 2) AS avg_percentage
FROM marks m
JOIN examinations ex ON ex.exam_id = m.exam_id
JOIN enrollments en  ON en.enrollment_id = m.enrollment_id
JOIN courses c       ON c.course_id = en.course_id
GROUP BY c.course_id, c.course_code, c.course_name
ORDER BY avg_percentage DESC;

-- C5. Total credits per student for completed courses (SUM)
SELECT s.roll_number, SUM(c.credits) AS credits_completed
FROM enrollments en
JOIN students s ON s.student_id = en.student_id
JOIN courses c  ON c.course_id = en.course_id
WHERE en.status = 'completed'
GROUP BY s.student_id, s.roll_number;

-- C6. Grade distribution
SELECT letter_grade, COUNT(*) AS students
FROM grades
GROUP BY letter_grade
ORDER BY MIN(grade_points) DESC;

-- C7. Faculty workload: courses and students taught (HAVING)
SELECT f.employee_code, CONCAT(f.first_name,' ',f.last_name) AS faculty,
       COUNT(DISTINCT c.course_id) AS courses,
       COUNT(en.enrollment_id)     AS students_taught
FROM faculty f
JOIN courses c ON c.faculty_id = f.faculty_id
LEFT JOIN enrollments en ON en.course_id = c.course_id AND en.status <> 'dropped'
GROUP BY f.faculty_id, f.employee_code, f.first_name, f.last_name
HAVING COUNT(DISTINCT c.course_id) >= 1;

-- =====================================================================
-- D. SUBQUERIES
-- =====================================================================

-- D1. Students whose CGPA is above the overall average CGPA (scalar subquery)
SELECT student_name, cgpa
FROM vw_student_cgpa
WHERE cgpa > (SELECT AVG(cgpa) FROM vw_student_cgpa);

-- D2. Students with attendance below 75% in at least one course (IN subquery)
SELECT roll_number, CONCAT(first_name,' ',last_name) AS student
FROM students
WHERE student_id IN (
    SELECT student_id FROM vw_attendance_report WHERE attendance_percentage < 75
);

-- D3. Courses that have no marks entered yet (NOT EXISTS)
SELECT c.course_code, c.course_name
FROM courses c
WHERE NOT EXISTS (
    SELECT 1
    FROM enrollments en
    JOIN marks m ON m.enrollment_id = en.enrollment_id
    WHERE en.course_id = c.course_id
);

-- D4. Topper of each graded course (correlated subquery)
SELECT c.course_code, s.roll_number, g.total_percentage
FROM grades g
JOIN enrollments en ON en.enrollment_id = g.enrollment_id
JOIN students s     ON s.student_id = en.student_id
JOIN courses c      ON c.course_id = en.course_id
WHERE g.total_percentage = (
    SELECT MAX(g2.total_percentage)
    FROM grades g2
    JOIN enrollments en2 ON en2.enrollment_id = g2.enrollment_id
    WHERE en2.course_id = en.course_id
);

-- D5. Students who failed (F) any course
SELECT roll_number, first_name, last_name
FROM students
WHERE student_id IN (
    SELECT en.student_id
    FROM grades g JOIN enrollments en ON en.enrollment_id = g.enrollment_id
    WHERE g.letter_grade = 'F'
);

-- =====================================================================
-- E. VIEWS
-- =====================================================================

-- E1. Attendance report, defaulters (< 75%)
SELECT * FROM vw_attendance_report
WHERE attendance_percentage < 75
ORDER BY attendance_percentage;

-- E2. Academic performance of one student, semester-wise
SELECT semester_number, academic_year, course_code, course_name,
       credits, total_percentage, letter_grade, grade_points
FROM vw_academic_performance
WHERE roll_number = '21CSE001'
ORDER BY semester_number, course_code;

-- E3. CGPA ranking
SELECT RANK() OVER (ORDER BY cgpa DESC) AS rank_no, roll_number, student_name, cgpa
FROM vw_student_cgpa;

-- E4. Semester GPA (SGPA) per student per semester
SELECT roll_number, student_name, semester_number,
       ROUND(SUM(grade_points * credits) / SUM(credits), 2) AS sgpa
FROM vw_academic_performance
WHERE grade_points IS NOT NULL
GROUP BY student_id, roll_number, student_name, semester_number
ORDER BY roll_number, semester_number;

-- =====================================================================
-- F. ROLE-SCOPED QUERIES (how the API enforces access control)
-- =====================================================================

-- F1. Student sees ONLY their own records (user_id comes from the login token)
SELECT p.course_code, p.course_name, p.total_percentage, p.letter_grade
FROM vw_academic_performance p
JOIN students s ON s.student_id = p.student_id
WHERE s.user_id = 5;

-- F2. Faculty sees ONLY students enrolled in their own courses (user_id from token)
SELECT c.course_code, s.roll_number, CONCAT(s.first_name,' ',s.last_name) AS student
FROM courses c
JOIN faculty f      ON f.faculty_id = c.faculty_id
JOIN enrollments en ON en.course_id = c.course_id AND en.status <> 'dropped'
JOIN students s     ON s.student_id = en.student_id
WHERE f.user_id = 2
ORDER BY c.course_code, s.roll_number;
