"""Examinations and marks. Faculty enter marks only for their own courses; students read their own."""
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from auth import (current_faculty_id, current_role, current_student_id, ensure_course_access,
                  login_required, role_required)
from database import db_cursor, delete_row, insert_row, query_all, query_one, update_row
from errors import ApiError
from models.validators import EXAM_RULES, json_body, validate

bp = Blueprint("exams", __name__, url_prefix="/api")

EXAM_SQL = """
SELECT ex.exam_id, ex.course_id, c.course_code, c.course_name, ex.exam_name, ex.exam_type,
       ex.exam_date, ex.max_marks,
       (SELECT COUNT(*) FROM marks m WHERE m.exam_id = ex.exam_id) AS marks_entered
FROM examinations ex JOIN courses c ON c.course_id = ex.course_id
"""


def _exam_or_404(exam_id):
    exam = query_one(EXAM_SQL + " WHERE ex.exam_id = %s", (exam_id,))
    if not exam:
        raise ApiError("Exam not found", 404)
    return exam


@bp.get("/exams")
@login_required
def list_exams():
    sql, params = EXAM_SQL + " WHERE 1=1", []
    role = current_role()
    if role == "faculty":
        sql += " AND c.faculty_id = %s"
        params.append(current_faculty_id())
    elif role == "student":
        sql += (" AND ex.course_id IN (SELECT course_id FROM enrollments"
                " WHERE student_id = %s AND status <> 'dropped')")
        params.append(current_student_id())
    course_id = request.args.get("course_id", type=int)
    if course_id:
        sql += " AND ex.course_id = %s"
        params.append(course_id)
    return jsonify(query_all(sql + " ORDER BY ex.exam_date DESC, ex.exam_id DESC", params))


@bp.post("/exams")
@role_required("admin", "faculty")
def create_exam():
    clean = validate(json_body(), EXAM_RULES)
    ensure_course_access(clean["course_id"])
    _check_exam_name(clean["course_id"], clean["exam_name"])
    new_id = insert_row("examinations", clean)
    return jsonify(_exam_or_404(new_id)), 201


@bp.put("/exams/<int:exam_id>")
@role_required("admin", "faculty")
def update_exam(exam_id):
    exam = _exam_or_404(exam_id)
    ensure_course_access(exam["course_id"])
    rules = {k: v for k, v in EXAM_RULES.items() if k != "course_id"}   # an exam cannot move courses
    clean = validate(json_body(), rules, partial=True)
    if "exam_name" in clean:
        _check_exam_name(exam["course_id"], clean["exam_name"], exam_id)
    if "max_marks" in clean:
        top = query_one("SELECT MAX(marks_obtained) AS top FROM marks WHERE exam_id=%s", (exam_id,))["top"]
        if top is not None and clean["max_marks"] < top:
            raise ApiError("Max marks cannot be lower than marks already entered", 400,
                           {"max_marks": f"Existing marks go up to {top}"})
    update_row("examinations", "exam_id", exam_id, clean)
    return jsonify(_exam_or_404(exam_id))


@bp.delete("/exams/<int:exam_id>")
@role_required("admin", "faculty")
def delete_exam(exam_id):
    exam = _exam_or_404(exam_id)
    ensure_course_access(exam["course_id"])
    delete_row("examinations", "exam_id", exam_id)       # its marks are removed by ON DELETE CASCADE
    with db_cursor(commit=True) as cur:
        cur.execute("CALL sp_compute_grades(%s)", (exam["course_id"],))
    return jsonify({"message": "Exam deleted"})


def _check_exam_name(course_id, name, exclude_id=None):
    sql = "SELECT 1 AS hit FROM examinations WHERE course_id=%s AND exam_name=%s"
    params = [course_id, name]
    if exclude_id:
        sql += " AND exam_id<>%s"
        params.append(exclude_id)
    if query_one(sql, params):
        raise ApiError("This course already has an exam with that name", 409,
                       {"exam_name": "Exam name already used in this course"})


@bp.get("/exams/<int:exam_id>/marks")
@role_required("admin", "faculty")
def exam_marks(exam_id):
    exam = _exam_or_404(exam_id)
    ensure_course_access(exam["course_id"])
    students = query_all("""
        SELECT en.enrollment_id, s.student_id, s.roll_number,
               CONCAT(s.first_name, ' ', s.last_name) AS student_name, m.marks_obtained
        FROM enrollments en
        JOIN students s ON s.student_id = en.student_id
        LEFT JOIN marks m ON m.enrollment_id = en.enrollment_id AND m.exam_id = %s
        WHERE en.course_id = %s AND en.status <> 'dropped'
        ORDER BY s.roll_number""", (exam_id, exam["course_id"]))
    return jsonify({"exam": exam, "students": students})


@bp.post("/exams/<int:exam_id>/marks")
@role_required("admin", "faculty")
def save_marks(exam_id):
    """Body: {"records": [{"enrollment_id": 1, "marks_obtained": 42.5}, ...]}
    Saves the marks (UPSERT) and recalculates the course grades in the same transaction,
    so students see their results immediately."""
    exam = _exam_or_404(exam_id)
    ensure_course_access(exam["course_id"])
    records = json_body().get("records")
    if not isinstance(records, list) or not records:
        raise ApiError("records must be a non-empty list", 400)

    valid_ids = {r["enrollment_id"] for r in query_all(
        "SELECT enrollment_id FROM enrollments WHERE course_id=%s AND status <> 'dropped'", (exam["course_id"],))}
    max_marks = Decimal(str(exam["max_marks"]))

    upserts, clears, errors = [], [], {}
    for rec in records:
        try:
            enrollment_id = int(rec.get("enrollment_id"))
        except (TypeError, ValueError, AttributeError):
            raise ApiError("Each record needs a valid enrollment_id", 400)
        if enrollment_id not in valid_ids:
            raise ApiError(f"Enrollment {enrollment_id} does not belong to this course", 400)
        raw = rec.get("marks_obtained")
        if raw is None or str(raw).strip() == "":
            clears.append(enrollment_id)          # blank box = remove the mark
            continue
        try:
            value = Decimal(str(raw))
        except InvalidOperation:
            errors[str(enrollment_id)] = "Marks must be a number"
            continue
        if value < 0 or value > max_marks:
            errors[str(enrollment_id)] = f"Marks must be between 0 and {max_marks}"
            continue
        upserts.append((exam_id, enrollment_id, value))
    if errors:
        raise ApiError("Some marks are invalid", 400, errors)

    with db_cursor(commit=True) as cur:
        if upserts:
            cur.executemany("""
                INSERT INTO marks (exam_id, enrollment_id, marks_obtained) VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained)""", upserts)
        for enrollment_id in clears:
            cur.execute("DELETE FROM marks WHERE exam_id=%s AND enrollment_id=%s", (exam_id, enrollment_id))
        cur.execute("CALL sp_compute_grades(%s)", (exam["course_id"],))
    return jsonify({"message": f"Marks saved for {len(upserts)} students; grades updated"})


@bp.get("/marks/me")
@role_required("student")
def my_marks():
    """The student's own marks per exam, grades per course, and CGPA."""
    student_id = current_student_id()
    marks = query_all("""
        SELECT c.course_id, c.course_code, c.course_name, c.credits, sem.semester_number,
               ex.exam_id, ex.exam_name, ex.exam_type, ex.exam_date, ex.max_marks, m.marks_obtained
        FROM enrollments en
        JOIN courses c     ON c.course_id = en.course_id
        JOIN semesters sem ON sem.semester_id = c.semester_id
        JOIN examinations ex ON ex.course_id = c.course_id
        LEFT JOIN marks m  ON m.exam_id = ex.exam_id AND m.enrollment_id = en.enrollment_id
        WHERE en.student_id = %s AND en.status <> 'dropped'
        ORDER BY sem.semester_number DESC, c.course_code, ex.exam_date""", (student_id,))
    grades = query_all("""
        SELECT course_id, course_code, course_name, credits, semester_number,
               total_percentage, letter_grade, grade_points
        FROM vw_academic_performance WHERE student_id = %s
        ORDER BY semester_number DESC, course_code""", (student_id,))
    cgpa = query_one("SELECT cgpa, credits_graded FROM vw_student_cgpa WHERE student_id = %s", (student_id,))
    return jsonify({"marks": marks, "grades": grades, "cgpa": cgpa["cgpa"] if cgpa else None,
                    "credits_graded": cgpa["credits_graded"] if cgpa else 0})
