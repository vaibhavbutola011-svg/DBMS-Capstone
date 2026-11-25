"""Dashboard statistics and academic reports. Everything is computed by MySQL queries/views."""
from flask import Blueprint, jsonify, request

from auth import (current_faculty_id, current_role, current_student_id, ensure_course_access,
                  login_required, role_required)
from database import query_all, query_one
from errors import ApiError

bp = Blueprint("reports", __name__, url_prefix="/api")


# ------------------------------------------------------------------ dashboard
@bp.get("/dashboard/stats")
@login_required
def dashboard_stats():
    role = current_role()
    if role == "admin":
        return jsonify(_admin_stats())
    if role == "faculty":
        return jsonify(_faculty_stats(current_faculty_id()))
    return jsonify(_student_stats(current_student_id()))


def _admin_stats():
    totals = query_one("""
        SELECT (SELECT COUNT(*) FROM students)    AS students,
               (SELECT COUNT(*) FROM faculty)     AS faculty,
               (SELECT COUNT(*) FROM courses)     AS courses,
               (SELECT COUNT(*) FROM departments) AS departments,
               (SELECT COUNT(*) FROM enrollments WHERE status = 'enrolled') AS enrollments""")
    avg_att = query_one("""SELECT ROUND(100 * SUM(status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1) AS v
                           FROM attendance""")
    low_att = query_one("""SELECT COUNT(DISTINCT student_id) AS v FROM vw_attendance_report
                           WHERE attendance_percentage < 75""")
    avg_cgpa = query_one("SELECT ROUND(AVG(cgpa), 2) AS v FROM vw_student_cgpa")
    by_dept = query_all("""
        SELECT d.dept_code AS label, COUNT(s.student_id) AS total
        FROM departments d LEFT JOIN students s ON s.department_id = d.department_id
        GROUP BY d.department_id, d.dept_code ORDER BY d.dept_code""")
    top_courses = query_all("""
        SELECT c.course_code AS label, COUNT(en.enrollment_id) AS total
        FROM courses c LEFT JOIN enrollments en ON en.course_id = c.course_id AND en.status <> 'dropped'
        GROUP BY c.course_id, c.course_code ORDER BY total DESC, c.course_code LIMIT 8""")
    grades = query_all("""SELECT letter_grade AS label, COUNT(*) AS total FROM grades
                          GROUP BY letter_grade ORDER BY MIN(grade_points) DESC""")
    return {**totals, "avg_attendance": avg_att["v"], "low_attendance_students": low_att["v"],
            "avg_cgpa": avg_cgpa["v"], "students_by_department": by_dept,
            "enrollments_by_course": top_courses, "grade_distribution": grades}


def _faculty_stats(faculty_id):
    courses = query_all("""
        SELECT c.course_id, c.course_code, c.course_name,
               (SELECT COUNT(*) FROM enrollments en
                 WHERE en.course_id = c.course_id AND en.status <> 'dropped') AS students,
               (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
                  FROM attendance a JOIN enrollments en ON en.enrollment_id = a.enrollment_id
                 WHERE en.course_id = c.course_id) AS avg_attendance,
               (SELECT ROUND(AVG(m.marks_obtained / ex.max_marks * 100), 1)
                  FROM marks m JOIN examinations ex ON ex.exam_id = m.exam_id
                 WHERE ex.course_id = c.course_id) AS avg_marks
        FROM courses c WHERE c.faculty_id = %s ORDER BY c.course_code""", (faculty_id,))
    return {"courses_count": len(courses),
            "students_count": sum(c["students"] for c in courses),
            "exams_count": query_one("""SELECT COUNT(*) AS v FROM examinations ex
                                        JOIN courses c ON c.course_id = ex.course_id
                                        WHERE c.faculty_id = %s""", (faculty_id,))["v"],
            "courses": courses}


def _student_stats(student_id):
    cgpa = query_one("SELECT cgpa, credits_graded FROM vw_student_cgpa WHERE student_id = %s", (student_id,))
    courses = query_one("""SELECT COUNT(*) AS v FROM enrollments
                           WHERE student_id = %s AND status = 'enrolled'""", (student_id,))
    attendance = query_all("""SELECT course_code, attendance_percentage, total_classes, classes_attended
                              FROM vw_attendance_report WHERE student_id = %s ORDER BY course_code""",
                           (student_id,))
    total = sum(a["total_classes"] for a in attendance)
    attended = sum(float(a["classes_attended"] or 0) for a in attendance)
    history = _student_history(student_id)
    return {"cgpa": cgpa["cgpa"] if cgpa else None,
            "credits_graded": cgpa["credits_graded"] if cgpa else 0,
            "enrolled_courses": courses["v"],
            "overall_attendance": round(100 * attended / total, 1) if total else None,
            "attendance_by_course": attendance,
            "sgpa_trend": [{"label": f"Sem {s['semester_number']}", "sgpa": s["sgpa"]}
                           for s in history["semesters"] if s["sgpa"] is not None]}


# ------------------------------------------------------------------ reports
@bp.get("/reports/performance")
@role_required("admin", "faculty")
def performance_report():
    """Marks/grade per student per course (from vw_academic_performance)."""
    sql = """SELECT p.student_id, p.roll_number, p.student_name, p.dept_name, p.semester_number,
                    p.academic_year, p.course_id, p.course_code, p.course_name, p.credits,
                    p.total_percentage, p.letter_grade, p.grade_points
             FROM vw_academic_performance p JOIN courses c ON c.course_id = p.course_id WHERE 1=1"""
    params = []
    if current_role() == "faculty":
        sql += " AND c.faculty_id = %s"
        params.append(current_faculty_id())
    for arg, col in (("course_id", "p.course_id"), ("semester_id", "p.semester_id")):
        value = request.args.get(arg, type=int)
        if value:
            sql += f" AND {col} = %s"
            params.append(value)
    search = request.args.get("search", "").strip()
    if search:
        sql += " AND (p.roll_number LIKE %s OR p.student_name LIKE %s)"
        params += [f"%{search}%"] * 2
    return jsonify(query_all(sql + " ORDER BY p.semester_number, p.course_code, p.roll_number", params))


@bp.get("/reports/cgpa")
@role_required("admin")
def cgpa_ranking():
    return jsonify(query_all("""
        SELECT RANK() OVER (ORDER BY cgpa DESC) AS rank_no, student_id, roll_number, student_name,
               credits_graded, cgpa
        FROM vw_student_cgpa ORDER BY cgpa DESC, roll_number"""))


@bp.get("/reports/course/<int:course_id>")
@role_required("admin", "faculty")
def course_report(course_id):
    """Course-wise report: every student's marks per exam, attendance %, total % and grade."""
    ensure_course_access(course_id)
    course = query_one("""SELECT c.course_id, c.course_code, c.course_name, c.credits, sem.semester_number,
                                 sem.academic_year
                          FROM courses c JOIN semesters sem ON sem.semester_id = c.semester_id
                          WHERE c.course_id = %s""", (course_id,))
    exams = query_all("""SELECT exam_id, exam_name, exam_type, exam_date, max_marks FROM examinations
                         WHERE course_id = %s ORDER BY exam_date, exam_id""", (course_id,))
    students = query_all("""
        SELECT en.enrollment_id, s.student_id, s.roll_number,
               CONCAT(s.first_name, ' ', s.last_name) AS student_name,
               g.total_percentage, g.letter_grade, g.grade_points,
               (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 2)
                  FROM attendance a WHERE a.enrollment_id = en.enrollment_id) AS attendance_percentage
        FROM enrollments en
        JOIN students s ON s.student_id = en.student_id
        LEFT JOIN grades g ON g.enrollment_id = en.enrollment_id
        WHERE en.course_id = %s AND en.status <> 'dropped'
        ORDER BY s.roll_number""", (course_id,))
    marks = query_all("""SELECT m.enrollment_id, m.exam_id, m.marks_obtained FROM marks m
                         JOIN enrollments en ON en.enrollment_id = m.enrollment_id
                         WHERE en.course_id = %s""", (course_id,))
    by_enrollment = {}
    for m in marks:
        by_enrollment.setdefault(m["enrollment_id"], {})[str(m["exam_id"])] = m["marks_obtained"]
    for s in students:
        s["marks"] = by_enrollment.get(s["enrollment_id"], {})
    return jsonify({"course": course, "exams": exams, "students": students})


def _student_history(student_id):
    rows = query_all("""
        SELECT semester_id, semester_number, academic_year, course_id, course_code, course_name,
               credits, total_percentage, letter_grade, grade_points
        FROM vw_academic_performance WHERE student_id = %s
        ORDER BY semester_number, course_code""", (student_id,))
    semesters = {}
    for r in rows:
        sem = semesters.setdefault(r["semester_id"], {
            "semester_id": r["semester_id"], "semester_number": r["semester_number"],
            "academic_year": r["academic_year"], "courses": []})
        sem["courses"].append({k: r[k] for k in ("course_id", "course_code", "course_name", "credits",
                                                 "total_percentage", "letter_grade", "grade_points")})

    def gpa(courses):
        graded = [c for c in courses if c["grade_points"] is not None]
        credits = sum(c["credits"] for c in graded)
        if not credits:
            return None, 0
        return round(sum(float(c["grade_points"]) * c["credits"] for c in graded) / credits, 2), credits

    all_courses = []
    ordered = sorted(semesters.values(), key=lambda s: s["semester_number"])
    for sem in ordered:
        sem["sgpa"], sem["credits"] = gpa(sem["courses"])
        all_courses += sem["courses"]
    cgpa, credits = gpa(all_courses)
    return {"semesters": ordered, "cgpa": cgpa, "credits_graded": credits}


@bp.get("/reports/history")
@role_required("student")
def my_history():
    """Semester-wise academic history of the logged-in student."""
    return jsonify(_student_history(current_student_id()))


@bp.get("/reports/history/<int:student_id>")
@role_required("admin")
def student_history(student_id):
    student = query_one("""SELECT student_id, roll_number, CONCAT(first_name, ' ', last_name) AS student_name
                           FROM students WHERE student_id = %s""", (student_id,))
    if not student:
        raise ApiError("Student not found", 404)
    return jsonify({**student, **_student_history(student_id)})
