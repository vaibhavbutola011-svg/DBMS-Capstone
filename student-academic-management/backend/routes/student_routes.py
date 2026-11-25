"""Student CRUD (admin) and the student's own profile."""
from flask import Blueprint, g, jsonify, request

from auth import current_student_id, login_required, role_required
from config.config import Config
from database import update_row
from errors import ApiError
from models import student_model
from models.validators import (STUDENT_RULES, json_body, validate, validate_email, validate_password)

bp = Blueprint("students", __name__, url_prefix="/api/students")


@bp.get("")
@role_required("admin")
def list_students():
    rows = student_model.list_students(
        search=request.args.get("search", "").strip() or None,
        department_id=request.args.get("department_id", type=int),
        status=request.args.get("status") or None)
    return jsonify(rows)


@bp.get("/me")
@role_required("student")
def my_profile():
    return jsonify(student_model.get_student(current_student_id()))


@bp.put("/me")
@role_required("student")
def update_my_profile():
    """Students may only change contact details, never roll number, department, status..."""
    data = json_body()
    allowed = {k: data[k] for k in ("phone", "address") if k in data}
    clean = validate(allowed, {k: STUDENT_RULES[k] for k in allowed}, partial=True)
    update_row("students", "student_id", current_student_id(), clean)
    return jsonify(student_model.get_student(current_student_id()))


@bp.get("/<int:student_id>")
@role_required("admin")
def get_student(student_id):
    student = student_model.get_student(student_id)
    if not student:
        raise ApiError("Student not found", 404)
    return jsonify(student)


@bp.post("")
@role_required("admin")
def create_student():
    data = json_body()
    email = validate_email(data.get("email"))
    password = data.get("password") or Config.DEFAULT_STUDENT_PASSWORD
    validate_password(password)
    clean = validate(data, STUDENT_RULES)
    student_id = student_model.create_student(clean, email, password)
    return jsonify(student_model.get_student(student_id)), 201


@bp.put("/<int:student_id>")
@role_required("admin")
def update_student(student_id):
    data = json_body()
    clean = validate(data, STUDENT_RULES, partial=True)
    email = validate_email(data["email"]) if data.get("email") else None
    password = None
    if data.get("password"):
        password = validate_password(data["password"])
    student_model.update_student(student_id, clean, email, password)
    return jsonify(student_model.get_student(student_id))


@bp.delete("/<int:student_id>")
@role_required("admin")
def delete_student(student_id):
    student_model.delete_student(student_id)
    return jsonify({"message": "Student deleted"})
