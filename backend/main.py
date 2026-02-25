"""
NutriScan Backend - Production Ready
═════════════════════════════════════
Local:    uvicorn main:app --reload --port 8000
Production: gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker

Env vars:
  ANTHROPIC_API_KEY    - Claude API key
  RAZORPAY_KEY_ID      - Razorpay key
  RAZORPAY_KEY_SECRET  - Razorpay secret
  DATABASE_URL         - PostgreSQL URL (optional, uses SQLite if absent)
  FRONTEND_URL         - Frontend URL for CORS (optional)
"""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional, List
from contextlib import contextmanager
import hashlib
import hmac
import secrets
import json
import base64
import os
import httpx

# ═══════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_xxxxx")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

PLAN_AMOUNT_PAISE = 30000
PLAN_DURATION_DAYS = 90
PLAN_NAME = "NutriScan Pro — 3 Months"
FREE_SCANS = 2

USE_PG = bool(DATABASE_URL)

app = FastAPI(title="NutriScan API", version="2.0.0")

cors_origins = ["*"] if FRONTEND_URL == "*" else [FRONTEND_URL, "http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ═══════════════════════════════════════════
# DATABASE LAYER (PostgreSQL + SQLite)
# ═══════════════════════════════════════════

if USE_PG:
    import psycopg2
    import psycopg2.extras

class DictRow(dict):
    """Make dict behave like sqlite3.Row for key access."""
    def __getitem__(self, key):
        if isinstance(key, str):
            return super().__getitem__(key)
        return super().__getitem__(key)

class DBConnection:
    """Unified database wrapper for both SQLite and PostgreSQL."""

    def __init__(self):
        if USE_PG:
            self.conn = psycopg2.connect(DATABASE_URL)
            self.is_pg = True
        else:
            import sqlite3
            self.conn = sqlite3.connect("nutriscan.db")
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA foreign_keys=ON")
            self.is_pg = False

    def _convert_sql(self, sql):
        """Convert ? placeholders to %s for PostgreSQL."""
        if self.is_pg:
            return sql.replace("?", "%s")
        return sql

    def execute(self, sql, params=None):
        sql = self._convert_sql(sql)
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) if self.is_pg else self.conn.cursor()
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        self._last_cursor = cur
        return self

    @property
    def lastrowid(self):
        if self.is_pg:
            return getattr(self._last_cursor, 'fetchone', lambda: {})()
        return self._last_cursor.lastrowid

    def fetchone(self):
        row = self._last_cursor.fetchone()
        if row is None:
            return None
        if self.is_pg:
            return dict(row)
        return dict(row)

    def fetchall(self):
        rows = self._last_cursor.fetchall()
        return [dict(r) for r in rows]

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


def get_db():
    return DBConnection()


# Schema
PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    weight_kg REAL,
    height_cm REAL,
    activity_level TEXT DEFAULT 'moderate',
    health_goal TEXT DEFAULT 'maintain',
    dietary_preference TEXT DEFAULT 'non-veg',
    health_conditions TEXT DEFAULT '[]',
    daily_calorie_target INTEGER DEFAULT 2000,
    token TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    day_number INTEGER NOT NULL,
    meal_number INTEGER NOT NULL,
    meal_type TEXT NOT NULL,
    meal_format TEXT,
    meal_name TEXT,
    photo_base64 TEXT,
    total_calories INTEGER,
    total_weight_g INTEGER,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    items_json TEXT DEFAULT '[]',
    glycemic_impact TEXT,
    sugar_peak_mg_dl INTEGER,
    sugar_peak_minutes INTEGER,
    sugar_explanation TEXT,
    insulin_resistance_risk TEXT DEFAULT 'low',
    insulin_resistance_explanation TEXT,
    micronutrients_notable TEXT DEFAULT '[]',
    micronutrients_lacking TEXT DEFAULT '[]',
    healthiness_score INTEGER,
    health_notes TEXT,
    recommendations TEXT,
    recommended_alternatives_json TEXT DEFAULT '[]',
    confidence TEXT DEFAULT 'medium',
    logged_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    day_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_calories INTEGER DEFAULT 0,
    total_weight_g INTEGER DEFAULT 0,
    total_protein_g REAL DEFAULT 0,
    total_carbs_g REAL DEFAULT 0,
    total_fat_g REAL DEFAULT 0,
    total_fiber_g REAL DEFAULT 0,
    meal_count INTEGER DEFAULT 0,
    avg_healthiness REAL DEFAULT 0,
    high_sugar_meals INTEGER DEFAULT 0,
    high_insulin_risk_meals INTEGER DEFAULT 0,
    daily_recommendation TEXT,
    UNIQUE(user_id, day_number)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount_paise INTEGER NOT NULL,
    status TEXT DEFAULT 'created',
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
"""

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    weight_kg REAL,
    height_cm REAL,
    activity_level TEXT DEFAULT 'moderate',
    health_goal TEXT DEFAULT 'maintain',
    dietary_preference TEXT DEFAULT 'non-veg',
    health_conditions TEXT DEFAULT '[]',
    daily_calorie_target INTEGER DEFAULT 2000,
    token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    meal_number INTEGER NOT NULL,
    meal_type TEXT NOT NULL,
    meal_format TEXT,
    meal_name TEXT,
    photo_base64 TEXT,
    total_calories INTEGER,
    total_weight_g INTEGER,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    items_json TEXT DEFAULT '[]',
    glycemic_impact TEXT,
    sugar_peak_mg_dl INTEGER,
    sugar_peak_minutes INTEGER,
    sugar_explanation TEXT,
    insulin_resistance_risk TEXT DEFAULT 'low',
    insulin_resistance_explanation TEXT,
    micronutrients_notable TEXT DEFAULT '[]',
    micronutrients_lacking TEXT DEFAULT '[]',
    healthiness_score INTEGER,
    health_notes TEXT,
    recommendations TEXT,
    recommended_alternatives_json TEXT DEFAULT '[]',
    confidence TEXT DEFAULT 'medium',
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_calories INTEGER DEFAULT 0,
    total_weight_g INTEGER DEFAULT 0,
    total_protein_g REAL DEFAULT 0,
    total_carbs_g REAL DEFAULT 0,
    total_fat_g REAL DEFAULT 0,
    total_fiber_g REAL DEFAULT 0,
    meal_count INTEGER DEFAULT 0,
    avg_healthiness REAL DEFAULT 0,
    high_sugar_meals INTEGER DEFAULT 0,
    high_insulin_risk_meals INTEGER DEFAULT 0,
    daily_recommendation TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, day_number)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount_paise INTEGER NOT NULL,
    status TEXT DEFAULT 'created',
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""


def init_db():
    db = get_db()
    schema = PG_SCHEMA if USE_PG else SQLITE_SCHEMA
    if USE_PG:
        db.execute(schema)
    else:
        db.conn.executescript(schema)
    db.commit()
    db.close()
    print(f"✅ Database initialized ({'PostgreSQL' if USE_PG else 'SQLite'})")


init_db()


# ═══════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    return secrets.token_hex(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE token = ?", (token,)).fetchone()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def calculate_day_number(created_at) -> int:
    if isinstance(created_at, str):
        reg_date = datetime.fromisoformat(created_at.replace("+00:00", "")).date()
    elif isinstance(created_at, datetime):
        reg_date = created_at.date()
    else:
        reg_date = date.today()
    return (date.today() - reg_date).days + 1

def get_meal_number_today(db, user_id: int, day_number: int) -> int:
    result = db.execute(
        "SELECT COUNT(*) as count FROM meals WHERE user_id = ? AND day_number = ?",
        (user_id, day_number)
    ).fetchone()
    return result["count"] + 1


# ═══════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    activity_level: Optional[str] = "moderate"
    health_goal: Optional[str] = "maintain"
    dietary_preference: Optional[str] = "non-veg"
    health_conditions: Optional[List[str]] = []
    daily_calorie_target: Optional[int] = 2000

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    activity_level: Optional[str] = None
    health_goal: Optional[str] = None
    dietary_preference: Optional[str] = None
    health_conditions: Optional[List[str]] = None
    daily_calorie_target: Optional[int] = None

class PaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ═══════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════

@app.post("/api/register")
def register(req: RegisterRequest):
    db = get_db()
    try:
        token = generate_token()
        db.execute(
            """INSERT INTO users (email, password_hash, name, age, gender, weight_kg,
               height_cm, activity_level, health_goal, dietary_preference,
               health_conditions, daily_calorie_target, token)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (req.email, hash_password(req.password), req.name, req.age, req.gender,
             req.weight_kg, req.height_cm, req.activity_level, req.health_goal,
             req.dietary_preference, json.dumps(req.health_conditions),
             req.daily_calorie_target, token)
        )
        db.commit()
        return {"token": token, "message": "Registration successful"}
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.post("/api/login")
def login(req: LoginRequest):
    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE email = ? AND password_hash = ?",
        (req.email, hash_password(req.password))
    ).fetchone()
    if not user:
        db.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = generate_token()
    db.execute("UPDATE users SET token = ? WHERE id = ?", (token, user["id"]))
    db.commit()
    db.close()
    return {"token": token, "name": user["name"]}

@app.get("/api/profile")
def get_profile(user=Depends(get_current_user)):
    return {
        "name": user["name"], "email": user["email"], "age": user["age"],
        "gender": user["gender"], "weight_kg": user["weight_kg"],
        "height_cm": user["height_cm"], "activity_level": user["activity_level"],
        "health_goal": user["health_goal"], "dietary_preference": user["dietary_preference"],
        "health_conditions": json.loads(user["health_conditions"] or "[]"),
        "daily_calorie_target": user["daily_calorie_target"],
        "member_since": str(user["created_at"]),
        "current_day": calculate_day_number(user["created_at"])
    }

@app.put("/api/profile")
def update_profile(req: ProfileUpdate, user=Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "health_conditions" in updates:
        updates["health_conditions"] = json.dumps(updates["health_conditions"])
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        sql = f"UPDATE users SET {set_clause} WHERE id = ?"
        if USE_PG:
            sql = sql.replace("?", "%s")
        db.conn.cursor().execute(sql, [*updates.values(), user["id"]])
        db.commit()
    db.close()
    return {"message": "Profile updated"}


# ═══════════════════════════════════════════
# SUBSCRIPTION & PAYMENTS (Razorpay)
# ═══════════════════════════════════════════

def check_subscription(user_id: int) -> dict:
    db = get_db()

    now_expr = "NOW()" if USE_PG else "datetime('now')"
    sub = db.execute(
        f"""SELECT * FROM subscriptions WHERE user_id = ? AND status = 'paid'
            AND expires_at > {now_expr} ORDER BY expires_at DESC LIMIT 1""",
        (user_id,)
    ).fetchone()

    if sub:
        db.close()
        return {"active": True, "expires_at": str(sub["expires_at"]), "plan": PLAN_NAME}

    scan_count = db.execute(
        "SELECT COUNT(*) as c FROM meals WHERE user_id = ?", (user_id,)
    ).fetchone()["c"]

    db.close()
    return {
        "active": scan_count < FREE_SCANS,
        "free_scans_used": scan_count,
        "free_scans_total": FREE_SCANS,
        "is_trial": True,
    }


@app.get("/api/subscription/status")
def subscription_status(user=Depends(get_current_user)):
    status = check_subscription(user["id"])
    return {
        **status,
        "plan_name": PLAN_NAME,
        "plan_amount": PLAN_AMOUNT_PAISE / 100,
        "plan_duration_days": PLAN_DURATION_DAYS,
        "razorpay_key_id": RAZORPAY_KEY_ID,
    }


@app.post("/api/subscription/create-order")
async def create_razorpay_order(user=Depends(get_current_user)):
    import time
    receipt = f"ns_{user['id']}_{int(time.time())}"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.razorpay.com/v1/orders",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                json={
                    "amount": PLAN_AMOUNT_PAISE,
                    "currency": "INR",
                    "receipt": receipt,
                    "notes": {"user_id": str(user["id"]), "plan": PLAN_NAME}
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Razorpay error: {resp.text}")
            order = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

    db = get_db()
    db.execute(
        """INSERT INTO subscriptions (user_id, razorpay_order_id, amount_paise, status)
           VALUES (?, ?, ?, 'created')""",
        (user["id"], order["id"], PLAN_AMOUNT_PAISE)
    )
    db.commit()
    db.close()

    return {
        "order_id": order["id"], "amount": PLAN_AMOUNT_PAISE, "currency": "INR",
        "key_id": RAZORPAY_KEY_ID, "name": "NutriScan", "description": PLAN_NAME,
        "prefill": {"name": user["name"], "email": user["email"]}
    }


@app.post("/api/subscription/verify")
def verify_payment(req: PaymentVerification, user=Depends(get_current_user)):
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), message.encode(), hashlib.sha256
    ).hexdigest()

    if expected != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    db = get_db()
    now = datetime.now()
    expires = now + timedelta(days=PLAN_DURATION_DAYS)

    db.execute(
        """UPDATE subscriptions
           SET razorpay_payment_id = ?, razorpay_signature = ?,
               status = 'paid', starts_at = ?, expires_at = ?
           WHERE razorpay_order_id = ? AND user_id = ?""",
        (req.razorpay_payment_id, req.razorpay_signature,
         now.isoformat(), expires.isoformat(),
         req.razorpay_order_id, user["id"])
    )
    db.commit()
    db.close()

    return {
        "status": "active", "message": "Payment successful!",
        "starts_at": now.isoformat(), "expires_at": expires.isoformat(),
    }


@app.get("/api/subscription/history")
def subscription_history(user=Depends(get_current_user)):
    db = get_db()
    subs = db.execute(
        """SELECT id, amount_paise, status, starts_at, expires_at, created_at
           FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC""",
        (user["id"],)
    ).fetchall()
    db.close()
    return {"subscriptions": subs}


# ═══════════════════════════════════════════
# AI ANALYSIS PROMPT
# ═══════════════════════════════════════════

ANALYSIS_PROMPT = """You are an expert nutritionist AI with DEEP knowledge of Indian regional cuisines, traditional meal formats, and temple/monastery food traditions.

CRITICAL — MEAL FORMAT RECOGNITION (identify format FIRST, then items):

**Traditional Indian Meal Formats:**
- Mutt Bhojan / Temple Prasadam: Served on PATRAVALI (overlapping dried leaves) or banana leaf. Contains: plain rice, flavored rice (puliyogare/chitranna), dal/tove, palya, kosambari, chutney pudi, salt, pickle, sometimes payasa. ALWAYS vegetarian sattvic (no onion/garlic). Common in Karnataka/TN/AP temples.
- Banana Leaf Sadhya: Kerala style — rice center, 10+ items, payasam, pappadam.
- Standard Thali: Steel plate + katoris with dal, sabzi, roti/rice.

**NEVER CONFUSE THESE:**
- Rice + multiple sides on LEAF PLATES = Mutt Bhojan / Temple Meal (NOT dosa, NOT idli)
- Dosa = single golden-brown CREPE on a plate
- Idli = white steamed rounds

**South Indian Dish Identification:**
- Puliyogare: Tamarind rice, brownish-orange, tangy, peanuts
- Chitranna: Lemon rice, yellow, turmeric, peanuts
- Kosambari: Soaked moong/chana dal salad with coconut, cucumber, coriander
- Palya/Poriyal: Dry stir-fried vegetable
- Chutney Pudi: Dry powder, eaten with rice + ghee
- Tove/Pappu: Plain dal, yellow liquid
- Saaru/Rasam: Thin peppery soup
- Payasa/Kheer: Sweet dessert

**INSULIN RESISTANCE RISK ASSESSMENT:**
- HIGH: Heavy refined carbs (white rice > 250g, maida items, sugary desserts), low fiber, low protein, fried + sweet combos
- MODERATE: Mixed — some refined carbs but balanced with dal/protein, moderate fiber
- LOW: Whole grains/millets, high fiber, good protein, low glycemic load, balanced macros

Key Indian risk factors: Excess white rice without dal, sweets after heavy meal, maida-based breads, sugary beverages.

User context:
- Health goal: {health_goal}
- Dietary preference: {dietary_preference}
- Daily calorie target: {calorie_target} kcal
- Health conditions: {health_conditions}

Respond ONLY with valid JSON (no markdown, no backticks):
{{
  "meal_format": "Identified format (e.g. South Indian Mutt Bhojan on Patravali)",
  "meal_name": "Descriptive name",
  "confidence": "high" | "medium" | "low",
  "total_calories": number,
  "total_weight_g": number,
  "macros": {{
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  }},
  "sugar_spike": {{
    "glycemic_impact": "low" | "moderate" | "high" | "very_high",
    "estimated_peak_mg_dl": number,
    "time_to_peak_minutes": number,
    "explanation": "Brief blood sugar impact explanation"
  }},
  "insulin_resistance": {{
    "risk": "low" | "moderate" | "high",
    "explanation": "Why this meal poses this level of insulin resistance risk"
  }},
  "items": [
    {{ "name": "Regional name (English translation)", "portion": "Estimated portion", "weight_g": number, "calories": number }}
  ],
  "micronutrients": {{
    "notable": ["vitamins/minerals present"],
    "lacking": ["nutrients that could improve"]
  }},
  "health_notes": "Brief health insight",
  "healthiness_score": number_1_to_10,
  "recommendations": "2-3 specific suggestions considering user's goals",
  "recommended_alternatives": [
    {{
      "name": "Indian dish name in English",
      "description": "1-line why this is better for the user's goals",
      "calories": approximate_number,
      "image_search_term": "specific food photo search term e.g. 'ragi dosa chutney' or 'moong dal khichdi bowl'"
    }}
  ]
}}

IMPORTANT for recommended_alternatives:
- Suggest 2-3 SPECIFIC Indian alternatives that are healthier or better suited for the user's health goal
- Each alternative should be a REAL Indian dish (regional names welcome)
- Focus on dishes that address the shortcomings of the analyzed meal
- For diabetic users: suggest low-GI alternatives
- For weight loss: suggest lower calorie, high protein options
- image_search_term should be a vivid, specific food photography description (3-5 words)

Be realistic. Estimate weight using standard Indian serving references (1 katori dal ~150g, 1 cup rice ~200g, 1 roti ~40g). Account for oil/ghee in Indian cooking."""


# ═══════════════════════════════════════════
# MEAL ANALYSIS ENDPOINT
# ═══════════════════════════════════════════

@app.post("/api/meals/analyze")
async def analyze_meal(
    photo: UploadFile = File(...),
    meal_type: str = Form("lunch"),
    user=Depends(get_current_user)
):
    # Paywall
    sub_status = check_subscription(user["id"])
    if not sub_status["active"]:
        raise HTTPException(status_code=402, detail="subscription_required")

    content = await photo.read()
    image_base64 = base64.b64encode(content).decode("utf-8")
    media_type = photo.content_type or "image/jpeg"

    prompt = ANALYSIS_PROMPT.format(
        health_goal=user["health_goal"],
        dietary_preference=user["dietary_preference"],
        calorie_target=user["daily_calorie_target"],
        health_conditions=user["health_conditions"]
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1500,
                    "messages": [{"role": "user", "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
                        {"type": "text", "text": prompt}
                    ]}]
                }
            )
            data = resp.json()
            text = "".join(block.get("text", "") for block in data.get("content", []))
            analysis = json.loads(text.replace("```json", "").replace("```", "").strip())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    db = get_db()
    day_number = calculate_day_number(user["created_at"])
    meal_number = get_meal_number_today(db, user["id"], day_number)
    photo_thumb = image_base64[:200] + "..."

    insulin = analysis.get("insulin_resistance", {})

    if USE_PG:
        db.execute(
            """INSERT INTO meals (user_id, day_number, meal_number, meal_type, meal_format, meal_name,
               photo_base64, total_calories, total_weight_g, protein_g, carbs_g, fat_g, fiber_g,
               items_json, glycemic_impact, sugar_peak_mg_dl, sugar_peak_minutes,
               sugar_explanation, insulin_resistance_risk, insulin_resistance_explanation,
               micronutrients_notable, micronutrients_lacking,
               healthiness_score, health_notes, recommendations, recommended_alternatives_json, confidence)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id""",
            (user["id"], day_number, meal_number, meal_type,
             analysis.get("meal_format", ""), analysis["meal_name"],
             photo_thumb, analysis["total_calories"], analysis.get("total_weight_g", 0),
             analysis["macros"]["protein_g"], analysis["macros"]["carbs_g"],
             analysis["macros"]["fat_g"], analysis["macros"]["fiber_g"],
             json.dumps(analysis["items"]), analysis["sugar_spike"]["glycemic_impact"],
             analysis["sugar_spike"]["estimated_peak_mg_dl"],
             analysis["sugar_spike"]["time_to_peak_minutes"],
             analysis["sugar_spike"]["explanation"],
             insulin.get("risk", "low"), insulin.get("explanation", ""),
             json.dumps(analysis["micronutrients"]["notable"]),
             json.dumps(analysis["micronutrients"]["lacking"]),
             analysis["healthiness_score"], analysis["health_notes"],
             analysis["recommendations"],
             json.dumps(analysis.get("recommended_alternatives", [])),
             analysis["confidence"])
        )
        meal_id = db._last_cursor.fetchone()["id"]
    else:
        db.execute(
            """INSERT INTO meals (user_id, day_number, meal_number, meal_type, meal_format, meal_name,
               photo_base64, total_calories, total_weight_g, protein_g, carbs_g, fat_g, fiber_g,
               items_json, glycemic_impact, sugar_peak_mg_dl, sugar_peak_minutes,
               sugar_explanation, insulin_resistance_risk, insulin_resistance_explanation,
               micronutrients_notable, micronutrients_lacking,
               healthiness_score, health_notes, recommendations, recommended_alternatives_json, confidence)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user["id"], day_number, meal_number, meal_type,
             analysis.get("meal_format", ""), analysis["meal_name"],
             photo_thumb, analysis["total_calories"], analysis.get("total_weight_g", 0),
             analysis["macros"]["protein_g"], analysis["macros"]["carbs_g"],
             analysis["macros"]["fat_g"], analysis["macros"]["fiber_g"],
             json.dumps(analysis["items"]), analysis["sugar_spike"]["glycemic_impact"],
             analysis["sugar_spike"]["estimated_peak_mg_dl"],
             analysis["sugar_spike"]["time_to_peak_minutes"],
             analysis["sugar_spike"]["explanation"],
             insulin.get("risk", "low"), insulin.get("explanation", ""),
             json.dumps(analysis["micronutrients"]["notable"]),
             json.dumps(analysis["micronutrients"]["lacking"]),
             analysis["healthiness_score"], analysis["health_notes"],
             analysis["recommendations"],
             json.dumps(analysis.get("recommended_alternatives", [])),
             analysis["confidence"])
        )
        meal_id = db._last_cursor.lastrowid

    _update_daily_summary(db, user["id"], day_number)
    db.commit()
    db.close()

    return {"meal_id": meal_id, "day_number": day_number, "meal_number": meal_number,
            "meal_type": meal_type, **analysis}


# ═══════════════════════════════════════════
# DAILY SUMMARY
# ═══════════════════════════════════════════

def _update_daily_summary(db, user_id: int, day_number: int):
    meals = db.execute(
        "SELECT * FROM meals WHERE user_id = ? AND day_number = ?",
        (user_id, day_number)
    ).fetchall()
    if not meals:
        return

    total_cal = sum(m["total_calories"] or 0 for m in meals)
    total_weight = sum(m["total_weight_g"] or 0 for m in meals)
    total_protein = sum(m["protein_g"] or 0 for m in meals)
    total_carbs = sum(m["carbs_g"] or 0 for m in meals)
    total_fat = sum(m["fat_g"] or 0 for m in meals)
    total_fiber = sum(m["fiber_g"] or 0 for m in meals)
    avg_health = sum(m["healthiness_score"] or 0 for m in meals) / len(meals)
    high_sugar = sum(1 for m in meals if m["glycemic_impact"] in ("high", "very_high"))
    high_insulin = sum(1 for m in meals if m["insulin_resistance_risk"] == "high")

    db.execute(
        """INSERT INTO daily_summary (user_id, day_number, date, total_calories, total_weight_g,
           total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
           meal_count, avg_healthiness, high_sugar_meals, high_insulin_risk_meals)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, day_number) DO UPDATE SET
           total_calories=?, total_weight_g=?, total_protein_g=?, total_carbs_g=?,
           total_fat_g=?, total_fiber_g=?, meal_count=?, avg_healthiness=?,
           high_sugar_meals=?, high_insulin_risk_meals=?""",
        (user_id, day_number, date.today().isoformat(), total_cal, total_weight,
         total_protein, total_carbs, total_fat, total_fiber,
         len(meals), avg_health, high_sugar, high_insulin,
         total_cal, total_weight, total_protein, total_carbs,
         total_fat, total_fiber, len(meals), avg_health,
         high_sugar, high_insulin)
    )


# ═══════════════════════════════════════════
# DASHBOARD ROUTES
# ═══════════════════════════════════════════

@app.get("/api/dashboard/today")
def dashboard_today(user=Depends(get_current_user)):
    db = get_db()
    day_number = calculate_day_number(user["created_at"])
    meals = db.execute(
        """SELECT id, day_number, meal_number, meal_type, meal_format, meal_name,
           total_calories, total_weight_g, protein_g, carbs_g, fat_g, fiber_g,
           glycemic_impact, sugar_peak_mg_dl, sugar_peak_minutes, sugar_explanation,
           insulin_resistance_risk, insulin_resistance_explanation,
           healthiness_score, health_notes, recommendations, recommended_alternatives_json, items_json, confidence, logged_at
           FROM meals WHERE user_id = ? AND day_number = ? ORDER BY meal_number""",
        (user["id"], day_number)
    ).fetchall()
    summary = db.execute(
        "SELECT * FROM daily_summary WHERE user_id = ? AND day_number = ?",
        (user["id"], day_number)
    ).fetchone()
    db.close()
    return {
        "day_number": day_number, "date": date.today().isoformat(),
        "calorie_target": user["daily_calorie_target"],
        "meals": meals, "summary": summary
    }

@app.get("/api/dashboard/history")
def dashboard_history(days: int = 7, user=Depends(get_current_user)):
    db = get_db()
    current_day = calculate_day_number(user["created_at"])
    start_day = max(1, current_day - days + 1)
    summaries = db.execute(
        """SELECT * FROM daily_summary WHERE user_id = ?
           AND day_number BETWEEN ? AND ? ORDER BY day_number DESC""",
        (user["id"], start_day, current_day)
    ).fetchall()
    db.close()
    return {"current_day": current_day, "days": summaries,
            "calorie_target": user["daily_calorie_target"]}

@app.get("/api/dashboard/meals")
def get_meals_history(day: Optional[int] = None, limit: int = 20, offset: int = 0,
                      user=Depends(get_current_user)):
    db = get_db()
    if day:
        meals = db.execute(
            "SELECT * FROM meals WHERE user_id = ? AND day_number = ? ORDER BY meal_number LIMIT ? OFFSET ?",
            (user["id"], day, limit, offset)).fetchall()
    else:
        meals = db.execute(
            "SELECT * FROM meals WHERE user_id = ? ORDER BY day_number DESC, meal_number DESC LIMIT ? OFFSET ?",
            (user["id"], limit, offset)).fetchall()
    db.close()
    return {"meals": meals}

@app.delete("/api/meals/{meal_id}")
def delete_meal(meal_id: int, user=Depends(get_current_user)):
    db = get_db()
    meal = db.execute(
        "SELECT * FROM meals WHERE id = ? AND user_id = ?",
        (meal_id, user["id"])
    ).fetchone()
    if not meal:
        db.close()
        raise HTTPException(status_code=404, detail="Meal not found")
    day_number = meal["day_number"]
    db.execute("DELETE FROM meals WHERE id = ? AND user_id = ?", (meal_id, user["id"]))
    _update_daily_summary(db, user["id"], day_number)
    remaining = db.execute(
        "SELECT COUNT(*) as c FROM meals WHERE user_id = ? AND day_number = ?",
        (user["id"], day_number)
    ).fetchone()
    if remaining["c"] == 0:
        db.execute("DELETE FROM daily_summary WHERE user_id = ? AND day_number = ?",
                   (user["id"], day_number))
    db.commit()
    db.close()
    return {"message": "Meal deleted", "meal_id": meal_id}

@app.get("/api/dashboard/stats")
def dashboard_stats(user=Depends(get_current_user)):
    db = get_db()
    current_day = calculate_day_number(user["created_at"])
    stats = db.execute(
        """SELECT
            COUNT(*) as total_meals,
            AVG(total_calories) as avg_calories,
            AVG(total_weight_g) as avg_weight_g,
            AVG(healthiness_score) as avg_healthiness,
            SUM(CASE WHEN glycemic_impact IN ('high', 'very_high') THEN 1 ELSE 0 END) as high_sugar_meals,
            SUM(CASE WHEN insulin_resistance_risk = 'high' THEN 1 ELSE 0 END) as high_insulin_meals,
            AVG(protein_g) as avg_protein,
            AVG(carbs_g) as avg_carbs,
            AVG(fat_g) as avg_fat
           FROM meals WHERE user_id = ?""",
        (user["id"],)
    ).fetchone()
    db.close()
    return {"current_day": current_day, "member_since": str(user["created_at"]), **stats}


# ═══════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0", "database": "postgresql" if USE_PG else "sqlite"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
