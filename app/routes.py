from flask import Blueprint, render_template, send_from_directory, current_app
import os

# added static_folder and static_url_path to the Blueprint
bp = Blueprint("main", __name__, 
               static_folder='static',
               static_url_path='/static',
               template_folder='templates')

@bp.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@bp.route("/favicon.ico")
def favicon():
    # Use blueprint's static folder
    return send_from_directory(
        os.path.join(bp.root_path, 'static', 'icon'),
        "favicon-32x32.png",
        mimetype="image/png"
    )