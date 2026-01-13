import os
import time
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from data_processor import DataAnalyzer
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder="../frontend/static", template_folder="../frontend/templates")

# Load environment variables
load_dotenv()
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'csv,xlsx').split(','))

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit

# Performance monitoring
@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    duration = (time.time() - request.start_time) * 1000
    logging.info(f"Request took {duration:.2f}ms")
    return response

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def serve_index():
    return send_from_directory('../frontend/templates', 'index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    # Save in chunks
    filename = secure_filename(file.filename)
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_' + filename)
    
    try:
        chunk_size = 4096  # 4KB chunks
        with open(temp_path, 'wb') as f:
            while True:
                chunk = file.stream.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
        
        # Process the file
        analyzer = DataAnalyzer(temp_path)
        analysis = analyzer.generate_report()
        
        # Rename temp file to final name
        final_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.rename(temp_path, final_path)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'analysis': analysis
        })
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ... (keep other routes the same)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)