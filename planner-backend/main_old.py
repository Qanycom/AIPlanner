from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import sqlite3
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



SECRET_KEY = "secret_key_for_diploma"
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class UserRegister(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


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
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
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
    conn.close()


init_db()


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@app.post("/register")
def register(user: UserRegister):
    hashed_password = pwd_context.hash(user.password)

    try:
        with sqlite3.connect("database.db") as conn:
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                (user.name, user.email, hashed_password)
            )

            conn.commit()

        return {"message": "Користувача зареєстровано"}

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Користувач з таким email вже існує"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/login")
def login(user: UserLogin):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, name, email, password FROM users WHERE email = ?",
        (user.email,)
    )

    db_user = cursor.fetchone()
    conn.close()

    if not db_user:
        raise HTTPException(status_code=400, detail="Невірний email або пароль")

    user_id, name, email, hashed_password = db_user

    if not pwd_context.verify(user.password, hashed_password):
        raise HTTPException(status_code=400, detail="Невірний email або пароль")

    token = create_token({
        "user_id": user_id,
        "email": email
    })

    return {
        "message": "Вхід успішний",
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email
        }
    }


@app.get("/tasks")
def get_tasks(authorization: str = Header(None)):
    user_id = get_current_user_id(authorization)

    with sqlite3.connect("database.db") as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, title, description, priority, deadline, time, status, postponedCount, notified
            FROM tasks
            WHERE user_id = ?
        """, (user_id,))

        rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "title": row[1],
            "description": row[2],
            "priority": row[3],
            "deadline": row[4],
            "time": row[5],
            "status": row[6],
            "postponedCount": row[7],
            "notified": bool(row[8])
        }
        for row in rows
    ]


@app.post("/tasks")
def save_tasks(tasks: list[TaskSave], authorization: str = Header(None)):
    user_id = get_current_user_id(authorization)

    with sqlite3.connect("database.db") as conn:
        cursor = conn.cursor()

        cursor.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))

        for task in tasks:
            cursor.execute("""
                INSERT INTO tasks (
                    id, user_id, title, description, priority, deadline, time, status, postponedCount, notified
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task.id,
                user_id,
                task.title,
                task.description,
                task.priority,
                task.deadline,
                task.time,
                task.status,
                task.postponedCount,
                int(task.notified)
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
        }
    )

    return {"result": response.json()["response"]}