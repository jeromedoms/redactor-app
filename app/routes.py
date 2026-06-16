from flask import Blueprint, render_template, send_from_directory, current_app
import os


bp = Blueprint("main", __name__)


@bp.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@bp.route("/favicon.ico")
def favicon():
    static_icon_dir = os.path.join(current_app.root_path, "static", "icon")
    return send_from_directory(
        static_icon_dir,
        "favicon-32x32.png",
        mimetype="image/png"
    )