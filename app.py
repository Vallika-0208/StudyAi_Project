import os
import sys
import requests
import io
import uuid
import json
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pypdf import PdfReader
import docx

# Try importing firebase_admin for Firestore storage
firebase_initialized = False
db = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    cred_path = os.environ.get("FIREBASE_CREDENTIALS", "firebase-credentials.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        firebase_initialized = True
        print("Firebase Firestore initialized successfully.")
    else:
        try:
            firebase_admin.initialize_app()
            db = firestore.client()
            firebase_initialized = True
            print("Firebase Firestore initialized successfully with default credentials.")
        except Exception as e_default:
            print(f"Firebase credentials file (firebase-credentials.json) not found and default initialization failed ({e_default}). Falling back to local storage.")
except Exception as e:
    print(f"Firebase initialization skipped or failed: {str(e)}. Falling back to local storage.")

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# Read Groq API key from environment
api_key = os.environ.get("GROQ_API_KEY")

# Local Storage Database Configuration
LOCAL_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

def ensure_local_db():
    if not os.path.exists(LOCAL_DB_DIR):
        os.makedirs(LOCAL_DB_DIR)

def get_local_data(filename):
    ensure_local_db()
    path = os.path.join(LOCAL_DB_DIR, filename)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading local JSON db {filename}: {e}")
        return {}

def save_local_data(filename, data):
    ensure_local_db()
    path = os.path.join(LOCAL_DB_DIR, filename)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error writing to local JSON db {filename}: {e}")
        return False

def save_db_item(collection, item_id, item_data):
    if firebase_initialized and db:
        try:
            db.collection(collection).document(item_id).set(item_data)
            return True
        except Exception as e:
            print(f"Error writing to Firestore collection '{collection}': {e}. Attempting local write.")
            
    local_file = f"{collection}.json"
    local_data = get_local_data(local_file)
    local_data[item_id] = item_data
    return save_local_data(local_file, local_data)

def get_db_item(collection, item_id):
    if firebase_initialized and db:
        try:
            doc = db.collection(collection).document(item_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Error reading from Firestore collection '{collection}': {e}. Checking local database.")
            
    local_file = f"{collection}.json"
    local_data = get_local_data(local_file)
    return local_data.get(item_id)

def list_db_items(collection):
    if firebase_initialized and db:
        try:
            docs = db.collection(collection).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error listing Firestore collection '{collection}': {e}. Reading local database.")
            
    local_file = f"{collection}.json"
    local_data = get_local_data(local_file)
    return list(local_data.values())

def save_material(material_id, text, filename):
    material_data = {
        "id": material_id,
        "filename": filename,
        "text": text,
        "timestamp": datetime.datetime.now().isoformat()
    }
    return save_db_item("materials", material_id, material_data)

def get_material(material_id):
    return get_db_item("materials", material_id)

def extract_text_from_file(file_bytes, filename):
    ext = filename.split(".")[-1].lower()
    if ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    elif ext == "pdf":
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
        except Exception as g_pdf:
            raise ValueError(f"Failed to parse PDF: {str(g_pdf)}")
    elif ext in ["docx", "doc"]:
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX: {str(e)}")
    else:
        raise ValueError(f"Unsupported file format: .{ext}")

# Helper to communicate directly with Groq API via requests (Bypassing bug)
def call_groq_api(messages, temperature=0.7, max_tokens=1024, response_format=None):
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        raise ValueError("Groq API Key is not configured.")
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    if response_format:
        payload["response_format"] = response_format

    # Render proxy bypass for direct request
    response = requests.post(url, headers=headers, json=payload, proxies={"http": "", "https": ""})
    
    if response.status_code != 200:
        raise Exception(f"Groq API Error {response.status_code}: {response.text}")
        
    return response.json()["choices"][0]["message"]["content"]


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "groq_configured": bool(os.environ.get("GROQ_API_KEY")),
        "firebase_configured": firebase_initialized,
        "model": "llama-3.3-70b-versatile",
        "message": "Flask backend bypassing library bugs successfully!"
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    messages = data.get("messages")
    prompt = data.get("prompt")

    if not messages and not prompt:
        return jsonify({"error": "Missing 'messages' or 'prompt' in request body"}), 400

    if not messages:
        messages = [{"role": "user", "content": prompt}]

    system_msg = {
        "role": "system",
        "content": (
            "You are an encouraging, highly knowledgeable AI Study Coach named StudyAI Coach. "
            "Your goal is to help students master their courses. "
            "Explain complex concepts simply, use analogies, and break down problems step-by-step. "
            "Be conversational, concise, and structured. "
            "At the very end of your response, always provide exactly 3 suggested follow-up questions "
            "that the student might want to ask next, prefixed exactly with the text 'Suggested Questions:' and one per line."
        )
    }
    full_messages = [system_msg] + messages

    try:
        response_text = call_groq_api(full_messages, temperature=0.7, max_tokens=1024)
        return jsonify({
            "response": response_text,
            "model": "llama-3.3-70b-versatile"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to communicate with Groq API: {str(e)}"}), 500


@app.route("/api/upload-material", methods=["POST"])
def upload_material():
    text = ""
    filename = ""
    if "file" in request.files:
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Selected file has no name"}), 400
        filename = file.filename
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 10 * 1024 * 1024:
            return jsonify({"error": "File size exceeds 10MB limit."}), 400
        try:
            file_bytes = file.read()
            text = extract_text_from_file(file_bytes, filename)
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to parse uploaded file: {str(e)}"}), 400
    else:
        data = request.json or {}
        text = data.get("text")
        filename = data.get("filename", "manual_input.txt")
        if not text:
            return jsonify({"error": "No file uploaded or manual text content provided"}), 400

    material_id = str(uuid.uuid4())
    success = save_material(material_id, text, filename)
    if not success:
        return jsonify({"error": "Failed to save material to database"}), 500

    return jsonify({
        "id": material_id,
        "filename": filename,
        "preview": text[:1000] + ("..." if len(text) > 1000 else ""),
        "length": len(text),
        "storage": "firestore" if (firebase_initialized and db) else "local_json"
    })


@app.route("/api/generate-summary", methods=["POST"])
def generate_summary():
    data = request.json or {}
    material_id = data.get("material_id")
    text = data.get("text")

    if material_id:
        material = get_material(material_id)
        if not material:
            return jsonify({"error": f"Material ID {material_id} not found"}), 404
        text = material.get("text")

    if not text or not text.strip():
        return jsonify({"error": "No text content found to summarize"}), 400

    try:
        system_prompt = (
            "You are an expert academic tutor. Generate a highly structured study summary based on the text provided by the user. "
            "The summary MUST contain sections: # Topic Overview, # Key Concepts, # Definitions, # Important Formula Sheet, # Bullet Point Notes, # Revision Notes, # Exam Tips."
        )
        msgs = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        summary = call_groq_api(msgs, temperature=0.5, max_tokens=2560)
        return jsonify({
            "summary": summary,
            "model": "llama-3.3-70b-versatile"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate summary: {str(e)}"}), 500


@app.route("/api/generate-quiz", methods=["POST"])
def generate_quiz():
    data = request.json or {}
    material_id = data.get("material_id")
    text = data.get("text")
    difficulty = data.get("difficulty", "medium")
    num_questions = int(data.get("num_questions", 5))
    quiz_type = data.get("quiz_type", "mcq")

    if material_id:
        material = get_material(material_id)
        if not material:
            return jsonify({"error": f"Material ID {material_id} not found"}), 404
        text = material.get("text")

    if not text:
        return jsonify({"error": "Missing 'text' or 'material_id' in request body"}), 400

    try:
        # ఇక్కడ మనం ప్రాంప్ట్‌ని చాలా స్ట్రిక్ట్‌గా మారుస్తున్నాం
        system_prompt = (
            f"You are an expert educator. Your task is to generate a JSON object containing a single key 'quiz'.\n"
            f"The 'quiz' value must be a list of exactly {num_questions} questions based on the text provided.\n"
            f"The quiz difficulty must be {difficulty} level.\n"
            f"The quiz format must be {quiz_type}.\n"
        )
        if quiz_type == "mcq":
            system_prompt += "- Each question must have 'question' (string), 'options' (array of 4 strings), and 'answer' (string matching exactly one option).\n"
        elif quiz_type == "tf":
            system_prompt += "- Each question must have 'question' (string), 'options': ['True', 'False'], and 'answer': 'True' or 'False'.\n"
        elif quiz_type == "short":
            system_prompt += "- Each question must have 'question' (string) and 'answer' (brief answer string).\n"
            
        # మోడల్ ఎక్స్‌ట్రా సోది రాయకుండా ఉండేలా ఆఖరి వార్నింగ్
        system_prompt += "\nCRITICAL: Do NOT include any introductory text, conversation, or explanations outside the JSON object. Return ONLY the raw valid JSON object starting with { and ending with }."
        
        msgs = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        raw_response = call_groq_api(msgs, temperature=0.5, max_tokens=2048, response_format={"type": "json_object"})
        quiz_data = json.loads(raw_response)
        return jsonify(quiz_data)
    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500

@app.route("/api/generate-flashcards", methods=["POST"])
def generate_flashcards():
    data = request.json or {}
    material_id = data.get("material_id")
    text = data.get("text")

    if material_id:
        material = get_material(material_id)
        if not material:
            return jsonify({"error": f"Material ID {material_id} not found"}), 404
        text = material.get("text")

    if not text:
        return jsonify({"error": "Missing 'text' or 'material_id' in request body"}), 400

    try:
        # ఇక్కడ ప్రాంప్ట్‌ని స్ట్రిక్ట్‌గా మారుస్తున్నాం రా
        system_prompt = (
            "You are an expert tutor. Your task is to generate a JSON object containing a single key 'flashcards' with exactly 8 cards.\n"
            "Each card in the list must be an object with these exact keys: 'id', 'front', 'back', 'difficulty', 'topic'.\n"
            "CRITICAL: Do NOT include any introductory text, conversation, or explanations outside the JSON object. "
            "Return ONLY the raw valid JSON object starting with { and ending with }."
        )
        msgs = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        raw_response = call_groq_api(msgs, temperature=0.5, max_tokens=2048, response_format={"type": "json_object"})
        flash_data = json.loads(raw_response)
        return jsonify(flash_data)
    except Exception as e:
        return jsonify({"error": f"Failed to generate flashcards: {str(e)}"}), 500

@app.route("/api/generate-planner", methods=["POST"])
def generate_planner():
    data = request.json or {}
    material_id = data.get("material_id")
    text = data.get("text")

    if material_id:
        material = get_material(material_id)
        if not material:
            return jsonify({"error": f"Material ID {material_id} not found"}), 404
        text = material.get("text")

    if not text:
        return jsonify({"error": "Missing 'text' or 'material_id' in request body"}), 400

    try:
        system_prompt = "You are an expert academic advisor. Generate a JSON object containing a 'planner' key for 7 days."
        msgs = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        raw_response = call_groq_api(msgs, temperature=0.6, max_tokens=2048, response_format={"type": "json_object"})
        planner_data = json.loads(raw_response)
        save_db_item("planner", "current_plan", planner_data)
        return jsonify(planner_data)
    except Exception as e:
        return jsonify({"error": f"Failed to generate study planner: {str(e)}"}), 500


@app.route("/api/quiz-history", methods=["GET", "POST"])
def quiz_history():
    if request.method == "POST":
        data = request.json or {}
        data["id"] = str(uuid.uuid4())
        data["timestamp"] = datetime.datetime.now().isoformat()
        save_db_item("quiz_history", data["id"], data)
        return jsonify({"success": True, "id": data["id"]})
    else:
        items = list_db_items("quiz_history")
        items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return jsonify(items)


@app.route("/api/flashcards", methods=["GET", "POST"])
def flashcards():
    if request.method == "POST":
        data = request.json or {}
        deck_id = data.get("material_id") or "current_deck"
        data["id"] = deck_id
        data["timestamp"] = datetime.datetime.now().isoformat()
        save_db_item("flashcards", deck_id, data)
        return jsonify({"success": True, "id": deck_id})
    else:
        deck_id = request.args.get("material_id") or "current_deck"
        deck = get_db_item("flashcards", deck_id)
        return jsonify(deck or {})


@app.route("/api/planner", methods=["GET", "POST"])
def planner():
    if request.method == "POST":
        data = request.json or {}
        plan_id = "current_plan"
        data["id"] = plan_id
        data["timestamp"] = datetime.datetime.now().isoformat()
        save_db_item("planner", plan_id, data)
        return jsonify({"success": True})
    else:
        plan = get_db_item("planner", "current_plan")
        return jsonify(plan or {})


@app.route("/api/analytics", methods=["GET", "POST"])
def analytics():
    if request.method == "POST":
        data = request.json or {}
        analytics_id = "current_analytics"
        data["id"] = analytics_id
        data["timestamp"] = datetime.datetime.now().isoformat()
        save_db_item("analytics", analytics_id, data)
        return jsonify({"success": True})
    else:
        analytics_data = get_db_item("analytics", "current_analytics")
        if not analytics_data:
            analytics_data = {
                "weekly_hours": [2.0, 3.5, 1.5, 4.0, 3.0, 5.0, 2.5],
                "streak": 5,
                "total_study_time": 21.5,
                "flashcards_learned": 0
            }
        
        quizzes = list_db_items("quiz_history")
        quizzes.sort(key=lambda x: x.get("timestamp", ""))
        
        scores_trend = []
        total_score = 0
        total_questions = 0
        weak_topics = {}
        
        for q in quizzes:
            score = q.get("score", 0)
            total = q.get("total", 1)
            scores_trend.append(round((score / total) * 100))
            total_score += score
            total_questions += total
            
            for topic in q.get("weak_topics", []):
                weak_topics[topic] = weak_topics.get(topic, 0) + 1
        
        avg_score = round((total_score / total_questions) * 100) if total_questions > 0 else 0
        sorted_weak = sorted(weak_topics.items(), key=lambda x: x[1], reverse=True)
        weak_topics_list = [item[0] for item in sorted_weak[:5]]
        
        analytics_data["quiz_trend"] = scores_trend
        analytics_data["avg_score"] = avg_score
        analytics_data["weak_topics"] = weak_topics_list
        analytics_data["total_quizzes"] = len(quizzes)
        
        return jsonify(analytics_data)


@app.route("/api/generate-insights", methods=["POST"])
def generate_insights():
    data = request.json or {}
    avg_score = data.get("avg_score", 0)
    streak = data.get("streak", 0)
    prompt = f"Based on student analytics: Avg Score {avg_score}%, Streak {streak} days. Generate 3 tips."

    try:
        msgs = [{"role": "user", "content": prompt}]
        insights = call_groq_api(msgs, temperature=0.7, max_tokens=500)
        return jsonify({"insights": insights})
    except Exception as e:
        return jsonify({"error": f"Failed to generate AI insights: {str(e)}"}), 500


@app.route('/')
def home():
    return "Backend Server is Running Successfully on Render (Direct API Bypass Mode)!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
       
