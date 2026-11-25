"""Input validation. Every API payload passes through here before touching the database."""
import datetime
import re
from decimal import Decimal, InvalidOperation

from flask import request

from errors import ApiError

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+ -]{7,15}$")


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object", 400)
    return data


def _convert(kind, value, opts):
    if kind == "str":
        value = str(value).strip()
        if len(value) > opts.get("max", 255):
            raise ValueError(f"Must be at most {opts.get('max', 255)} characters")
        if "pattern" in opts and not re.match(opts["pattern"], value):
            raise ValueError(opts.get("pattern_msg", "Invalid format"))
        return value
    if kind == "email":
        value = str(value).strip().lower()
        if not EMAIL_RE.match(value) or len(value) > 120:
            raise ValueError("Enter a valid email address")
        return value
    if kind == "phone":
        value = str(value).strip()
        if not PHONE_RE.match(value):
            raise ValueError("Phone must be 7-15 digits (digits, +, space, - allowed)")
        return value
    if kind == "date":
        try:
            return datetime.date.fromisoformat(str(value)[:10])
        except ValueError:
            raise ValueError("Use the date format YYYY-MM-DD")
    if kind == "int":
        try:
            number = int(value)
        except (TypeError, ValueError):
            raise ValueError("Must be a whole number")
        if "min" in opts and number < opts["min"]:
            raise ValueError(f"Must be at least {opts['min']}")
        if "max" in opts and number > opts["max"]:
            raise ValueError(f"Must be at most {opts['max']}")
        return number
    if kind == "decimal":
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            raise ValueError("Must be a number")
        if "min" in opts and number < opts["min"]:
            raise ValueError(f"Must be at least {opts['min']}")
        if "max" in opts and number > opts["max"]:
            raise ValueError(f"Must be at most {opts['max']}")
        return number
    if kind == "enum":
        if value not in opts["choices"]:
            raise ValueError("Must be one of: " + ", ".join(opts["choices"]))
        return value
    if kind == "bool":
        if isinstance(value, bool):
            return value
        if str(value).lower() in ("1", "true", "yes"):
            return True
        if str(value).lower() in ("0", "false", "no"):
            return False
        raise ValueError("Must be true or false")
    raise ValueError("Unsupported field type")


def validate(data, rules, partial=False):
    """rules = {field: (kind, required, options?)}.  partial=True is used for updates
    (only the fields present are validated). Returns a dict of clean, typed values."""
    clean, errors = {}, {}
    for field, rule in rules.items():
        kind, required = rule[0], rule[1]
        opts = rule[2] if len(rule) > 2 else {}
        if field not in data:
            if required and not partial:
                errors[field] = "This field is required"
            continue
        value = data[field]
        if isinstance(value, str):
            value = value.strip()
        if value is None or value == "":
            if required:
                errors[field] = "This field is required"
            elif opts.get("nullable"):
                clean[field] = None
            continue
        try:
            clean[field] = _convert(kind, value, opts)
        except ValueError as exc:
            errors[field] = str(exc)
    if errors:
        raise ApiError("Please correct the highlighted fields", 400, errors)
    return clean


def validate_password(password, field="password"):
    if not isinstance(password, str) or len(password) < 8:
        raise ApiError("Password must be at least 8 characters", 400,
                       {field: "Password must be at least 8 characters"})
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ApiError("Password must contain letters and digits", 400,
                       {field: "Password must contain letters and digits"})
    return password


def validate_email(email):
    return validate({"email": email}, {"email": ("email", True)})["email"]


GENDERS = ["Male", "Female", "Other"]

STUDENT_RULES = {
    "roll_number": ("str", True, {"max": 20}),
    "first_name": ("str", True, {"max": 50}),
    "last_name": ("str", True, {"max": 50}),
    "date_of_birth": ("date", True),
    "gender": ("enum", True, {"choices": GENDERS}),
    "phone": ("phone", False, {"nullable": True}),
    "address": ("str", False, {"max": 255, "nullable": True}),
    "department_id": ("int", True, {"min": 1}),
    "current_semester": ("int", False, {"min": 1, "max": 8}),
    "admission_year": ("int", False, {"min": 1990, "max": 2100}),
    "status": ("enum", False, {"choices": ["active", "graduated", "suspended"]}),
}

FACULTY_RULES = {
    "employee_code": ("str", True, {"max": 20}),
    "first_name": ("str", True, {"max": 50}),
    "last_name": ("str", True, {"max": 50}),
    "phone": ("phone", False, {"nullable": True}),
    "designation": ("str", False, {"max": 60}),
    "department_id": ("int", True, {"min": 1}),
    "joining_date": ("date", True),
}

DEPARTMENT_RULES = {
    "dept_code": ("str", True, {"max": 10}),
    "dept_name": ("str", True, {"max": 100}),
}

SEMESTER_RULES = {
    "semester_number": ("int", True, {"min": 1, "max": 8}),
    "academic_year": ("str", True, {"max": 9, "pattern": r"^\d{4}-\d{4}$",
                                    "pattern_msg": "Use the format 2026-2027"}),
    "start_date": ("date", True),
    "end_date": ("date", True),
    "is_current": ("bool", False),
}

COURSE_RULES = {
    "course_code": ("str", True, {"max": 15}),
    "course_name": ("str", True, {"max": 120}),
    "credits": ("int", False, {"min": 1, "max": 6}),
    "department_id": ("int", True, {"min": 1}),
    "semester_id": ("int", True, {"min": 1}),
    "faculty_id": ("int", False, {"min": 1, "nullable": True}),
    "max_seats": ("int", False, {"min": 1, "max": 1000}),
}

EXAM_RULES = {
    "course_id": ("int", True, {"min": 1}),
    "exam_name": ("str", True, {"max": 80}),
    "exam_type": ("enum", True, {"choices": ["internal", "midterm", "final", "assignment"]}),
    "exam_date": ("date", True),
    "max_marks": ("decimal", True, {"min": Decimal("1"), "max": Decimal("999.99")}),
}
