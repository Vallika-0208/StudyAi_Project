import os
import os
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)
import io
import uuid
import json
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
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

# Enable CORS for all routes (configured to allow local web development origins)
# పాత లైన్ ని తీసేసి, యాప్ లో ఉన్న అన్ని రూట్లకు పర్మిషన్ ఇవ్వడానికి ఇలా మార్చండి:
CORS(app, resources={r"/*": {"origins": "*"}})

# Read Groq API key from environment
api_key = os.environ.get("GROQ_API_KEY")

# Local Storage Database Configuration
LOCAL_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

def ensure_local_db():
    """Ensure directory exists."""
    if not os.path.exists(LOCAL_DB_DIR):
        os.makedirs(LOCAL_DB_DIR)

def get_local_data(filename):
    """Read data from a local JSON file."""
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
    """Write data to a local JSON file."""
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
    """Save item to Firestore if active, otherwise local JSON file."""
    if firebase_initialized and db:
        try:
            db.collection(collection).document(item_id).set(item_data)
            return True
        except Exception as e:
            print(f"Error writing to Firestore collection '{collection}': {e}. Attempting local write.")
            
    # Save locally
    local_file = f"{collection}.json"
    local_data = get_local_data(local_file)
    local_data[item_id] = item_data
    return save_local_data(local_file, local_data)

def get_db_item(collection, item_id):
    """Retrieve item by ID from Firestore or local JSON file."""
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
    """List all items in a Firestore collection or local JSON file."""
    if firebase_initialized and db:
        try:
            docs = db.collection(collection).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error listing Firestore collection '{collection}': {e}. Reading local database.")
            
    local_file = f"{collection}.json"
    local_data = get_local_data(local_file)
    return list(local_data.values())

# Deprecated compatibility wrappers
def get_material_local(material_id):
    return get_db_item("materials", material_id)

def save_material_local(material_id, material_data):
    return save_db_item("materials", material_id, material_data)

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
    """Helper to extract text from PDF, DOCX, and TXT files."""
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
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")
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


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint to verify backend status and API configuration."""
    status = "healthy"
    has_api_key = bool(api_key)
    
    return jsonify({
        "status": status,
        "groq_configured": has_api_key,
        "firebase_configured": firebase_initialized,
        "model": "llama-3.3-70b-versatile",
        "message": "Flask backend is running successfully!"
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    """Chat endpoint to query LLaMA 3.3 via Groq API, styled as an academic coach."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

    data = request.json or {}
    messages = data.get("messages")
    prompt = data.get("prompt")

    if not messages and not prompt:
        return jsonify({"error": "Missing 'messages' or 'prompt' in request body"}), 400

    if not messages:
        messages = [{"role": "user", "content": prompt}]

    # Prepend a system message to guide LLaMA as a Study Coach
    system_msg = {
        "role": "system",
        "content": (
            "You are an encouraging, highly knowledgeable AI Study Coach named StudyAI Coach. "
            "Your goal is to help students master their courses. "
            "Explain complex concepts simply, use analogies, and break down problems step-by-step. "
            "Be conversational, concise, and structured. "
            "At the very end of your response, always provide exactly 3 suggested follow-up questions "
            "that the student might want to ask next, prefixed exactly with the text 'Suggested Questions:' and one per line, e.g.:\n"
            "Suggested Questions:\n"
            "1. Can you give me a real-world example of this?\n"
            "2. How does this connect to the main topic?\n"
            "3. Could you quiz me on this specific part?"
        )
    }

    full_messages = [system_msg] + messages

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=full_messages,
            temperature=0.7,
            max_tokens=1024,
        )
        response_text = completion.choices[0].message.content
        return jsonify({
            "response": response_text,
            "model": "llama-3.3-70b-versatile"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to communicate with Groq API: {str(e)}"}), 500


@app.route("/api/upload-material", methods=["POST"])
def upload_material():
    """Extracts text from PDF, DOCX, TXT or manual input and saves it under a unique ID."""
    text = ""
    filename = ""
    
    # Check if a file was uploaded via multipart/form-data
    if "file" in request.files:
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Selected file has no name"}), 400
        
        filename = file.filename
        
        # Check size: limit to 10MB
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
        # Check if text was pasted manually via JSON
        data = request.json or {}
        text = data.get("text")
        filename = data.get("filename", "manual_input.txt")
        
        if not text:
            return jsonify({"error": "No file uploaded or manual text content provided"}), 400

    # Save to storage (Firestore or local fallback JSON)
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
    """Generates a comprehensive study summary based on material_id or raw text using LLaMA 3.3."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

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
        client = Groq(api_key=api_key)
        system_prompt = (
            "You are an expert academic tutor. Generate a highly structured study summary based on the text provided by the user. "
            "The summary MUST contain the following sections in clean Markdown format:\n\n"
            "# Topic Overview\n"
            "Provide a concise, high-level overview of the topic.\n\n"
            "# Key Concepts\n"
            "Outline the primary key concepts using bullet points.\n\n"
            "# Definitions\n"
            "Define the major terms and concepts introduced in the text.\n\n"
            "# Important Formula Sheet\n"
            "List any mathematical formulas, chemical equations, or key quantitative relationships if applicable. "
            "If none are applicable, explicitly state 'No formulas applicable'.\n\n"
            "# Bullet Point Notes\n"
            "List key takeaways and core information in bullet points.\n\n"
            "# Revision Notes\n"
            "Write structured, easy-to-read revision notes.\n\n"
            "# Exam Tips\n"
            "Provide actionable exam tips, common pitfalls, and preparation recommendations.\n\n"
            "Do not include any conversational intro or outro text. Output only the markdown summary."
        )
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            max_tokens=2560
        )
        
        summary = completion.choices[0].message.content
        return jsonify({
            "summary": summary,
            "model": "llama-3.3-70b-versatile"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate summary: {str(e)}"}), 500


@app.route("/api/generate-quiz", methods=["POST"])
def generate_quiz():
    """Accepts text or material_id and generates a custom quiz with specific difficulty, quantity, and type."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

    data = request.json or {}
    material_id = data.get("material_id")
    text = data.get("text")
    difficulty = data.get("difficulty", "medium")
    num_questions = int(data.get("num_questions", 5))
    quiz_type = data.get("quiz_type", "mcq") # 'mcq' | 'tf' | 'short' | 'mixed'

    if material_id:
        material = get_material(material_id)
        if not material:
            return jsonify({"error": f"Material ID {material_id} not found"}), 404
        text = material.get("text")

    if not text:
        return jsonify({"error": "Missing 'text' or 'material_id' in request body"}), 400

    try:
        client = Groq(api_key=api_key)
        system_prompt = (
            f"You are an expert educator. Generate a JSON object containing a 'quiz' key.\n"
            f"The 'quiz' value must be a list of exactly {num_questions} questions based on the text provided by the user.\n"
            f"The quiz difficulty must be {difficulty} level.\n"
            f"The quiz format must be {quiz_type} (where 'mcq' means multiple choice questions, 'tf' means True/False questions, 'short' means short answer questions, and 'mixed' is a blend of all three).\n\n"
            f"Each question must be an object with the following keys:\n"
            f"- 'type': the question type ('mcq', 'tf', or 'short')\n"
            f"- 'question': the question text\n"
            f"- 'topic': a specific, short sub-topic category label (e.g. 'Photosynthesis', 'Mitosis', 'Newtonian Mechanics') for weak area tracking\n"
            f"- 'explanation': a brief explanation of the correct answer\n"
        )
        
        if quiz_type == "mcq":
            system_prompt += (
                "- 'options': an array of exactly 4 string options\n"
                "- 'answer': the correct answer, which must match one of the options exactly\n"
            )
        elif quiz_type == "tf":
            system_prompt += (
                "- 'options': ['True', 'False']\n"
                "- 'answer': the correct answer, which must be either 'True' or 'False'\n"
            )
        elif quiz_type == "short":
            system_prompt += (
                "- 'answer': a brief correct answer string or key points to compare against\n"
            )
        else: # mixed
            system_prompt += (
                "For mcq questions, include keys: 'options' (array of 4 strings) and 'answer' (matching one option exactly).\n"
                "For tf questions, include keys: 'options' (['True', 'False']) and 'answer' ('True' or 'False').\n"
                "For short questions, include key: 'answer' (model answer/key points).\n"
            )
            
        system_prompt += "\nOnly return the raw JSON object. Do not wrap in markdown code blocks."
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        raw_response = completion.choices[0].message.content
        quiz_data = json.loads(raw_response)
        return jsonify(quiz_data)
    except json.JSONDecodeError as je:
        return jsonify({"error": f"Failed to parse LLM response as JSON: {str(je)}", "raw": raw_response}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


@app.route("/api/generate-flashcards", methods=["POST"])
def generate_flashcards():
    """Accepts text or material_id and generates a list of 8 flashcards with difficulty and topics."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

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
        client = Groq(api_key=api_key)
        system_prompt = (
            "You are an expert tutor. Generate a JSON object containing a 'flashcards' key. "
            "The 'flashcards' value must be a list of exactly 8 flashcards based on the key concepts in the text provided. "
            "Each flashcard must be an object with the following keys:\n"
            "- 'id': a unique identifier string\n"
            "- 'front': a core concept, key term, or question\n"
            "- 'back': its explanation, definition, or answer\n"
            "- 'difficulty': default difficulty classification ('easy', 'medium', or 'hard')\n"
            "- 'topic': a short sub-topic category label\n"
            "Only return the raw JSON object. Do not wrap in markdown code blocks."
        )
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        raw_response = completion.choices[0].message.content
        flash_data = json.loads(raw_response)
        
        # Ensure cards have unique IDs
        if "flashcards" in flash_data:
            for idx, card in enumerate(flash_data["flashcards"]):
                if "id" not in card or not card["id"]:
                    card["id"] = f"fc-{uuid.uuid4().hex[:6]}-{idx}"
                    
        return jsonify(flash_data)
    except json.JSONDecodeError as je:
        return jsonify({"error": f"Failed to parse LLM response as JSON: {str(je)}", "raw": raw_response}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to generate flashcards: {str(e)}"}), 500


@app.route("/api/generate-planner", methods=["POST"])
def generate_planner():
    """Generates an intelligent 7-day study plan from study material using LLaMA 3.3."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

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
        client = Groq(api_key=api_key)
        system_prompt = (
            "You are an expert academic advisor. Generate a JSON object containing a 'planner' key.\n"
            "The 'planner' value must be an intelligent 7-day study plan based on the key topics in the text provided.\n"
            "Structure the plan as an array of exactly 7 objects (one for each day), with each object containing:\n"
            "- 'day': e.g. 'Day 1'\n"
            "- 'tasks': an array of study tasks, each task object containing:\n"
            "  - 'id': a unique string identifier\n"
            "  - 'task': the task description (specific, actionable, e.g., 'Review formula sheet for Newtonian equations')\n"
            "  - 'duration': study duration in minutes (e.g. 45)\n"
            "  - 'break_duration': break duration in minutes (e.g. 10)\n"
            "  - 'priority': 'High' | 'Medium' | 'Low'\n"
            "  - 'type': 'Study' | 'Revision' | 'Weak Topic Revision'\n"
            "  - 'completed': false (default boolean)\n"
            "- 'ai_tips': a list of 1 or 2 specific advice strings for that day's load\n\n"
            "Only return the raw JSON object. Do not wrap in markdown code blocks."
        )
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        raw_response = completion.choices[0].message.content
        planner_data = json.loads(raw_response)
        
        # Save to database
        save_db_item("planner", "current_plan", planner_data)
        
        return jsonify(planner_data)
    except json.JSONDecodeError as je:
        return jsonify({"error": f"Failed to parse LLM response as JSON: {str(je)}", "raw": raw_response}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to generate study planner: {str(e)}"}), 500


@app.route("/api/quiz-history", methods=["GET", "POST"])
def quiz_history():
    """Stores a quiz result or fetches history of past quizzes."""
    if request.method == "POST":
        data = request.json or {}
        # Expect keys: score, total, difficulty, quiz_type, weak_topics
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
    """Stores the flashcard deck state or fetches a deck."""
    if request.method == "POST":
        data = request.json or {}
        # Expect keys: material_id, cards_list, learned_card_ids
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
    """Stores the active study planner state or fetches the active plan."""
    if request.method == "POST":
        data = request.json or {}
        # Expect keys: planner_data (which matches the structure of generate-planner)
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
    """Manages study analytics data, blending saved records with automated aggregates."""
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
                "weekly_hours": [2.0, 3.5, 1.5, 4.0, 3.0, 5.0, 2.5],  # Mon-Sun default
                "streak": 5,
                "total_study_time": 21.5,
                "flashcards_learned": 0
            }
        
        # Calculate aggregates from quiz history
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
            
            # Extract weak topics from incorrect topic tags
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
    """Queries LLaMA 3.3 to construct study coach insights based on student analytics."""
    global api_key
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return jsonify({"error": "Groq API Key is not configured."}), 500

    data = request.json or {}
    avg_score = data.get("avg_score", 0)
    streak = data.get("streak", 0)
    weak_topics = data.get("weak_topics", [])
    weekly_hours = data.get("weekly_hours", [])

    prompt = (
        f"Based on a student's StudyAI analytics:\n"
        f"- Average Quiz Score: {avg_score}%\n"
        f"- Current Study Streak: {streak} days\n"
        f"- Weak Topics Detected: {', '.join(weak_topics) if weak_topics else 'None'}\n"
        f"- Weekly Study Hours (Mon-Sun): {weekly_hours}\n\n"
        f"Generate exactly 3 bullet points of actionable academic insights and guidance tips. "
        f"Keep them highly personalized, professional, encouraging, and brief (max 20 words per bullet). "
        f"Do not include intro/outro text or titles. Just output the three bullet points."
    )

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        insights = completion.choices[0].message.content
        return jsonify({"insights": insights})
    except Exception as e:
        return jsonify({"error": f"Failed to generate AI insights: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
@app.route('/')
def home():
    return "Backend Server is Running Successfully on Render!"