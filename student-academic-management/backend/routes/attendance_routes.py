"""Attendance. Faculty mark attendance only for their own courses; students only read their own."""
import datetime

from flask import Blueprint, g, jsonify, request

from auth import (current_faculty_id, current_role, current_student_id, ensure_course_access,
                  login_required, role_required)
from database import db_cursor, query_all, query_one
from errors import ApiError
from models.validators import json_body

bp = Blueprint("attendance", __name__, url_prefix="/api/attendance")

STATUSES = ("present", "absent", "late")


def _parse_date(value):
    try:
        day = datetime.date.fromisoformat(str(value)[:10])
    except ValueError:
        raise ApiError("Use the date format YYYY-MM-DD", 400, {"date": "Invalid date"})
    if day > datetime.date.today():
        raise ApiError("Attendance cannot be marked for a future date", 400, {"date": "Date cannot be in the future"})
    return day


@bp.get("/course/<int:course_id>")
@role_required("admin", "faculty")
def course_roster(course_id):
    """Class list for one date with each student's saved status (null = not marked yet)."""
    ensure_course_access(course_id)
    day = _parse_date(request.args.get("date") or datetime.date.today().isoformat())
    rows = query_all("""
        SELECT en.enrollment_id, s.student_id, s.roll_number,
               CONCAT(s.first_name, ' ', s.last_name) AS student_name,
               a.status
        FROM enrollments en
        JOIN students s ON s.student_id = en.student_id
        LEFT JOIN attendance a ON a.enrollment_id = en.enrollment_id AND a.attendance_date = %s
        WHERE en.course_id = %s AND en.status <> 'dropped'
        ORDER BY s.roll_number""", (day, course_id))
    return jsonify({"date": day.isoformat(), "students": rows})


@bp.get("/course/<int:course_id>/dates")
@role_required("admin", "faculty")
def course_dates(course_id):
    """Dates on which attendance has already been taken (so faculty can reopen and edit them)."""
    ensure_course_access(course_id)
    rows = query_all("""
        SELECT a.attendance_date AS date, COUNT(*) AS marked,
               SUM(a.status IN ('present', 'late')) AS present_count
        FROM attendance a JOIN enrollments en ON en.enrollment_id = a.enrollment_id
        WHERE en.course_id = %s
        GROUP BY a.attendance_date ORDER BY a.attendance_date DESC""", (course_id,))
    return jsonify(rows)


@bp.post("/course/<int:course_id>")
@role_required("admin", "faculty")
def save_attendance(course_id):
    """Body: {"date": "2026-11-02", "records": [{"enrollment_id": 1, "status": "present"}, ...]}
    Inserts new rows and updates existing ones for that date (UPSERT) in one transaction."""
    ensure_course_access(course_id)
    data = json_body()
    day = _parse_date(data.get("date"))
    records = data.get("records")
    if not isinstance(records, list) or not records:
        raise ApiError("records must be a non-empty list", 400)

    valid_ids = {r["enrollment_id"] for r in query_all(
        "SELECT enrollment_id FROM enrollments WHERE course_id=%s AND status <> 'dropped'", (course_id,))}
    marked_by = current_faculty_id() if current_role() == "faculty" else None

    values = []
    for rec in records:
        try:
            enrollment_id = int(rec.get("enrollment_id"))
        except (TypeError, ValueError, AttributeError):
            raise ApiError("Each record needs a valid enrollment_id", 400)
        if enrollment_id not in valid_ids:
            raise ApiError(f"Enrollment {enrollment_id} does not belong to this course", 400)
        if rec.get("status") not in STATUSES:
            raise ApiError("status must be present, absent or late", 400)
        values.append((enrollment_id, day, rec["status"], marked_by))

    with db_cursor(commit=True) as cur:
        cur.executemany("""
            INSERT INTO attendance (enrollment_id, attendance_date, status, marked_by)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)""", values)
    return jsonify({"message": f"Attendance saved for {len(values)} students", "date": day.isoformat()})


@bp.get("/me")
@role_required("student")
def my_attendance():
    rows = query_all("""
        SELECT course_id, course_code, course_name, total_classes, classes_attended, attendance_percentage
        FROM vw_attendance_report WHERE student_id = %s ORDER BY course_code""", (current_student_id(),))
    total = sum(r["total_classes"] for r in rows)
    attended = sum(float(r["classes_attended"] or 0) for r in rows)
    overall = round(100 * attended / total, 2) if total else None
    return jsonify({"courses": rows, "overall_percentage": overall})


@bp.get("/me/course/<int:course_id>")
@role_required("student")
def my_course_attendance(course_id):
    rows = query_all("""
        SELECT a.attendance_date AS date, a.status
        FROM attendance a JOIN enrollments en ON en.enrollment_id = a.enrollment_id
        WHERE en.student_id = %s AND en.course_id = %s
        ORDER BY a.attendance_date DESC""", (current_student_id(), course_id))
    return jsonify(rows)


@bp.get("/report")
@role_required("admin", "faculty")
def attendance_report():
    """Attendance % per student per course (from the vw_attendance_report view)."""
    sql = """SELECT r.student_id, r.roll_number, r.student_name, r.course_id, r.course_code, r.course_name,
                    r.total_classes, r.classes_attended, r.attendance_percentage
             FROM vw_attendance_report r JOIN courses c ON c.course_id = r.course_id WHERE 1=1"""
    params = []
    if current_role() == "faculty":
        sql += " AND c.faculty_id = %s"
        params.append(current_faculty_id())
    course_id = request.args.get("course_id", type=int)
    if course_id:
        sql += " AND r.course_id = %s"
        params.append(course_id)
    semester_id = request.args.get("semester_id", type=int)
    if semester_id:
        sql += " AND c.semester_id = %s"
        params.append(semester_id)
    below = request.args.get("below", type=float)
    if below is not None:
        sql += " AND r.attendance_percentage < %s"
        params.append(below)
    search = request.args.get("search", "").strip()
    if search:
        sql += " AND (r.roll_number LIKE %s OR r.student_name LIKE %s)"
        params += [f"%{search}%"] * 2
    return jsonify(query_all(sql + " ORDER BY r.course_code, r.roll_number", params))
