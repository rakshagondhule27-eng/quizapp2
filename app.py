from flask import Flask, render_template, request, jsonify, session
import google.generativeai as genai
import json
import os
import re

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "quiz_secret_key_change_this")

# Configure Gemini API Key (looks at GEMINI_API_KEY or GOOGLE_API_KEY)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", os.environ.get("GOOGLE_API_KEY", "AQ.Ab8RN6ISO8_faHSleXuBIxl6Nv6sG--FZf2FSYEDQeLJ26vmHA"))

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Use a valid model (defaults to gemini-1.5-flash if GEMINI_MODEL is not set)
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
model = genai.GenerativeModel(MODEL_NAME)


def generate_questions(paragraph):
    prompt = f"""
You are a quiz generator. Read the paragraph below and generate 5 quiz questions.
Mix of MCQ (4 options) and True/False questions.
Return ONLY a valid JSON array. No markdown, no explanation, no extra text.

Format:
[
  {{
    "type": "mcq",
    "question": "Question text here?",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "answer": "A. option1"
  }},
  {{
    "type": "truefalse",
    "question": "Statement here.",
    "options": ["True", "False"],
    "answer": "True"
  }}
]

Paragraph:
{paragraph}
"""
    # Use response_mime_type to enforce JSON output if supported by client
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
    except Exception:
        # Fallback for client/older versions that don't support response_mime_type configuration parameter
        response = model.generate_content(prompt)
        
    raw = response.text.strip()
    # Remove markdown code blocks if present
    raw = re.sub(r"```json|```", "", raw).strip()
    
    try:
        questions = json.loads(raw)
    except Exception as e:
        raise ValueError(f"Failed to parse model response as JSON. Raw response: {raw}. Error: {str(e)}")
        
    return questions


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    paragraph = data.get("paragraph", "").strip()
    if not paragraph:
        return jsonify({"error": "No paragraph provided"}), 400
    try:
        questions = generate_questions(paragraph)
        session["questions"] = questions
        return jsonify({"success": True, "total": len(questions)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500





@app.route("/upload-image", methods=["POST"])
def upload_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No image selected"}), 400
        
    try:
        from PIL import Image
        import io
        
        # Open file as image
        img = Image.open(io.BytesIO(file.read()))
        
        # Send prompt and image to Gemini model for OCR transcription
        ocr_prompt = "Transcribe all text from this image as a single continuous paragraph. Return only the extracted text, with no preamble, explanations, or markdown code block syntax."
        response = model.generate_content([ocr_prompt, img])
        paragraph = response.text.strip()
        
        if not paragraph or len(paragraph) < 30:
            return jsonify({"error": "Failed to extract enough text from the image. Please upload a clearer image containing text."}), 400
            
        # Generate the questions from the extracted text
        questions = generate_questions(paragraph)
        session["questions"] = questions
        
        return jsonify({"success": True, "total": len(questions)})
        
    except Exception as e:
        return jsonify({"error": f"OCR/Generation failed: {str(e)}"}), 500


@app.route("/question/<int:index>")
def get_question(index):
    questions = session.get("questions", [])
    if index >= len(questions):
        return jsonify({"done": True})
    q = questions[index]
    return jsonify({
        "done": False,
        "index": index,
        "total": len(questions),
        "type": q["type"],
        "question": q["question"],
        "options": q["options"]
    })


@app.route("/answer", methods=["POST"])
def check_answer():
    data = request.get_json() or {}
    index = data.get("index")
    user_answer = data.get("answer")
    questions = session.get("questions", [])
    
    if index is None or not questions or index < 0 or index >= len(questions):
        return jsonify({"error": "Invalid question index or questions not generated"}), 400
        
    correct = questions[index].get("answer", "")
    user_answer_str = str(user_answer or "").strip().lower()
    correct_str = str(correct or "").strip().lower()
    
    is_correct = user_answer_str == correct_str
    return jsonify({"correct": is_correct, "correct_answer": correct})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=True, port=port)
