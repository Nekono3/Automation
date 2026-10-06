# INSTA CRM — AI-Powered Customer & Consultation Management

AI-powered Instagram Customer Management and Consulting Booking Platform.

---

## 🛠 Local Development Setup

### 1. Requirements
* Python 3.11+
* Docker & Docker Compose
* uv package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your Meta and Mistral credentials when ready.

### 3. Start PostgreSQL Database
```bash
docker compose up -d postgres
```
Verify container is healthy:
```bash
docker ps
```

### 4. Setup Python Backend
```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### 5. Run Tests
```bash
pytest -v
```

### 6. Start Development Server
```bash
uvicorn app.main:app --reload --port 8000
```
Open interactive Swagger docs at: [http://localhost:8000/docs](http://localhost:8000/docs)
Health check at: [http://localhost:8000/api/health](http://localhost:8000/api/health)
