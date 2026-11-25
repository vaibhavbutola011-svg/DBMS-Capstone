"""MySQL connectivity (PyMySQL) and small query helpers.

A short-lived connection is opened per operation, which is simple and plenty for a
college project. Every query uses %s placeholders, so user input is never
concatenated into SQL (this prevents SQL injection).
"""
from contextlib import contextmanager

import pymysql
from pymysql.constants import CLIENT
from pymysql.cursors import DictCursor

from config.config import Config
from errors import ApiError


def get_connection():
    return pymysql.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        client_flag=CLIENT.FOUND_ROWS,  # rowcount = rows matched, so "0" really means not found
    )


@contextmanager
def db_cursor(commit=False):
    """Yield a cursor. With commit=True everything inside is ONE transaction:
    committed on success, rolled back if anything raises."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query_all(sql, params=None):
    with db_cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def query_one(sql, params=None):
    with db_cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()


def execute(sql, params=None):
    """Run one write statement; returns the number of matched rows."""
    with db_cursor(commit=True) as cur:
        cur.execute(sql, params or ())
        return cur.rowcount


def insert_row(table, fields):
    cols = list(fields.keys())
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})"
    with db_cursor(commit=True) as cur:
        cur.execute(sql, list(fields.values()))
        return cur.lastrowid


def update_row(table, pk_col, pk_val, fields):
    if not fields:
        return 1
    sets = ", ".join(f"{col}=%s" for col in fields)
    with db_cursor(commit=True) as cur:
        cur.execute(f"UPDATE {table} SET {sets} WHERE {pk_col}=%s", [*fields.values(), pk_val])
        return cur.rowcount


def delete_row(table, pk_col, pk_val):
    return execute(f"DELETE FROM {table} WHERE {pk_col}=%s", (pk_val,))


def ensure_unique(table, column, value, pk_col=None, pk_val=None, message=None):
    """Friendly duplicate check before INSERT/UPDATE (the UNIQUE index is still the real guard)."""
    if value is None:
        return
    sql = f"SELECT 1 AS hit FROM {table} WHERE {column}=%s"
    params = [value]
    if pk_col is not None and pk_val is not None:
        sql += f" AND {pk_col}<>%s"
        params.append(pk_val)
    if query_one(sql, params):
        msg = message or f"{column.replace('_', ' ').capitalize()} already exists"
        raise ApiError(msg, 409, {column: msg})
