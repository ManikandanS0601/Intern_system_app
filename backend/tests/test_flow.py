import os, tempfile
from pathlib import Path
from docx import Document
d = tempfile.mkdtemp(); os.environ.update(DATA_DIR=d, DATABASE_URL=f"sqlite:///{d}/t.db")
from fastapi.testclient import TestClient
from main import app
CR = ["Create employee endpoint", "Retrieve employee identifier", "Update employee details", "Delete employee record", "Validate input data", "Persist database storage"]
def H(t): return {"Authorization": "Bearer " + t}
def setup(c, email):
    a = H(c.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"}).json()["token"])
    r = c.post("/interns", json={"name": "Test", "email": email, "skills": ["java"]}, headers=a).json()
    i = H(c.post("/auth/login", json={"email": email, "password": r["temporary_password"]}).json()["token"])
    task = c.post("/tasks", json={"intern_id": r["intern_id"], "title": "API", "description": "d", "deadline": "2026-12-01", "criteria": [{"text": x} for x in CR]}, headers=a).json()
    assert task["email_status"]
    t = task["task_id"]
    return a, i, t, r["intern_id"]
def test_revision_then_pass_and_feedback_isolated():
    with TestClient(app) as c:
        a, i, t, iid = setup(c, "a@x.com")
        r1 = c.post(f"/tasks/{t}/submit", json={"content": "create employee endpoint, retrieve employee identifier, update employee details, delete employee record"}, headers=i).json()
        assert r1["status"] == "NEEDS_REVISION" and len(r1["feedback"]) > 10
        r2 = c.post(f"/tasks/{t}/submit", json={"content": " ".join(CR) + " done"}, headers=i).json()
        assert r2["status"] == "COMPLETED" and r2["round"] == 2
        assert c.post("/feedback", json={"category": "General Feedback", "ratings": {"overall": 2}, "confidential": True}, headers=i).status_code == 201
        assert c.get("/admin/feedback", headers=a).json()[0]["intern_name"] is None
        assert c.get("/feedback/mine", headers=a).status_code == 403
        assert c.get(f"/tasks/{t}/reviews", headers=i).json()[-1]["score"] == 100
def test_three_failures_need_admin_approval():
    with TestClient(app) as c:
        a, i, t, iid = setup(c, "b@x.com")
        for _ in range(3): r = c.post(f"/tasks/{t}/submit", json={"content": "nothing relevant to the task here at all"}, headers=i).json()
        assert r["status"] == "REVIEW_FAILED" and "PENDING_ADMIN" in r["recommendation"]
        assert c.get("/interns", headers=a).json()[-1]["decision"] == "ACTIVE"
        assert c.post(f"/interns/{iid}/decision", json={"decision": "REJECT"}, headers=a).status_code == 200
        assert c.post(f"/tasks/{t}/submit", json={"content": "x" * 40}, headers=i).status_code == 409

def test_uploaded_resume_is_linked_and_welcome_email_status_returned():
    with TestClient(app) as c:
        a = H(c.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"}).json()["token"])
        resume_name = "uploaded-test-resume.docx"
        resume_path = Path(os.environ["DATA_DIR"]) / "resumes" / resume_name
        resume_path.parent.mkdir(parents=True, exist_ok=True)
        resume = Document()
        resume.add_paragraph("Candidate email: candidate-from-resume@example.com")
        resume.save(resume_path)

        created = c.post("/interns", json={
            "name": "Resume Candidate",
            "email": "incorrect-form-email@example.com",
            "resume": resume_name,
        }, headers=a)
        assert created.status_code == 201
        result = created.json()
        assert result["email_to"] == "candidate-from-resume@example.com"
        assert result["email_status"] == "MOCK_NOT_SENT"
        assert c.post("/auth/login", json={
            "email": "candidate-from-resume@example.com",
            "password": result["temporary_password"],
        }).status_code == 200

        intern = next(i for i in c.get("/interns", headers=a).json() if i["id"] == result["intern_id"])
        assert intern["has_resume"] is True
        downloaded = c.get(f"/interns/{result['intern_id']}/resume", headers=a)
        assert downloaded.status_code == 200
        assert downloaded.content == resume_path.read_bytes()

def test_smtp_without_password_reports_not_configured(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_FROM", "sender@example.com")
    monkeypatch.setenv("SMTP_USER", "sender@example.com")
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    with TestClient(app) as c:
        a = H(c.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"}).json()["token"])
        created = c.post("/interns", json={
            "name": "SMTP Candidate",
            "email": "smtp-candidate@example.com",
        }, headers=a)
        assert created.status_code == 201
        assert "SMTP_PASSWORD" in created.json()["email_status"]
