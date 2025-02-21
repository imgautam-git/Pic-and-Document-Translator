from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from PIL import Image, ImageEnhance
import cv2
import numpy as np
import pytesseract
import joblib
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast
import warnings
import time  # Add this at the top

os.environ["TRANSFORMERS_OFFLINE"] = "1"


warnings.filterwarnings("ignore", category=FutureWarning, message="`resume_download` is deprecated")

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'bmp'}

# Load language detection model and vectorizer
model_path = "Nep_Eng_language_detection_model.joblib"
vectorizer_path = "vectorizer.joblib"
language_model = joblib.load(model_path)
vectorizer = joblib.load(vectorizer_path)

# Load translation model
model_name = "khadak-2002/results"
tokenizer = MBart50TokenizerFast.from_pretrained(model_name, local_files_only=True)
model = MBartForConditionalGeneration.from_pretrained(model_name, local_files_only=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def preprocess_image(image_path):
    try:
        image = Image.open(image_path)
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, threshold = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        denoised = cv2.fastNlMeansDenoising(threshold, h=10)
        processed_image = Image.fromarray(denoised)
        enhancer = ImageEnhance.Contrast(processed_image)
        return enhancer.enhance(2.0)
    except Exception:
        return None

def detect_language(text):
    try:
        text_vec = vectorizer.transform([text])
        detected_lang = language_model.predict(text_vec)[0]
        return detected_lang
    except Exception:
        return None

def translate_text(text, direction):
    try:
        if direction == "ne_to_en":
            tokenizer.src_lang = "ne_NP"
            tokenizer.tgt_lang = "en_XX"
        else:
            tokenizer.src_lang = "en_XX"
            tokenizer.tgt_lang = "ne_NP"

        inputs = tokenizer(text, return_tensors="pt", max_length=512, truncation=True)
        translated_tokens = model.generate(**inputs, forced_bos_token_id=tokenizer.lang_code_to_id[tokenizer.tgt_lang])
        return tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
    except Exception:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        processed_img = preprocess_image(filepath)
        if not processed_img:
            return jsonify({'error': 'Image processing failed'}), 500

        extracted_text = pytesseract.image_to_string(processed_img, lang='nep+eng')
        if not extracted_text.strip():
            return jsonify({'error': 'No text found in image'}), 400

        detected_language = detect_language(extracted_text)
        return jsonify({'filename': filename, 'detected_language': detected_language, 'extracted_text': extracted_text}), 200
    
    return jsonify({'error': 'File type not allowed'}), 400


@app.route('/translate', methods=['POST'])
def translate():
    data = request.json
    filename = data.get('filename')
    direction = data.get('direction')
    detected_language = data.get('detected_language')

    if not filename or not direction or not detected_language:
        return jsonify({'error': 'Missing data'}), 400

    if (detected_language == "nepali" and direction == "en_to_ne") or (detected_language == "english" and direction == "ne_to_en"):
        return jsonify({'error': 'Invalid translation direction for detected language'}), 400

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    processed_img = preprocess_image(filepath)
    extracted_text = pytesseract.image_to_string(processed_img, lang='nep+eng')

    time.sleep(3)  # Simulate translation delay

    translated_text = translate_text(extracted_text, direction)
    if not translated_text:
        return jsonify({'error': 'Translation failed'}), 500

    return jsonify({'translated_text': translated_text}), 200


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
