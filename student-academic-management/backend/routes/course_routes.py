"""Course management. Admin: full CRUD + faculty assignment. Faculty: only their own courses.
Students: read-only catalogue (with faculty details)."""
from flask import Blueprint, g, jsonify, request

from auth import current_faculty_id, current_role, ensure_course_access, login_required, role_required
from database import delete_row, ensure_unique, insert_row, query_all, query_one, update_row
from errors import ApiError
from models.validators import COURSE_RULES, json_body, validate

bp = Blueprint("courses", __name__, url_prefix="/api/courses")

COURSE_SQL = """
SELECT c.course_id, c.course_code, c.course_name, c.credits, c.max_seats,
       c.department_id, d.dept_code, d.dept_name,
       c.semester_id, sem.semester_number, sem.academic_year, sem.is_current,
       c.faculty_id, CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
       f.designation AS faculty_designation, fu.email AS faculty_email,
       (SELECT COUNT(*) FROM enrollments e
         WHERE e.course_id = c.course_id AND e.status <> 'dropped') AS enrolled_count
FROM courses c
JOIN departments d  ON d.department_id = c.department_id
JOIN semesters sem  ON sem.semester_id = c.semester_id
LEFT JOIN faculty f ON f.faculty_id = c.faculty_id
LEFT JOIN users fu  ON fu.user_id = f.user_id
"""


@bp.get("")
@login_required
def list_courses():
    sql, params = COURSE_SQL + " WHERE 1=1", []
    if current_role() == "faculty":          # faculty only ever see their own courses
        sql += " AND c.faculty_id = %s"
        params.append(current_faculty_id())
    search = request.args.get("search", "").strip()
    if search:
        sql += " AND (c.course_code LIKE %s OR c.course_name LIKE %s)"
        params += [f"%{search}%"] * 2
    for arg, col in (("department_id", "c.department_id"), ("semester_id", "c.semester_id")):
        value = request.args.get(arg, type=int)
        if value:
            sql += f" AND {col} = %s"
            params.append(value)
    if request.args.get("current") == "1":
        sql += " AND sem.is_current = TRUE"
    return jsonify(query_all(sql + " ORDER BY sem.semester_number, c.course_code", params))


@bp.get("/<int:course_id>")
@login_required
def get_course(course_id):
    if current_role() == "faculty":
        ensure_course_access(course_id)
    course = query_one(COURSE_SQL + " WHERE c.course_id = %s", (course_id,))
    if not course:
        raise ApiError("Course not found", 404)
    return jsonify(course)


@bp.get("/<int:course_id>/students")
@role_required("admin", "faculty")
def course_students(course_id):
    ensure_course_access(course_id)
    rows = query_all("""
        SELECT en.enrollment_id, en.status, s.student_id, s.roll_number,
               CONCAT(s.first_name, ' ', s.last_name) AS student_name, u.email, s.current_semester
        FROM enrollments en
        JOIN students s ON s.student_id = en.student_id
        JOIN users u    ON u.user_id = s.user_id
        WHERE en.course_id = %s AND en.status <> 'dropped'
        ORDER BY s.roll_number""", (course_id,))
    return jsonify(rows)


@bp.post("")
@role_required("admin")
def create_course():
    clean = validate(json_body(), COURSE_RULES)
    _check_code_unique(clean["course_code"], clean["semester_id"])
    new_id = insert_row("courses", clean)
    return jsonify(query_one(COURSE_SQL + " WHERE c.course_id = %s", (new_id,))), 201


@bp.put("/<int:course_id>")
@role_required("admin")
def update_course(course_id):
    current = query_one("SELECT course_code, semester_id FROM courses WHERE course_id=%s", (course_id,))
    if not current:
        raise ApiError("Course not found", 404)
    clean = validate(json_body(), COURSE_RULES, partial=True)
    _check_code_unique(clean.get("course_code", current["course_code"]),
                       clean.get("semester_id", current["semester_id"]), course_id)
    update_row("courses", "course_id", course_id, clean)
    return jsonify(query_one(COURSE_SQL + " WHERE c.course_id = %s", (course_id,)))


@bp.put("/<int:course_id>/faculty")
@role_required("admin")
def assign_faculty(course_id):
    """Body: {"faculty_id": 3}  or  {"faculty_id": null} to unassign."""
    data = json_body()
    faculty_id = data.get("faculty_id")
    if faculty_id in ("", None):
        faculty_id = None
    else:
        try:
            faculty_id = int(faculty_id)
        except (TypeError, ValueError):
            raise ApiError("faculty_id must be a number", 400, {"faculty_id": "Invalid faculty"})
        if not query_one("SELECT 1 AS ok FROM faculty WHERE faculty_id=%s", (faculty_id,)):
            raise ApiError("Faculty member not found", 404, {"faculty_id": "Faculty member not found"})
    if not update_row("courses", "course_id", course_id, {"faculty_id": faculty_id}):
        raise ApiError("Course not found", 404)
    return jsonify(query_one(COURSE_SQL + " WHERE c.course_id = %s", (course_id,)))


@bp.delete("/<int:course_id>")
@role_required("admin")
def delete_course(course_id):
    if not delete_row("courses", "course_id", course_id):
        raise ApiError("Course not found", 404)
    return jsonify({"message": "Course deleted"})


def _check_code_unique(code, semester_id, exclude_id=None):
    sql = "SELECT 1 AS hit FROM courses WHERE course_code=%s AND semester_id=%s"
    params = [code, semester_id]
    if exclude_id:
        sql += " AND course_id<>%s"
        params.append(exclude_id)
    if query_one(sql, params):
        raise ApiError("This course code already exists in that semester", 409,
                       {"course_code": "Course code already exists in this semester"})
