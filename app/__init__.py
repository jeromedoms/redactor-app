from flask import Flask
import os

def create_app():
    # Explicitly set static folder at app level
    app = Flask(__name__, 
                static_folder='static',
                static_url_path='/static',
                template_folder='templates')
    
    from .routes import bp
    app.register_blueprint(bp)
    
    return app