"""Flask application entry point.   Run:  python app.py"""
import datetime
import decimal
import logging

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

from config.config import Config
from database import query_one
from errors import register_error_handlers
from routes import register_blueprints

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class AppJSONProvider(DefaultJSONProvider):
    """Send DECIMAL columns as numbers and dates as ISO strings (YYYY-MM-DD)."""

    @staticmethod
    def default(o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, datetime.datetime):
            return o.isoformat(sep=" ", timespec="seconds")
        if isinstance(o, datetime.date):
            return o.isoformat()
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.json = AppJSONProvider(app)

    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    register_blueprints(app)
    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        query_one("SELECT 1 AS ok")  # raises -> 503 handler if MySQL is unreachable
        return jsonify({"status": "ok", "database": Config.DB_NAME})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
