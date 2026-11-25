"""Data access for faculty (a faculty member = a users row + a faculty row)."""
from database import db_cursor, query_all, query_one, ensure_unique
from errors import ApiError
from models.user_model import ensure_email_free, hash_password

BASE_SQL = """
SELECT f.faculty_id, f.user_id, f.employee_code, f.first_name, f.last_name,
       CONCAT(f.first_name, ' ', f.last_name) AS full_name,
       f.phone, f.designation, f.department_id, d.dept_name, f.joining_date,
       u.email, u.is_active,
       (SELECT COUNT(*) FROM courses c WHERE c.faculty_id = f.faculty_id) AS course_count
FROM faculty f
JOIN users u       ON u.user_id = f.user_id
JOIN departments d ON d.department_id = f.department_id
"""


def list_faculty(search=None, department_id=None):
    sql, params = BASE_SQL + " WHERE 1=1", []
    if search:
        like = f"%{search}%"
        sql += (" AND (f.employee_code LIKE %s OR f.first_name LIKE %s OR f.last_name LIKE %s"
                " OR CONCAT(f.first_name, ' ', f.last_name) LIKE %s OR u.email LIKE %s)")
        params += [like] * 5
    if department_id:
        sql += " AND f.department_id = %s"
        params.append(department_id)
    return query_all(sql + " ORDER BY f.employee_code", params)


def get_faculty(faculty_id):
    return query_one(BASE_SQL + " WHERE f.faculty_id = %s", (faculty_id,))


def get_faculty_by_user(user_id):
    return query_one(BASE_SQL + " WHERE f.user_id = %s", (user_id,))


def create_faculty(clean, email, password):
    ensure_email_free(email)
    ensure_unique("faculty", "employee_code", clean["employee_code"], message="Employee code already exists")
    with db_cursor(commit=True) as cur:
        cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s, %s, 'faculty')",
                    (email, hash_password(password)))
        user_id = cur.lastrowid
        cols = ["user_id", *clean.keys()]
        cur.execute(
            f"INSERT INTO faculty ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            [user_id, *clean.values()])
        return cur.lastrowid


def update_faculty(faculty_id, clean, email=None, password=None):
    member = get_faculty(faculty_id)
    if not member:
        raise ApiError("Faculty member not found", 404)
    if "employee_code" in clean:
        ensure_unique("faculty", "employee_code", clean["employee_code"], "faculty_id", faculty_id,
                      "Employee code already exists")
    if email:
        ensure_email_free(email, member["user_id"])
    with db_cursor(commit=True) as cur:
        if clean:
            sets = ", ".join(f"{col}=%s" for col in clean)
            cur.execute(f"UPDATE faculty SET {sets} WHERE faculty_id=%s", [*clean.values(), faculty_id])
        if email:
            cur.execute("UPDATE users SET email=%s WHERE user_id=%s", (email, member["user_id"]))
        if password:
            cur.execute("UPDATE users SET password_hash=%s WHERE user_id=%s",
                        (hash_password(password), member["user_id"]))


def delete_faculty(faculty_id):
    """Courses taught by this faculty member stay and become 'unassigned' (ON DELETE SET NULL)."""
    member = get_faculty(faculty_id)
    if not member:
        raise ApiError("Faculty member not found", 404)
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM users WHERE user_id=%s", (member["user_id"],))
