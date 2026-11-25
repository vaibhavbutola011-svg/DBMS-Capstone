"""Faculty CRUD (admin) and the faculty member's own profile."""
from flask import Blueprint, jsonify, request

from auth import current_faculty_id, role_required
from config.config import Config
from errors import ApiError
from models import faculty_model
from models.validators import (FACULTY_RULES, json_body, validate, validate_email, validate_password)

bp = Blueprint("faculty", __name__, url_prefix="/api/faculty")


@bp.get("")
@role_required("admin")
def list_faculty():
    return jsonify(faculty_model.list_faculty(
        search=request.args.get("search", "").strip() or None,
        department_id=request.args.get("department_id", type=int)))


@bp.get("/me")
@role_required("faculty")
def my_profile():
    return jsonify(faculty_model.get_faculty(current_faculty_id()))


@bp.get("/<int:faculty_id>")
@role_required("admin")
def get_faculty(faculty_id):
    member = faculty_model.get_faculty(faculty_id)
    if not member:
        raise ApiError("Faculty member not found", 404)
    return jsonify(member)


@bp.post("")
@role_required("admin")
def create_faculty():
    data = json_body()
    email = validate_email(data.get("email"))
    password = data.get("password") or Config.DEFAULT_FACULTY_PASSWORD
    validate_password(password)
    clean = validate(data, FACULTY_RULES)
    faculty_id = faculty_model.create_faculty(clean, email, password)
    return jsonify(faculty_model.get_faculty(faculty_id)), 201


@bp.put("/<int:faculty_id>")
@role_required("admin")
def update_faculty(faculty_id):
    data = json_body()
    clean = validate(data, FACULTY_RULES, partial=True)
    email = validate_email(data["email"]) if data.get("email") else None
    password = validate_password(data["password"]) if data.get("password") else None
    faculty_model.update_faculty(faculty_id, clean, email, password)
    return jsonify(faculty_model.get_faculty(faculty_id))


@bp.delete("/<int:faculty_id>")
@role_required("admin")
def delete_faculty(faculty_id):
    faculty_model.delete_faculty(faculty_id)
    return jsonify({"message": "Faculty member deleted"})
