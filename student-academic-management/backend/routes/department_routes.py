"""Departments and semesters. Reading departments is public (the registration form needs it)."""
from flask import Blueprint, jsonify

from auth import login_required, role_required
from database import (db_cursor, delete_row, ensure_unique, insert_row, query_all, query_one, update_row)
from errors import ApiError
from models.validators import DEPARTMENT_RULES, SEMESTER_RULES, json_body, validate

bp = Blueprint("departments", __name__, url_prefix="/api")

DEPT_SQL = """
SELECT d.department_id, d.dept_code, d.dept_name,
       (SELECT COUNT(*) FROM students s WHERE s.department_id = d.department_id) AS student_count,
       (SELECT COUNT(*) FROM faculty f  WHERE f.department_id = d.department_id) AS faculty_count,
       (SELECT COUNT(*) FROM courses c  WHERE c.department_id = d.department_id) AS course_count
FROM departments d
"""


# ------------------------------------------------------------------ departments
@bp.get("/departments")
def list_departments():
    return jsonify(query_all(DEPT_SQL + " ORDER BY d.dept_name"))


@bp.post("/departments")
@role_required("admin")
def create_department():
    clean = validate(json_body(), DEPARTMENT_RULES)
    ensure_unique("departments", "dept_code", clean["dept_code"], message="Department code already exists")
    ensure_unique("departments", "dept_name", clean["dept_name"], message="Department name already exists")
    new_id = insert_row("departments", clean)
    return jsonify(query_one(DEPT_SQL + " WHERE d.department_id=%s", (new_id,))), 201


@bp.put("/departments/<int:department_id>")
@role_required("admin")
def update_department(department_id):
    clean = validate(json_body(), DEPARTMENT_RULES, partial=True)
    if "dept_code" in clean:
        ensure_unique("departments", "dept_code", clean["dept_code"], "department_id", department_id,
                      "Department code already exists")
    if "dept_name" in clean:
        ensure_unique("departments", "dept_name", clean["dept_name"], "department_id", department_id,
                      "Department name already exists")
    if not update_row("departments", "department_id", department_id, clean):
        raise ApiError("Department not found", 404)
    return jsonify(query_one(DEPT_SQL + " WHERE d.department_id=%s", (department_id,)))


@bp.delete("/departments/<int:department_id>")
@role_required("admin")
def delete_department(department_id):
    # ON DELETE RESTRICT: MySQL refuses if students/faculty/courses still use it (handled as 409)
    if not delete_row("departments", "department_id", department_id):
        raise ApiError("Department not found", 404)
    return jsonify({"message": "Department deleted"})


# ------------------------------------------------------------------ semesters
SEM_SQL = """
SELECT sem.semester_id, sem.semester_number, sem.academic_year, sem.start_date, sem.end_date, sem.is_current,
       (SELECT COUNT(*) FROM courses c WHERE c.semester_id = sem.semester_id) AS course_count
FROM semesters sem
"""


@bp.get("/semesters")
@login_required
def list_semesters():
    return jsonify(query_all(SEM_SQL + " ORDER BY sem.start_date DESC"))


def _check_dates(start, end):
    if start and end and end <= start:
        raise ApiError("End date must be after start date", 400, {"end_date": "End date must be after start date"})


@bp.post("/semesters")
@role_required("admin")
def create_semester():
    clean = validate(json_body(), SEMESTER_RULES)
    _check_dates(clean["start_date"], clean["end_date"])
    ensure_unique_semester(clean["semester_number"], clean["academic_year"])
    with db_cursor(commit=True) as cur:
        if clean.get("is_current"):
            cur.execute("UPDATE semesters SET is_current = FALSE")
        cols = list(clean.keys())
        cur.execute(f"INSERT INTO semesters ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
                    list(clean.values()))
        new_id = cur.lastrowid
    return jsonify(query_one(SEM_SQL + " WHERE sem.semester_id=%s", (new_id,))), 201


def ensure_unique_semester(number, year, exclude_id=None):
    sql = "SELECT 1 AS hit FROM semesters WHERE semester_number=%s AND academic_year=%s"
    params = [number, year]
    if exclude_id:
        sql += " AND semester_id<>%s"
        params.append(exclude_id)
    if query_one(sql, params):
        raise ApiError("This semester already exists for that academic year", 409,
                       {"semester_number": "Already exists for this academic year"})


@bp.put("/semesters/<int:semester_id>")
@role_required("admin")
def update_semester(semester_id):
    current = query_one("SELECT * FROM semesters WHERE semester_id=%s", (semester_id,))
    if not current:
        raise ApiError("Semester not found", 404)
    clean = validate(json_body(), SEMESTER_RULES, partial=True)
    _check_dates(clean.get("start_date", current["start_date"]), clean.get("end_date", current["end_date"]))
    ensure_unique_semester(clean.get("semester_number", current["semester_number"]),
                           clean.get("academic_year", current["academic_year"]), semester_id)
    with db_cursor(commit=True) as cur:
        if clean.get("is_current"):
            cur.execute("UPDATE semesters SET is_current = FALSE")
        if clean:
            sets = ", ".join(f"{col}=%s" for col in clean)
            cur.execute(f"UPDATE semesters SET {sets} WHERE semester_id=%s", [*clean.values(), semester_id])
    return jsonify(query_one(SEM_SQL + " WHERE sem.semester_id=%s", (semester_id,)))


@bp.delete("/semesters/<int:semester_id>")
@role_required("admin")
def delete_semester(semester_id):
    if not delete_row("semesters", "semester_id", semester_id):
        raise ApiError("Semester not found", 404)
    return jsonify({"message": "Semester deleted"})
