"""Data access for students (a student = a users row + a students row)."""
from database import db_cursor, query_all, query_one, ensure_unique
from errors import ApiError
from models.user_model import ensure_email_free, hash_password

BASE_SQL = """
SELECT s.student_id, s.user_id, s.roll_number, s.first_name, s.last_name,
       CONCAT(s.first_name, ' ', s.last_name) AS full_name,
       s.date_of_birth, s.gender, s.phone, s.address,
       s.department_id, d.dept_name, s.current_semester, s.admission_year, s.status,
       u.email, u.is_active
FROM students s
JOIN users u       ON u.user_id = s.user_id
JOIN departments d ON d.department_id = s.department_id
"""


def list_students(search=None, department_id=None, status=None):
    sql, params = BASE_SQL + " WHERE 1=1", []
    if search:
        like = f"%{search}%"
        sql += (" AND (s.roll_number LIKE %s OR s.first_name LIKE %s OR s.last_name LIKE %s"
                " OR CONCAT(s.first_name, ' ', s.last_name) LIKE %s OR u.email LIKE %s)")
        params += [like] * 5
    if department_id:
        sql += " AND s.department_id = %s"
        params.append(department_id)
    if status:
        sql += " AND s.status = %s"
        params.append(status)
    return query_all(sql + " ORDER BY s.roll_number", params)


def get_student(student_id):
    return query_one(BASE_SQL + " WHERE s.student_id = %s", (student_id,))


def get_student_by_user(user_id):
    return query_one(BASE_SQL + " WHERE s.user_id = %s", (user_id,))


def create_student(clean, email, password):
    ensure_email_free(email)
    ensure_unique("students", "roll_number", clean["roll_number"], message="Roll number already exists")
    with db_cursor(commit=True) as cur:
        cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s, %s, 'student')",
                    (email, hash_password(password)))
        user_id = cur.lastrowid
        cols = ["user_id", *clean.keys()]
        cur.execute(
            f"INSERT INTO students ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            [user_id, *clean.values()])
        return cur.lastrowid


def update_student(student_id, clean, email=None, password=None):
    student = get_student(student_id)
    if not student:
        raise ApiError("Student not found", 404)
    if "roll_number" in clean:
        ensure_unique("students", "roll_number", clean["roll_number"], "student_id", student_id,
                      "Roll number already exists")
    if email:
        ensure_email_free(email, student["user_id"])
    with db_cursor(commit=True) as cur:
        if clean:
            sets = ", ".join(f"{col}=%s" for col in clean)
            cur.execute(f"UPDATE students SET {sets} WHERE student_id=%s", [*clean.values(), student_id])
        if email:
            cur.execute("UPDATE users SET email=%s WHERE user_id=%s", (email, student["user_id"]))
        if password:
            cur.execute("UPDATE users SET password_hash=%s WHERE user_id=%s",
                        (hash_password(password), student["user_id"]))


def delete_student(student_id):
    """Deleting the login row cascades to the student, enrollments, attendance, marks and grades."""
    student = get_student(student_id)
    if not student:
        raise ApiError("Student not found", 404)
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM users WHERE user_id=%s", (student["user_id"],))
