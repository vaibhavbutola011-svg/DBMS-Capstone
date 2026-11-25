"""Login, student self-registration, current user, change password."""
import datetime

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash

from auth import create_token, login_required
from config.config import Config
from database import execute, query_one
from errors import ApiError
from models import student_model
from models.user_model import get_user_by_email, get_user_by_id, hash_password
from models.validators import STUDENT_RULES, json_body, validate, validate_email, validate_password

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _user_payload(user):
    """Public user info + the profile id/name for the user's role."""
    info = {"user_id": user["user_id"], "email": user["email"], "role": user["role"],
            "name": "Administrator", "profile_id": None}
    if user["role"] == "student":
        row = query_one("SELECT student_id AS pid, CONCAT(first_name,' ',last_name) AS name "
                        "FROM students WHERE user_id=%s", (user["user_id"],))
    elif user["role"] == "faculty":
        row = query_one("SELECT faculty_id AS pid, CONCAT(first_name,' ',last_name) AS name "
                        "FROM faculty WHERE user_id=%s", (user["user_id"],))
    else:
        row = None
    if row:
        info["name"], info["profile_id"] = row["name"], row["pid"]
    return info


@bp.post("/login")
def login():
    data = json_body()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not email or not password:
        raise ApiError("Email and password are required", 400,
                       {"email": "Required" if not email else "", "password": "Required" if not password else ""})
    user = get_user_by_email(email)
    # Same message for "no such user" and "wrong password" so accounts cannot be probed
    if not user or not check_password_hash(user["password_hash"], password):
        raise ApiError("Invalid email or password", 401)
    if not user["is_active"]:
        raise ApiError("This account has been disabled", 403)
    return jsonify({"token": create_token(user["user_id"], user["role"]), "user": _user_payload(user)})


@bp.post("/register")
def register():
    """Students can create their own account. Faculty/admin accounts are created by the admin."""
    data = json_body()
    email = validate_email(data.get("email"))
    password = validate_password(data.get("password"))
    payload = {k: v for k, v in data.items() if k != "status"}
    payload.setdefault("admission_year", datetime.date.today().year)
    clean = validate(payload, STUDENT_RULES)
    student_id = student_model.create_student(clean, email, password)
    return jsonify({"message": "Registration successful. You can now log in.", "student_id": student_id}), 201


@bp.get("/me")
@login_required
def me():
    return jsonify(_user_payload(g.user))


@bp.post("/change-password")
@login_required
def change_password():
    data = json_body()
    user = get_user_by_id(g.user["user_id"])
    if not check_password_hash(user["password_hash"], str(data.get("current_password", ""))):
        raise ApiError("Current password is incorrect", 400, {"current_password": "Current password is incorrect"})
    new_password = validate_password(data.get("new_password"), "new_password")
    execute("UPDATE users SET password_hash=%s WHERE user_id=%s", (hash_password(new_password), user["user_id"]))
    return jsonify({"message": "Password updated"})
