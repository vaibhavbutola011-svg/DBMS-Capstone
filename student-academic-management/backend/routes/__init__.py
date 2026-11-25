def register_blueprints(app):
    from routes.auth_routes import bp as auth_bp
    from routes.student_routes import bp as student_bp
    from routes.faculty_routes import bp as faculty_bp
    from routes.department_routes import bp as department_bp
    from routes.course_routes import bp as course_bp
    from routes.enrollment_routes import bp as enrollment_bp
    from routes.attendance_routes import bp as attendance_bp
    from routes.exam_routes import bp as exam_bp
    from routes.report_routes import bp as report_bp

    for blueprint in (auth_bp, student_bp, faculty_bp, department_bp, course_bp,
                      enrollment_bp, attendance_bp, exam_bp, report_bp):
        app.register_blueprint(blueprint)
