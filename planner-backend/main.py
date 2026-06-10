from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import sqlite3
import requests
import os
import smtplib
import secrets
from email.message import EmailMessage
from dotenv import load_dotenv
from fastapi.responses import RedirectResponse


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("SECRET_KEY", "change_me_for_diploma")
ALGORITHM = "HS256"
FRONTEND_URL = os.getenv("FRONTEND_URL")
BACKEND_URL = os.getenv("BACKEND_URL")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "planner@example.com")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class UserRegister(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class Task(BaseModel):
    title: str
    description: str = ""
    priority: str
    deadline: str
    time: str = ""
    postponedCount: int


class TaskSave(BaseModel):
    id: int
    title: str
    description: str = ""
    priority: str
    deadline: str = ""
    time: str = ""
    status: str
    postponedCount: int = 0
    notified: bool = False


def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_secure_token() -> str:
    return secrets.token_urlsafe(32)


def send_email(to_email: str, subject: str, body: str):
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="SMTP не налаштовано. Додайте SMTP_HOST, SMTP_USER та SMTP_PASSWORD у .env"
        )

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)


def get_current_user_id(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Немає токена")

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except Exception:
        raise HTTPException(status_code=401, detail="Невірний токен")


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_email_verified INTEGER DEFAULT 0
            )
        """)

        cursor.execute("PRAGMA table_info(users)")
        user_columns = [row[1] for row in cursor.fetchall()]
        if "is_email_verified" not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN is_email_verified INTEGER DEFAULT 0")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT,
                deadline TEXT,
                time TEXT,
                status TEXT,
                postponedCount INTEGER DEFAULT 0,
                notified INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.commit()


init_db()


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@app.post("/register")
def register(user: UserRegister):
    email = normalize_email(user.email)

    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль має містити мінімум 6 символів")

    hashed_password = pwd_context.hash(user.password)
    verification_token = create_secure_token()
    expires_at = (datetime.utcnow() + timedelta(hours=24)).isoformat()

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (name, email, password, is_email_verified) VALUES (?, ?, ?, 0)",
                (user.name.strip(), email, hashed_password)
            )
            user_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user_id, verification_token, expires_at)
            )
            conn.commit()

        verify_link = f"{BACKEND_URL}/verify-email?token={verification_token}"
        send_email(
            email,
            "Підтвердження пошти — Інтелектуальний планувальник",
            f"Вітаємо, {user.name}!\n\n"
            f"Підтвердіть вашу пошту за посиланням:\n{verify_link}\n\n"
            f"Посилання активне 24 години."
        )

        return {
            "message": "Реєстрація успішна. Перевірте пошту та підтвердіть email."
        }

    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Користувач з таким email вже існує")


@app.get("/verify-email")
@app.get("/verify-email")
def verify_email(token: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, expires_at, used
            FROM email_verification_tokens
            WHERE token = ?
        """, (token,))
        row = cursor.fetchone()

        if not row or row["used"]:
            return RedirectResponse(url=f"{FRONTEND_URL}/?verified=error")

        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            return RedirectResponse(url=f"{FRONTEND_URL}/?verified=expired")

        cursor.execute("UPDATE users SET is_email_verified = 1 WHERE id = ?", (row["user_id"],))
        cursor.execute("UPDATE email_verification_tokens SET used = 1 WHERE id = ?", (row["id"],))
        conn.commit()

    return RedirectResponse(url=f"{FRONTEND_URL}/?verified=success")



@app.post("/resend-verification")
def resend_verification(request: ForgotPasswordRequest):
    email = normalize_email(request.email)
    new_token = create_secure_token()
    expires_at = (datetime.utcnow() + timedelta(hours=24)).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, is_email_verified FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return {"message": "Якщо email існує, лист підтвердження буде надіслано."}

        if user["is_email_verified"]:
            return {"message": "Пошта вже підтверджена."}

        cursor.execute(
            "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user["id"], new_token, expires_at)
        )
        conn.commit()

    verify_link = f"{BACKEND_URL}/verify-email?token={new_token}"
    send_email(
        email,
        "Повторне підтвердження пошти",
        f"Підтвердіть вашу пошту за посиланням:\n{verify_link}\n\nПосилання активне 24 години."
    )

    return {"message": "Лист підтвердження надіслано повторно."}


@app.post("/login")
def login(user: UserLogin):
    email = normalize_email(user.email)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, password, is_email_verified FROM users WHERE email = ?",
            (email,)
        )
        db_user = cursor.fetchone()

    if not db_user or not pwd_context.verify(user.password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Невірний email або пароль")

    if not db_user["is_email_verified"]:
        raise HTTPException(status_code=403, detail="Підтвердіть email перед входом")

    token = create_token({"user_id": db_user["id"], "email": db_user["email"]})

    return {
        "message": "Вхід успішний",
        "token": token,
        "user": {
            "id": db_user["id"],
            "name": db_user["name"],
            "email": db_user["email"]
        }
    }


@app.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    email = normalize_email(request.email)
    reset_token = create_secure_token()
    expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_email_verified FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if user and user["is_email_verified"]:
            cursor.execute(
                "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user["id"], reset_token, expires_at)
            )
            conn.commit()

            reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
            send_email(
                email,
                "Відновлення пароля — Інтелектуальний планувальник",
                f"Для відновлення пароля перейдіть за посиланням:\n{reset_link}\n\n"
                f"Посилання активне 1 годину."
            )

    return {"message": "Якщо email підтверджений, лист для відновлення пароля буде надіслано."}


@app.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Новий пароль має містити мінімум 6 символів")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, expires_at, used
            FROM password_reset_tokens
            WHERE token = ?
        """, (request.token,))
        row = cursor.fetchone()

        if not row or row["used"]:
            raise HTTPException(status_code=400, detail="Посилання недійсне або вже використане")

        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Термін дії посилання минув")

        new_hash = pwd_context.hash(request.new_password)
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, row["user_id"]))
        cursor.execute("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (row["id"],))
        conn.commit()

    return {"message": "Пароль успішно змінено. Тепер можна увійти."}


@app.get("/tasks")
def get_tasks(authorization: str = Header(None)):
    user_id = get_current_user_id(authorization)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, description, priority, deadline, time, status, postponedCount, notified
            FROM tasks
            WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()

    return [
        {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "priority": row["priority"],
            "deadline": row["deadline"],
            "time": row["time"],
            "status": row["status"],
            "postponedCount": row["postponedCount"],
            "notified": bool(row["notified"])
        }
        for row in rows
    ]


@app.post("/tasks")
def save_tasks(tasks: list[TaskSave], authorization: str = Header(None)):
    user_id = get_current_user_id(authorization)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))

        for task in tasks:
            cursor.execute("""
                INSERT INTO tasks (
                    id, user_id, title, description, priority, deadline, time, status, postponedCount, notified
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task.id, user_id, task.title, task.description, task.priority,
                task.deadline, task.time, task.status, task.postponedCount, int(task.notified)
            ))

        conn.commit()

    return {"message": "Завдання збережено"}


@app.post("/ai-advice")
def get_ai_advice(tasks: list[Task]):
    if not tasks:
        return {"result": "Немає завдань для виконання."}

    prompt = f"""
Ти даєш коротку пораду по задачі.

ПРАВИЛА:
- Тільки українська мова
- Рівно 2 короткі речення
- Без повторів
- Без пояснень
- Без зайвого тексту

ФОРМАТ:
<речення 1>
<речення 2>

ДАНІ:
Назва: {tasks[0].title}
Опис: {tasks[0].description}
Пріоритет: {tasks[0].priority}
Дата: {tasks[0].deadline}
Час: {tasks[0].time}
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.2,
                    "num_predict": 60,
                    "repeat_penalty": 1.2
                }
            },
            timeout=60
        )
        response.raise_for_status()
        return {"result": response.json().get("response", "Немає відповіді від AI")}
    except Exception:
        return {"result": "AI тимчасово недоступний. Спробуйте пізніше."}
