# AI-Powered Intern Task Management & Evaluation System (backend core)
```
cd backend && pip install -r requirements.txt
cp ../.env.example ../.env   # export vars or use your shell/env loader
DATA_DIR=../data uvicorn main:app --reload      # docs: http://localhost:8000/docs
pytest -q                                        # run from backend/
```
Flow: login admin -> POST /resumes/extract -> POST /interns -> POST /tasks (emails intern) -> intern POST /tasks/{id}/submit -> reviews; admin POST /interns/{id}/decision.
Modes: email is MOCK (logged as MOCK_NOT_SENT) until SMTP_HOST is set; AI is a MOCK keyword-evidence heuristic until you implement an LLM branch in `ai_evaluate`.
Feedback never touches evaluation code. Confidential feedback hides identity in API and in the Excel sheet.

## Frontend (React + Vite + Tailwind + Recharts)
```
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api -> http://localhost:8000)
```
Admin: Overview (stats, charts, Excel download), Interns (resume upload -> confirm), Tasks (create/review history), Feedback (analysis, status, notes). Intern: My tasks (submit/resubmit), Feedback form + history.

## AI Assistant (chatbot)
Backend `backend/chat.py` (`POST /chat`, `GET/DELETE /chat/history`), frontend `frontend/src/Chat.jsx` ("Assistant" tab for both roles).
Interns get answers only from their own tasks/reviews; admins get aggregate stats. Read-only: it cannot change scores or decisions.
Default is a rule-based MOCK. For real LLM answers set `AI_PROVIDER=anthropic`, `AI_API_KEY`, optionally `AI_MODEL` in the backend environment; replies show their mode (llm / mock / mock-fallback).
