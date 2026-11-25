"""One place that turns exceptions into clean JSON responses with proper status codes."""
import logging

import pymysql
from flask import jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger(__name__)


class ApiError(Exception):
    """Raise anywhere in a route to return a JSON error."""

    def __init__(self, message, status=400, errors=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.errors = errors or {}


def _json_error(message, status, errors=None):
    body = {"message": message}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return _json_error(err.message, err.status, err.errors)

    @app.errorhandler(pymysql.MySQLError)
    def handle_db_error(err):
        code = err.args[0] if err.args and isinstance(err.args[0], int) else 0
        text = err.args[1] if len(err.args) > 1 else str(err)
        if code == 1062:
            return _json_error("A record with the same unique value already exists.", 409)
        if code == 1451:
            return _json_error("Cannot delete: this record is still used by other records.", 409)
        if code == 1452:
            return _json_error("A referenced record (department, course, student...) does not exist.", 400)
        if code in (1048, 1364):
            return _json_error("A required value is missing.", 400)
        if code == 3819:
            return _json_error("A value violates a data rule (check constraint).", 400)
        if code in (1264, 1292, 1366, 1406):
            return _json_error("One of the values is invalid or too long.", 400)
        if code == 1644:  # SIGNAL raised by our triggers (e.g. "Course is full")
            return _json_error(str(text), 400)
        if code in (2002, 2003, 2006, 2013, 1045, 1049):
            log.error("Database unavailable: %s", err)
            return _json_error("Database connection failed. Check backend/.env and that MySQL is running.", 503)
        log.exception("Unhandled database error")
        return _json_error("A database error occurred.", 500)

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        return _json_error(err.description or err.name, err.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        log.exception("Unhandled error")
        return _json_error("Internal server error.", 500)
