import './App.css';
import { useState, useEffect } from 'react';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://arthritis-camel-raymond-principle.trycloudflare.com';

function App() {
  const [taskText, setTaskText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('todo');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [postponingTaskId, setPostponingTaskId] = useState(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeTime, setPostponeTime] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [mobileTab, setMobileTab] = useState('plan');
  const [weekOffset, setWeekOffset] = useState(0);
  const [authMessage, setAuthMessage] = useState('');
const [authMessageType, setAuthMessageType] = useState('');
const [authErrors, setAuthErrors] = useState({});
const [resetPassword, setResetPassword] = useState('');


const [authMode, setAuthMode] = useState('login'); // login | register | forgot | reset
const [resetToken, setResetToken] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
});
const [newPassword, setNewPassword] = useState('');

const [user, setUser] = useState(() => {
  const savedUser = localStorage.getItem('user');
  return savedUser ? JSON.parse(savedUser) : null;
});

const [authForm, setAuthForm] = useState({
  name: '',
  email: '',
  password: ''
});

useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  const verified = params.get('verified');
  const reset = params.get('reset_token');

  if (verified === 'success') {
    setAuthMessage('Пошту успішно підтверджено. Тепер можна увійти.');
    setAuthMessageType('success');
    window.history.replaceState({}, document.title, '/');
  }

  if (verified === 'error') {
    setAuthMessage('Посилання підтвердження недійсне або вже використане.');
    setAuthMessageType('error');
    window.history.replaceState({}, document.title, '/');
  }

  if (verified === 'expired') {
    setAuthMessage('Термін дії посилання минув. Надішліть лист повторно.');
    setAuthMessageType('error');
    window.history.replaceState({}, document.title, '/');
  }

  if (reset) {
    setResetToken(reset);
  }
}, []);

const handleRegister = async () => {
  setAuthMessage('');
  setAuthMessageType('');
  setAuthErrors({});

  const errors = {};
  if (!authForm.name) errors.name = true;
  if (!authForm.email) errors.email = true;
  if (!authForm.password) errors.password = true;

  if (Object.keys(errors).length > 0) {
    setAuthErrors(errors);
    setAuthMessage('Заповніть всі поля');
    setAuthMessageType('error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });

    const data = await res.json();

    if (!res.ok) {
      setAuthMessage(typeof data.detail === 'string' ? data.detail : 'Помилка реєстрації');
      setAuthMessageType('error');
      if (String(data.detail).toLowerCase().includes('email')) setAuthErrors({ email: true });
      return;
    }

    setAuthMessage(data.message || 'Реєстрація успішна. Перевірте пошту.');
    setAuthMessageType('success');
    setAuthErrors({});
    setAuthMode('login');
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    setAuthMessage('Помилка підключення до backend');
    setAuthMessageType('error');
  }
};

const handleForgotPassword = async () => {
  if (!authForm.email) {
    setAuthErrors({ email: true });
    setAuthMessage('Введіть email для відновлення пароля');
    setAuthMessageType('error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authForm.email })
    });
    const data = await res.json();
    setAuthMessage(data.message || 'Перевірте пошту');
    setAuthMessageType(res.ok ? 'success' : 'error');
  } catch (err) {
    setAuthMessage('Помилка підключення до backend');
    setAuthMessageType('error');
  }
};

const handleLogin = async () => {
  setAuthMessage('');
setAuthMessageType('');
setAuthErrors({});

const errors = {};

if (!authForm.email) errors.email = true;
if (!authForm.password) errors.password = true;

if (Object.keys(errors).length > 0) {
  setAuthErrors(errors);
  setAuthMessage('Введіть email і пароль');
  setAuthMessageType('error');
  return;
}

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authForm.email,
        password: authForm.password
      })
    });

    const data = await res.json();

    if (!res.ok) {
  const errorMessage =
    typeof data.detail === 'string'
      ? data.detail
      : 'Помилка входу';

  setAuthMessage(errorMessage);
  setAuthMessageType('error');

  // 👇 ВАЖНО: отдельная обработка
  if (errorMessage.toLowerCase().includes('підтвердіть')) {
    setAuthErrors({ email: true });
  } else {
    setAuthErrors({ email: true, password: true });
  }

  return;
}

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);

    setUser(data.user);

  } catch (err) {
  console.error('LOGIN ERROR:', err);

  setAuthMessage('Помилка підключення до backend');
  setAuthMessageType('error');
  setAuthErrors({ email: true, password: true });
}
};

const handleResetPassword = async () => {
  if (!resetPassword || resetPassword.length < 6) {
    setAuthMessage('Пароль має містити мінімум 6 символів');
    setAuthMessageType('error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        new_password: resetPassword
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setAuthMessage(data.detail || 'Помилка зміни пароля');
      setAuthMessageType('error');
      return;
    }

    setAuthMessage('Пароль успішно змінено. Тепер можна увійти.');
    setAuthMessageType('success');
    setResetToken('');
    setResetPassword('');
    window.history.replaceState({}, document.title, '/');
  } catch (err) {
    setAuthMessage('Помилка підключення до backend');
    setAuthMessageType('error');
  }
};

const handleResendVerification = async () => {
  if (!authForm.email) {
    setAuthErrors({ email: true });
    setAuthMessage('Введіть email');
    setAuthMessageType('error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authForm.email })
    });
    const data = await res.json();
    setAuthMessage(data.message || 'Лист надіслано повторно');
    setAuthMessageType(res.ok ? 'success' : 'error');
  } catch (err) {
    setAuthMessage('Помилка підключення до backend');
    setAuthMessageType('error');
  }
};


  const [tasks, setTasks] = useState(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("tasks"));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
});
  const [tasksLoaded, setTasksLoaded] = useState(false);

useEffect(() => {
  const loadTasks = async () => {
    const token = localStorage.getItem('token');

    if (!user || !token) return;

    const res = await fetch(`${API_URL}/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

   const data = await res.json();

setTasks(Array.isArray(data) ? data : []);

setTasksLoaded(true);
  };

  loadTasks();
}, [user]);

  const archivedTasks = tasks.filter((task) => task.status === 'done');


  const [sortType, setSortType] = useState('smart');






const sortedTasksForView = [...tasks]
  .filter(task => task.status !== 'done')
  .sort((a, b) => {



    // 🧠 Умная сортировка
    if (sortType === 'smart') {
      const getScore = (task) => {
        let score = 0;

        if (task.priority === 'high') score += 3;
        if (task.priority === 'medium') score += 2;
        if (task.priority === 'low') score += 1;

        if (task.deadline) {
          const daysLeft =
            (new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24);

          if (daysLeft < 0) score += 5;
          else if (daysLeft <= 1) score += 3;
          else if (daysLeft <= 3) score += 2;
          else score += 1;
        }

        score += task.postponedCount * 2;

        return score;
      };

      return getScore(b) - getScore(a);
    }

    
    
    // 📅 По дате и времени
    if (sortType === 'date') {
      const dateA = a.deadline || '9999-12-31';
      const dateB = b.deadline || '9999-12-31';

      if (dateA !== dateB) {
        return new Date(dateA) - new Date(dateB);
      }

      const timeA = a.time || '23:59';
      const timeB = b.time || '23:59';

      return timeA.localeCompare(timeB);
    }

    // 🔥 По приоритету
    if (sortType === 'priority') {
      const weight = { high: 3, medium: 2, low: 1 };
      return weight[b.priority] - weight[a.priority];
    }

    return 0;
  });

  const visibleTasks = showArchive ? archivedTasks : sortedTasksForView;
const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = a.deadline || '9999-12-31';
    const dateB = b.deadline || '9999-12-31';

    if (dateA !== dateB) {
      return new Date(dateA) - new Date(dateB);
    }

    const timeA = a.time || '23:59';
    const timeB = b.time || '23:59';

    return timeA.localeCompare(timeB);
  });

  const getRecommendedTask = () => {
  const activeTasks = tasks.filter((task) => task.status !== 'done');

  if (activeTasks.length === 0) return null;

  return activeTasks
    .map((task) => {
      let score = 0;

      if (task.priority === 'high') score += 3;
      if (task.priority === 'medium') score += 2;
      if (task.priority === 'low') score += 1;

      if (task.deadline) {
        const daysLeft =
          (new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24);

        if (daysLeft < 0) score += 5;
        else if (daysLeft <= 1) score += 3;
        else if (daysLeft <= 3) score += 2;
        else score += 1;
      }

      score += task.postponedCount * 2;

      return { ...task, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const dateA = a.deadline || '9999-12-31';
      const dateB = b.deadline || '9999-12-31';

      if (dateA !== dateB) {
        return new Date(dateA) - new Date(dateB);
      }

      const timeA = a.time || '23:59';
      const timeB = b.time || '23:59';

      return timeA.localeCompare(timeB);
    })[0];
};

  const recommendedTask = getRecommendedTask();

  const importantTasks = tasks
  .filter((task) => task.status !== 'done')
  .map((task) => {
    let score = 0;

    if (task.priority === 'high') score += 3;
    if (task.priority === 'medium') score += 2;
    if (task.priority === 'low') score += 1;

    if (task.deadline) {
      const daysLeft =
        (new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24);

      if (daysLeft < 0) score += 5;
      else if (daysLeft <= 1) score += 3;
      else if (daysLeft <= 3) score += 2;
      else score += 1;
    }

    score += task.postponedCount * 2;

    return { ...task, score };
  })
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const dateA = a.deadline || '9999-12-31';
    const dateB = b.deadline || '9999-12-31';

    if (dateA !== dateB) return new Date(dateA) - new Date(dateB);

    const timeA = a.time || '23:59';
    const timeB = b.time || '23:59';

    return timeA.localeCompare(timeB);
  });


  
const nextTask = importantTasks[1] || null;

  useEffect(() => {
  const loadTasks = async () => {
    const token = localStorage.getItem('token');

    if (!user || !token) return;

    const res = await fetch(`${API_URL}/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

setTasks(Array.isArray(data) ? data : []);
  };

  loadTasks();
}, [user]);

useEffect(() => {
  const saveTasks = async () => {
    const token = localStorage.getItem('token');

    if (!user || !token || !tasksLoaded) return;

    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(tasks)
    });
  };

  saveTasks();
}, [tasks, user, tasksLoaded]);

  useEffect(() => {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      console.log("Permission:", permission);
    });
  }
  }, []);

  const sendNotification = (task) => {
  if (Notification.permission === "granted") {
    new Notification("Завдання на підході", {
      body: `${task.title} в ${task.time || ''}`,
    });
  }
};



useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();

    tasks.forEach(task => {
      if (task.status === 'done' || !task.deadline || !task.time) return;

      const taskDateTime = new Date(`${task.deadline}T${task.time}:00`);
      const diff = taskDateTime - now;
      console.log('permission:', Notification.permission);
      console.log('task:', task.title, 'diff:', diff / 1000);

      if (diff > 0 && diff < 10 * 60 * 1000 && !task.notified) {
  sendNotification(task);

  setTasks((prevTasks) =>
    prevTasks.map((t) =>
      t.id === task.id ? { ...t, notified: true } : t
    )
  );
}
    });

  }, 30000);

  return () => clearInterval(interval);
}, [tasks]);

  const priorityLabels = {
    low: 'Низький',
    medium: 'Середній',
    high: 'Високий'
  };

  const statusLabels = {
    todo: 'До виконання',
    inprogress: 'У процесі',
    done: 'Виконано'
  };

  const priorityColors = {
    low: '#6b7280',
    medium: '#d97706',
    high: '#dc2626'
  };

const addTask = () => {
  if (taskText.trim() === '') return;

  if (editingTaskId) {
    setTasks(
      tasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title: taskText,
              description: taskDescription,
              priority,
              deadline,
              time: taskTime,
              status
            }
          : task
      )
    );
    setEditingTaskId(null);
  } else {
    const newTask = {
      id: Date.now(),
      title: taskText,
      description: taskDescription,
      priority,
      deadline,
      time: taskTime,
      status,
      postponedCount: 0,
      notified: false
    };

    setTasks([...tasks, newTask]);
  }

  setTaskText('');
  setTaskDescription('');
  setPriority('medium');
  setDeadline('');
  setTaskTime('');
  setStatus('todo');
};

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const changeStatus = (id, newStatus) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, status: newStatus } : task
      )
    );
  };

  const editTask = (task) => {
    setTaskText(task.title);
    setTaskDescription(task.description || '');
    setPriority(task.priority);
    setDeadline(task.deadline);
    setTaskTime(task.time || '');
    setStatus(task.status);
    setEditingTaskId(task.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

 const startPostponeTask = (task) => {
  setPostponingTaskId(task.id);
  setPostponeDate(task.deadline || '');
  setPostponeTime(task.time || '');
};

const savePostponeTask = (id) => {
  if (!postponeDate || !postponeTime) {
    alert('Вкажи дату та час');
    return;
  }

  setTasks(tasks.map(task =>
    task.id === id
      ? {
          ...task,
          deadline: postponeDate,
          time: postponeTime,
          postponedCount: task.postponedCount + 1,
          notified: false
        }
      : task
  ));

  setPostponingTaskId(null);
  setPostponeDate('');
  setPostponeTime('');
};

const cancelPostponeTask = () => {
  setPostponingTaskId(null);
  setPostponeDate('');
  setPostponeTime('');
};

  

  const getAIAdvice = async () => {
  if (!recommendedTask) {
    setAiAdvice('Немає завдань для виконання.');
    return;
  }

 try {
  setLoadingAI(true);

 const response = await fetch(`${API_URL}/ai-advice`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    {
      title: recommendedTask.title,
      description: recommendedTask.description || '',
      priority: recommendedTask.priority,
      deadline: recommendedTask.deadline,
      time: recommendedTask.time || '',
      postponedCount: recommendedTask.postponedCount
    }
  ])
});

  console.log('STATUS:', response.status);

  const data = await response.json();
  console.log('DATA:', data);

  setAiAdvice(data.result || 'Немає відповіді від AI');

} catch (err) {
  console.error('AI ERROR:', err);
  setAiAdvice('Помилка підключення до backend');
} finally {
  setLoadingAI(false);
}
};

  

  const completedTasksCount = tasks.filter(task => task.status === 'done').length;
  const efficiency =
  tasks.length === 0
    ? 0
    : Math.round((completedTasksCount / tasks.length) * 100);
  const postponedTasksCount = tasks.reduce((sum, task) => sum + task.postponedCount, 0);
  const activeTasksCount = tasks.filter(task => task.status !== 'done').length;

  const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  return monday;
};

const startOfWeek = getStartOfWeek();

const weekDays = Array.from({ length: 7 }, (_, index) => {
  const current = new Date(startOfWeek);
  current.setDate(startOfWeek.getDate() + index);

  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;

  const tasksForDay = sortedTasks
    .filter((task) => task.deadline === dateString && task.status !== 'done')
    .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  return {
    label: labels[index],
    shortDate: `${dd}.${mm}`,
    date: dateString,
    tasks: tasksForDay
  };

  
});

if (resetToken) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🔐</div>
        <h2>Зміна пароля</h2>
        <p>Введіть новий пароль для акаунта</p>

        <input
          type="password"
          placeholder="Новий пароль"
          className="auth-input"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
        />

        {authMessage && (
          <div className={`auth-message ${authMessageType}`}>
            {authMessage}
          </div>
        )}

        <button onClick={handleResetPassword}>
          Зберегти новий пароль
        </button>
      </div>
    </div>
  );
}

if (!user) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🧠</div>
        <h2>Інтелектуальний планувальник</h2>
        <p>Увійдіть або створіть акаунт</p>
      <h2>Реєстрація/Вхід</h2>

      <input
        placeholder="Ім’я при реєстрації"
        className={authErrors.name ? 'auth-input error' : 'auth-input'}
        value={authForm.name}
        onChange={(e) =>
          setAuthForm({ ...authForm, name: e.target.value })
        }
      />

      <input
        placeholder="Email"
        className={authErrors.email ? 'auth-input error' : 'auth-input'}
        value={authForm.email}
        onChange={(e) =>
          setAuthForm({ ...authForm, email: e.target.value })
        }
      />

      <input
        type="password"
        placeholder="Пароль"
        className={authErrors.password ? 'auth-input error' : 'auth-input'}
        value={authForm.password}
        onChange={(e) =>
          setAuthForm({ ...authForm, password: e.target.value })
        }
      />
{authMessage && (
  <div className={`auth-message ${authMessageType}`}>
    {authMessage}
  </div>
)}
      <div className="auth-buttons">
  <button onClick={handleRegister}>Зареєструватися</button>
  <button onClick={handleLogin}>Увійти</button>
</div>
<div style={{ textAlign: 'center', marginTop: '10px' }}>
  <button className="auth-link-btn" onClick={handleForgotPassword}>
    Забули пароль?
  </button>
</div>
<button
  style={{
    marginTop: '10px',
    background: 'transparent',
    color: '#2563eb',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline'
  }}
  onClick={handleResendVerification}
>
  Не прийшов лист? Надіслати повторно
</button>
    </div>
    </div>
  );
}

return (
  <div className="page-shell">
    <div className="mobile-tabs">
  <button
    className={mobileTab === 'plan' ? 'active-tab' : ''}
    onClick={() => setMobileTab('plan')}
  >
    Планувальник
  </button>

  <button
    className={mobileTab === 'tasks' ? 'active-tab' : ''}
    onClick={() => setMobileTab('tasks')}
  >
    Завдання
  </button>

  <button
    className={mobileTab === 'calendar' ? 'active-tab' : ''}
    onClick={() => setMobileTab('calendar')}
  >
    Календар
  </button>
</div>
    <div className="layout">

      <div className={`panel left-panel ${mobileTab === 'plan' ? 'mobile-active' : ''}`}>
        <div className="panel-header header-row">
  <h1>Планувальник завдань</h1>

  <button
    className="logout-btn"
    onClick={() => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      setTasks([]);
      setTasksLoaded(false);
    }}
  >
    Вийти
  </button>
</div>

        <button
  onClick={() => Notification.requestPermission()}
  style={{
    marginBottom: '10px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none'
  }}
>
  Дозволити повідомлення
</button>

        <div className="panel-content">
          <div className="form-block">
            <input
              type="text"
              placeholder="Назва задачі"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
            />
            <input
              type="text"
              placeholder="Короткий опис"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Низький пріоритет</option>
              <option value="medium">Середній пріоритет</option>
              <option value="high">Високий пріоритет</option>
            </select>

            <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            <input
              type="time"
              value={taskTime}
              onChange={(e) => setTaskTime(e.target.value)}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todo">До виконання</option>
              <option value="inprogress">У процесі</option>
              <option value="done">Виконано</option>
            </select>

            <button onClick={addTask}>
              {editingTaskId ? 'Зберегти' : 'Додати завдання'}
            </button>
          </div>

          <h2>Рекомендується виконати:</h2>
          
          {recommendedTask ? (
            <div className="recommend-block">
              <strong>{recommendedTask.title}</strong>
              <p>{recommendedTask.description || 'Без опису'}</p>
              <p>
                Пріоритет:{' '}
                <span style={{ color: priorityColors[recommendedTask.priority], fontWeight: 'bold' }}>
                  {priorityLabels[recommendedTask.priority]}
                </span>
              </p>

              <p
                style={{
                  color:
                    recommendedTask.deadline &&
                    new Date(recommendedTask.deadline) < new Date()
                      ? 'red'
                      : 'inherit'
                }}
              >
                Дедлайн: {recommendedTask.deadline || 'не вказано'}
              </p>
              <p>Час: {recommendedTask.time || 'не вказано'}</p>
            </div>
          ) : (
            <div className="recommend-block">
              <p>Немає завдань для виконання 🎉</p>
            </div>
          )}

          <div className="top-actions">
            <button
              disabled={!recommendedTask}
              onClick={() => changeStatus(recommendedTask?.id, 'done')}
            >
              Виконати рекомендоване завдання
            </button>

            <button onClick={getAIAdvice} disabled={loadingAI}>
              {loadingAI ? 'Думаю...' : 'Отримати пораду від AI'}
            </button>
          </div>

          <div className="ai-block ai-fixed">
            <h3>AI порада:</h3>
            <div className="ai-scroll">
              <p>{aiAdvice || 'Порада від AI зявиться після натискання кнопки.'}</p>
            </div>
          </div>

          <div className="stats-block">
            <h3>Статистика:</h3>
            <p>Активних завдань: {activeTasksCount}</p>
            <p>Виконаних завдань: {completedTasksCount}</p>
            <p>Усього відкладань: {postponedTasksCount}</p>
            <p>Ефективність: {efficiency}%</p>
          </div>
        </div>
      </div>

      <div className={`panel right-panel ${mobileTab === 'tasks' ? 'mobile-active' : ''}`}>
        <div className="panel-header">
          <h2>Список завдань</h2>
        </div>
          <div className="sort-controls">
            <label>Сортування:</label>
          <button onClick={() => setShowArchive(!showArchive)}>
            {showArchive ? 'Приховати архів' : 'Показати архів завдань'}
          </button>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
            >
              <option value="smart">За важливістю (AI)</option>
              <option value="date">За датою та часом</option>
              <option value="priority">За пріоритетом</option>
            </select>
          </div>
        <div className="panel-content right-content">
          <div className="tasks-container">
            {visibleTasks.length === 0 ? (
              <div className="task-card">
                <p>Завдання поки немає</p>
              </div>
            ) : (
              visibleTasks.map((task) => {
                const isOverdue =
                  task.deadline && new Date(task.deadline) < new Date();

                return (
                  <div
                    className={`task-card ${task.id === recommendedTask?.id ? 'highlight' : ''}`}
                    key={task.id}
                  >
                    <div className="task-main-row">
                    <div className="task-col">
                      <div className="task-title">{task.title}</div>
                      <p>{task.description || 'Без опису'}</p>
                    </div>

                    <div className="task-col">
                      <p>
                        Пріоритет:{' '}
                        <span style={{ color: priorityColors[task.priority], fontWeight: 'bold' }}>
                          {priorityLabels[task.priority]}
                        </span>
                      </p>
                      <p>Статус: {statusLabels[task.status]}</p>
                      <p>Відкладалася: {task.postponedCount} раз</p>
                    </div>

                    <div className="task-col">
                      <p style={{ color: isOverdue ? 'red' : 'inherit' }}>
                        Дедлайн: {task.deadline || 'не вказано'}
                      </p>
                      <p>Час: {task.time || 'не вказано'}</p>
                    </div>
                  </div>

                    <select
                      value={task.status}
                      onChange={(e) => changeStatus(task.id, e.target.value)}
                    >
                      <option value="todo">До виконання</option>
                      <option value="inprogress">У процесі</option>
                      <option value="done">Виконано</option>
                    </select>

                    <div className="action-buttons">
                      <button onClick={() => editTask(task)}>Редагувати</button>
                      <button onClick={() => startPostponeTask(task)}>Відкласти</button>
                      <button onClick={() => deleteTask(task.id)}>Видалити</button>
                    </div>
                    {postponingTaskId === task.id && (
                    <div className="postpone-panel">
                      <div className="date-time-row">
                        <input
                          type="date"
                          value={postponeDate}
                          onChange={(e) => setPostponeDate(e.target.value)}
                        />

                       <input
                        type="time"
                        value={postponeTime}
                        onChange={(e) => setPostponeTime(e.target.value)}
                      />
                      </div>

                      <div className="action-buttons">
                        <button onClick={() => savePostponeTask(task.id)}>Зберегти перенесення</button>
                        <button onClick={cancelPostponeTask}>Скасування</button>
                      </div>
                    </div>
                  )}
                  </div>
                  
                );
              })
            )}
          </div>
        </div>
      </div>
            <div className={`panel third-panel ${mobileTab === 'calendar' ? 'mobile-active' : ''}`}>
  <div className="panel-header">
    <h2>Завдання на черзі</h2>
  </div>

  <div className="panel-content">
    {nextTask ? (
      <div className="recommend-block">
        <strong>{nextTask.title}</strong>
        <p>{nextTask.description || 'Без описания'}</p>
        <p>
          Пріоритет:{' '}
          <span style={{ color: priorityColors[nextTask.priority], fontWeight: 'bold' }}>
            {priorityLabels[nextTask.priority]}
          </span>
        </p>
        <p
          style={{
            color:
              nextTask.deadline &&
              new Date(nextTask.deadline) < new Date()
                ? 'red'
                : 'inherit'
          }}
        >
          Дедлайн: {nextTask.deadline || 'не вказано'}
        </p>
        <p>Час: {nextTask.time || 'не вказано'}</p>
      </div>
    ) : (
      <div className="recommend-block">
        <p>Наступного завдання поки що немає.</p>
      </div>
    )}

    <div className="calendar-box">
  <div className="calendar-title calendar-title-row">
  <button onClick={() => setWeekOffset(weekOffset - 1)}>←</button>

  <h2>
    {weekOffset === 0
      ? 'Поточний тиждень'
      : weekOffset > 0
        ? `Через ${weekOffset} тиж.`
        : `${Math.abs(weekOffset)} тиж. тому`}
  </h2>

  <button onClick={() => setWeekOffset(weekOffset + 1)}>→</button>
</div>

<button className="today-week-btn" onClick={() => setWeekOffset(0)}>
  Поточний тиждень
</button>

  <div className="mini-calendar">
      {weekDays.map((day) => (
        <div className="calendar-day" key={day.date}>
          <div className="calendar-day-header">
            <strong>{day.label}</strong>
            <span>{day.shortDate}</span>
          </div>

          

          <div className="calendar-day-tasks">
            {day.tasks.length > 0 ? (
              day.tasks.map((task) => (
                <div className="calendar-task" key={task.id}>
                  <div>{task.title}</div>
                  <small>{task.time || 'без часу'}</small>
                </div>
              ))
            ) : (
              <div className="calendar-empty">Немає завдань</div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
    </div>
  </div>
    </div>

);
}

export default App;
