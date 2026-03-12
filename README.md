# 🤖 DevTaskManager: סוכן RAG אג'נטי לניתוח ידע הנדסי

## 📖 סקירה כללית

מערכת RAG (Retrieval-Augmented Generation) מתקדמת המבוססת על **LlamaIndex Workflows**, שנועדה לאחד ולנתח תיעוד טכני מבוזר המופק על ידי כלי פיתוח מבוססי AI (כגון Claude ו-Cursor). 

הסוכן מסוגל לחלץ את ה-**"Mental Model"** של הפרויקט, להבין החלטות ארכיטקטוניות ולזהות סיכוני אבטחה מתוך עשרות קבצי Markdown ותיעוד גולמי.

---

## 🚀 יכולות ליבה

- **Agentic Workflow**: ניהול זרימת עבודה מונחת אירועים (Event-Driven) הכוללת ניתוב שאילתות, אימות מידע ותיקון עצמי.

- **Intelligent Routing**: ניתוב חכם בין חיפוש סמנטי (Vector Search) לשליפת נתונים מובנים (Structured Data) על בסיס כוונת המשתמש.

- **Self-Correction & Retry**: מנגנון בדיקה עצמית של איכות השליפה (Similarity Score). במידה והמידע אינו מספק, הסוכן מבצע ניסוח מחדש (Query Rewriting) וחיפוש רחב יותר.

- **Structured Knowledge Extraction**: חילוץ אוטומטי של החלטות (Decisions), חוקי פיתוח (Rules) ואזהרות (Warnings) לתוך בסיס ידע מובנה באמצעות Pydantic Schemas.

---

## 🛠 טכנולוגיות

| רכיב | טכנולוגיה |
|-----|---------|
| **LLM** | Cohere (Command R+) |
| **Framework** | LlamaIndex (Workflows, Programs) |
| **Vector DB** | Pinecone |
| **Embeddings** | Cohere Multilingual-v3 |
| **UI** | Gradio |

---

## 📁 מבנה הפרויקט

- **DevTaskManager/**: פרויקט המקור (Frontend/Backend) הכולל את התיעוד שנוצר ע"י ה-AI.

- **RAG/**: קוד הסוכן האג'נטי (Jupyter Notebook).

- **RAG/project_knowledge_base_V2.json**: בסיס הידע המובנה שחולץ מהפרויקט.

---

## 💡 דוגמאות לשימוש (Example Queries)

הסוכן מצטיין בניתוח הקשרים טכניים מורכבים והצלבת מידע ממקורות שונים. להלן מספר דוגמאות לשאלות שהסוכן פותר בצורה מדויקת:

### 1️⃣ הבנת רציונל ארכיטקטוני (Architectural Rationale)

> **שאלה:** Explain the rationale behind switching from LocalStorage to Cookies for JWT management.
>
> **מה זה מראה?** יכולת להבין את ה"למה" מאחורי שינויי קוד, זיהוי סיכוני אבטחה כמו XSS והבנת היתרונות של HttpOnly Cookies.
>
> **מקורות מידע:** הצלבה בין `decisions.md` ל-`known-issues.md`.

---

### 2️⃣ ניתוח סיכוני אבטחה לפי חומרה (Security Risk Analysis)

> **שאלה:** List all security risks categorized as 'Critical' or 'High' severity from the extracted knowledge base.
>
> **מה זה מראה?** שימוש ב-Structured Extraction כדי לסווג מידע גולמי לרמות חומרה (Severity) ולהציג תמונת מצב ניהולית של סיכונים.
>
> **מקורות מידע:** חילוץ מובנה מ-`security-notes.md` ו-`warnings.md`.

---

### 3️⃣ חיזוי השפעה של שינויי קוד (Impact Analysis)

> **שאלה:** What would happen if I remove the 'withCredentials: true' flag from the frontend Axios configuration?
>
> **מה זה מראה?** קישור ישיר בין הגדרות מימוש ב-Frontend לבין פרוטוקולי אבטחה (CORS) ב-Backend, והבנת ההשפעה על תהליך ה-Authentication.
>
> **מקורות מידע:** ניתוח חוקי ה-API Gateway בתוך התיעוד.

---

### 4️⃣ זיהוי סתירות ועדכניות מידע (Conflict Resolution)

> **שאלה:** Are there any conflicting instructions regarding where to store JWT tokens? Check both decisions and migration notes.
>
> **מה זה מראה?** הסוכן יודע לזהות סתירות בין מסמכים ישנים לחדשים ולתת עדיפות להחלטה המאוחרת ביותר (למשל, המעבר מ-LocalStorage ל-Sessions).
>
> **מקורות מידע:** ניתוח היסטוריית החלטות (ADRs).

## ⚙️ הוראות התקנה והרצה

### 1️⃣ שיבוט הפרויקט

```bash
git clone https://github.com/shoshi-raz/Rag-LlamaIndex-Project.git
cd RAG_PROJECT
```

### 2️⃣ התקנת ספריות

```bash
pip install -r RAG/requirements.txt
```

### 3️⃣ הגדרת משתני סביבה

צרו קובץ `.env` בתוך תיקיית RAG עם המפתחות הבאים:

```env
COHERE_API_KEY=your_key
PINECONE_API_KEY=your_key
```

### 4️⃣ הרצה

פתחו את הקובץ `RAG/rag_project.ipynb` והריצו את כל התאים (Run All). בסיום ההרצה יופיע קישור לממשק Gradio אינטראקטיבי.