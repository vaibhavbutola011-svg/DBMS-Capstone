"""Enrollments. Admin manages everything; a student can only enroll/drop themselves
(current-semester courses only); faculty can only read enrollments of their own courses."""
from flask import Blueprint, jsonify, request

from auth import (current_faculty_id, current_role, current_student_id, login_required, role_required)
from database import db_cursor, delete_row, query_all, query_one, update_row
from errors import ApiError
from models.validators import json_body

bp = Blueprint("enrollments", __name__, url_prefix="/api/enrollments")

ENR_SQL = """
SELECT en.enrollment_id, en.student_id, s.roll_number,
       CONCAT(s.first_name, ' ', s.last_name) AS student_name,
       en.course_id, c.course_code, c.course_name, c.credits,
       sem.semester_number, sem.academic_year, sem.is_current,
       CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
       en.enrolled_on, en.status
FROM enrollments en
JOIN students s     ON s.student_id = en.student_id
JOIN courses c      ON c.course_id = en.course_id
JOIN semesters sem  ON sem.semester_id = c.semester_id
LEFT JOIN faculty f ON f.faculty_id = c.faculty_id
"""


def _get(enrollment_id):
    return query_one(ENR_SQL + " WHERE en.enrollment_id = %s", (enrollment_id,))


@bp.get("")
@login_required
def list_enrollments():
    sql, params = ENR_SQL + " WHERE 1=1", []
    role = current_role()
    if role == "student":
        sql += " AND en.student_id = %s"
        params.append(current_student_id())
    elif role == "faculty":
        sql += " AND c.faculty_id = %s"
        params.append(current_faculty_id())
    else:
        student_id = request.args.get("student_id", type=int)
        if student_id:
            sql += " AND en.student_id = %s"
            params.append(student_id)
    course_id = request.args.get("course_id", type=int)
    if course_id:
        sql += " AND en.course_id = %s"
        params.append(course_id)
    status = request.args.get("status")
    if status:
        sql += " AND en.status = %s"
        params.append(status)
    search = request.args.get("search", "").strip()
    if search:
        sql += " AND (s.roll_number LIKE %s OR s.first_name LIKE %s OR s.last_name LIKE %s OR c.course_code LIKE %s)"
        params += [f"%{search}%"] * 4
    return jsonify(query_all(sql + " ORDER BY sem.semester_number DESC, c.course_code, s.roll_number", params))


@bp.post("")
@role_required("admin", "student")
def create_enrollment():
    data = json_body()
    course_id = data.get("course_id")
    if not course_id:
        raise ApiError("course_id is required", 400, {"course_id": "Select a course"})
    try:
        course_id = int(course_id)
    except (TypeError, ValueError):
        raise ApiError("Invalid course", 400, {"course_id": "Invalid course"})

    if current_role() == "student":
        student_id = current_student_id()      # never trust a student id sent by the client
    else:
        if not data.get("student_id"):
            raise ApiError("student_id is required", 400, {"student_id": "Select a student"})
        try:
            student_id = int(data["student_id"])
        except (TypeError, ValueError):
            raise ApiError("Invalid student", 400, {"student_id": "Invalid student"})
        if not query_one("SELECT 1 AS ok FROM students WHERE student_id=%s", (student_id,)):
            raise ApiError("Student not found", 404, {"student_id": "Student not found"})

    course = query_one("""SELECT c.course_id, sem.is_current FROM courses c
                          JOIN semesters sem ON sem.semester_id = c.semester_id
                          WHERE c.course_id = %s""", (course_id,))
    if not course:
        raise ApiError("Course not found", 404, {"course_id": "Course not found"})
    if current_role() == "student" and not course["is_current"]:
        raise ApiError("You can only enroll in courses of the current semester", 400,
                       {"course_id": "Only current-semester courses are open for enrollment"})

    existing = query_one("SELECT enrollment_id, status FROM enrollments WHERE student_id=%s AND course_id=%s",
                         (student_id, course_id))
    if existing and existing["status"] != "dropped":
        raise ApiError("Already enrolled in this course", 409, {"course_id": "Already enrolled in this course"})

    with db_cursor(commit=True) as cur:
        if existing:  # re-enrolling after a drop: remove the dropped row, then insert a fresh one
            cur.execute("DELETE FROM enrollments WHERE enrollment_id=%s", (existing["enrollment_id"],))
        # The seat-limit trigger in MySQL raises "Course is full" -> returned as HTTP 400
        cur.execute("INSERT INTO enrollments (student_id, course_id) VALUES (%s, %s)", (student_id, course_id))
        new_id = cur.lastrowid
    return jsonify(_get(new_id)), 201


@bp.put("/<int:enrollment_id>")
@role_required("admin")
def update_enrollment(enrollment_id):
    status = json_body().get("status")
    if status not in ("enrolled", "dropped", "completed"):
        raise ApiError("Status must be enrolled, dropped or completed", 400, {"status": "Invalid status"})
    if not update_row("enrollments", "enrollment_id", enrollment_id, {"status": status}):
        raise ApiError("Enrollment not found", 404)
    return jsonify(_get(enrollment_id))


@bp.post("/<int:enrollment_id>/drop")
@role_required("admin", "student")
def drop_enrollment(enrollment_id):
    enrollment = _get(enrollment_id)
    if not enrollment:
        raise ApiError("Enrollment not found", 404)
    if current_role() == "student" and enrollment["student_id"] != current_student_id():
        raise ApiError("You can only drop your own courses", 403)
    if enrollment["status"] != "enrolled":
        raise ApiError("Only active enrollments can be dropped", 400)
    update_row("enrollments", "enrollment_id", enrollment_id, {"status": "dropped"})
    return jsonify(_get(enrollment_id))


@bp.delete("/<int:enrollment_id>")
@role_required("admin")
def delete_enrollment(enrollment_id):
    if not delete_row("enrollments", "enrollment_id", enrollment_id):
        raise ApiError("Enrollment not found", 404)
    return jsonify({"message": "Enrollment removed"})
