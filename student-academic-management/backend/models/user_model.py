"""Data access for the users table."""
from werkzeug.security import generate_password_hash

from database import query_one, ensure_unique


def get_user_by_email(email):
    return query_one("SELECT * FROM users WHERE email=%s", (email,))


def get_user_by_id(user_id):
    return query_one("SELECT * FROM users WHERE user_id=%s", (user_id,))


def ensure_email_free(email, exclude_user_id=None):
    ensure_unique("users", "email", email, "user_id", exclude_user_id, "This email is already registered")


def hash_password(password):
    return generate_password_hash(password, method="pbkdf2:sha256")
