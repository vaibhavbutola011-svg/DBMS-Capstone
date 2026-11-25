"""Authentication helpers: JWT tokens, login_required, role_required, ownership checks."""
import datetime
from functools import wraps

import jwt
from flask import g, request

from config.config import Config
from database import query_one
from errors import ApiError


def create_token(user_id, role):
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + datetime.timedelta(hours=Config.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")


def _load_user_from_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise ApiError("Authentication required", 401)
    try:
        payload = jwt.decode(header[7:], Config.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ApiError("Session expired. Please log in again.", 401)
    except jwt.InvalidTokenError:
        raise ApiError("Invalid authentication token", 401)

    # Re-read the user so a disabled / deleted account loses access immediately,
    # and so the role always comes from the database, never from the client.
    user = query_one("SELECT user_id, email, role, is_active FROM users WHERE user_id=%s",
                     (int(payload["sub"]),))
    if not user or not user["is_active"]:
        raise ApiError("Account not found or disabled", 401)
    g.user = user


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        _load_user_from_token()
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            _load_user_from_token()
            if g.user["role"] not in roles:
                raise ApiError("You do not have permission to perform this action", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def current_role():
    return g.user["role"]


def current_student_id():
    if "student_id" not in g:
        row = query_one("SELECT student_id FROM students WHERE user_id=%s", (g.user["user_id"],))
        g.student_id = row["student_id"] if row else None
    if g.student_id is None:
        raise ApiError("No student profile is linked to this account", 403)
    return g.student_id


def current_faculty_id():
    if "faculty_id" not in g:
        row = query_one("SELECT faculty_id FROM faculty WHERE user_id=%s", (g.user["user_id"],))
        g.faculty_id = row["faculty_id"] if row else None
    if g.faculty_id is None:
        raise ApiError("No faculty profile is linked to this account", 403)
    return g.faculty_id


def ensure_course_access(course_id):
    """Admin: any course. Faculty: only courses assigned to them. Others: forbidden.
    Returns the course row (course_id, faculty_id, semester_id)."""
    course = query_one("SELECT course_id, faculty_id, semester_id, course_code FROM courses WHERE course_id=%s",
                       (course_id,))
    if not course:
        raise ApiError("Course not found", 404)
    role = g.user["role"]
    if role == "admin":
        return course
    if role == "faculty" and course["faculty_id"] == current_faculty_id():
        return course
    raise ApiError("You can only manage your own assigned courses", 403)
