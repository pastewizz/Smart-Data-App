import os
import time
import uuid
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

# In-memory file tracking (replace with database in production)
file_tracker = {}

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
    return send_from_directory('../frontend', 'index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    # Generate unique file ID and names
    filename = secure_filename(file.filename)
    file_id = str(uuid.uuid4())
    final_filename = f"{file_id}_{filename}"
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{final_filename}")
    final_path = os.path.join(app.config['UPLOAD_FOLDER'], final_filename)

    try:
        # Save the file in chunks (4KB)
        chunk_size = 4096
        with open(temp_path, 'wb') as f:
            while True:
                chunk = file.stream.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)

        # Rename to final path
        os.rename(temp_path, final_path)

        # Store metadata
        file_tracker[file_id] = {
            'original_name': filename,
            'path': final_path,
            'columns': get_columns(final_path)
        }

        # Analyze the file
        analyzer = DataAnalyzer(final_path)
        analysis = analyzer.generate_report()

        # Return success response
        return jsonify({
            'success': True,
            'filename': final_filename,  # full saved file name
            'file_id': file_id,
            'available_columns': file_tracker[file_id]['columns'],
            'analysis': analysis
        })

    except Exception as e:
        # Cleanup if something went wrong
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500



@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        file_id = data.get('file_id')   # This is actually the saved filename like: 'uuid_filename.csv'
        operation = data.get('operation')
        columns = data.get('columns')

        if not file_id or not operation:
            return jsonify({'success': False, 'error': 'Missing file_id or operation'}), 400

        # Build full path to the file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_id)

        # Check if the file actually exists
        if not os.path.exists(file_path):
            logging.warning(f"Requested file not found: {file_path}")
            return jsonify({'success': False, 'error': 'File not found'}), 404

        # Load analyzer on file
        analyzer = DataAnalyzer(file_path)

        # Perform the requested operation
        if operation == 'basic_stats':
            try:
                result = {
                    'numeric_summary': analyzer.basic_statistics(columns).get('numeric_summary', {}),
                    'categorical_summary': analyzer.categorical_summary(columns),
                    'text_summary': analyzer.text_summary(columns),
                    'datetime_summary': analyzer.datetime_summary(columns)
                }
            except Exception as e:
                logging.error(f"Error generating basic stats: {str(e)}")
                return jsonify({'success': False, 'error': 'Failed to compute basic statistics'}), 500

        elif operation == 'outliers':
            result = analyzer.detect_outliers(columns)
        elif operation == 'correlations':
            result = analyzer.correlation_analysis(columns)
        elif operation == 'histogram':
            result = analyzer.generate_histogram(columns)
        elif operation == 'scatter_plot':
            numeric_cols = analyzer.detect_data_types().get('numeric', [])
            if len(numeric_cols) >= 2:
                result = analyzer.generate_scatter_data(numeric_cols[0], numeric_cols[1])
            else:
                result = {'error': 'Not enough numeric columns for scatter plot'}
        elif operation == 'data_quality':
            result = analyzer.data_quality_report(columns)
        elif operation == 'insights':
            result = analyzer.generate_insights(columns)
        else:
            return jsonify({'success': False, 'error': f'Unsupported operation: {operation}'}), 400

        return jsonify({'success': True, 'result': result})

    except Exception as e:
        logging.error(f"Analysis error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_columns(file_path):
    """Helper function to get available columns from a file"""
    try:
        analyzer = DataAnalyzer(file_path)
        return analyzer.get_columns()  # You'll need to implement this in DataAnalyzer
    except:
        return []

if __name__ == '__main__':
    logging.info(f"Starting Smart Data App Server...")
    logging.info(f"Upload folder path: {os.path.abspath(UPLOAD_FOLDER)}")
    logging.info(f"Access the application at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)