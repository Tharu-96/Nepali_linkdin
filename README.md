# Rozgar

Rozgar is a full-stack job marketplace project with:

- `frontend/`: React + Vite
- `backend/`: FastAPI + SQLAlchemy
- local database support through `SQLite`
- optional support for `PostgreSQL`

This guide explains what is required to install, configure, and run the project on another PC.

## Stack

- Frontend: `React`, `Vite`, `React Router`, `Recharts`
- Backend: `FastAPI`, `Uvicorn`, `SQLAlchemy`
- Database: `SQLite` by default, `PostgreSQL` optional
- Real-time: `WebSocket`
- Optional integrations:
  - optional assistant/search enhancement service
  - `Google Maps` APIs for maps and distance features
  - `Google OAuth`
  - `eSewa` and `Khalti` payment gateways
  - email credentials for password reset

## What Is Required

Install these on the other PC:

- `Python 3.10` or `Python 3.11`
- `Node.js 18+` or `Node.js 20+`
- `npm` (comes with Node.js)
- `Git` optional
- `PostgreSQL` only if you want Postgres instead of SQLite

`PHP` is not required for this project.

## Recommended Transfer Method

Copy the full project folder to the other PC.

If you want the same existing data and settings, also make sure these files are present on the new PC:

- `backend/rozgar.db`
- `backend/.env`

If you copy the whole project folder, these should already come with it.

## Project Structure

```text
Rozgar/
  backend/
  frontend/
  static/
  .env.example
  RUN_INSTRUCTIONS.txt
  start-dev.ps1
```

## Quick Start

Run the backend in one terminal and the frontend in another terminal.

### 1. Backend Setup

Open a terminal in the project root and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

If PowerShell blocks activation, run this once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Backend Environment File

Create or update `backend/.env`.

For the easiest local setup, use SQLite:

```env
DATABASE_URL=sqlite:///./rozgar.db
SECRET_KEY=change_this_to_a_random_hex_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

GROQ_API_KEY=
SENDER_EMAIL=
SENDER_PASSWORD=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
GOOGLE_GEOCODING_API_KEY=
GOOGLE_DISTANCE_MATRIX_API_KEY=

ESEWA_MERCHANT_CODE=EPAYTEST
ESEWA_SECRET_KEY=change_this_for_production
ESEWA_PAYMENT_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form
ESEWA_VERIFY_URL=https://rc.esewa.com.np/api/epay/txnstatus/

KHALTI_SECRET_KEY=
KHALTI_PUBLIC_KEY=
KHALTI_BASE_URL=https://a.khalti.com/api/v2
KHALTI_INITIATE_URL=
KHALTI_LOOKUP_URL=

PLATFORM_COMMISSION_RATE=0.08
FRONTEND_BASE_URL=http://localhost:5173
PAYMENT_SUCCESS_URL=http://localhost:5173/payment/success
PAYMENT_FAILURE_URL=http://localhost:5173/payment/failed
```

Notes:

- `DATABASE_URL=sqlite:///./rozgar.db` uses the local SQLite database file.
- If you copied `backend/rozgar.db`, your old data will be available immediately.
- If `GROQ_API_KEY` is empty, the app still runs, but the optional assistant and search enhancement features fall back to basic behavior.

### 3. Start Backend

From `backend/`:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Backend URL:

- `http://127.0.0.1:8000`

### 4. Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

## Full Run Commands

### Terminal 1: Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 2: Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Optional: Create Admin User

If your copied database does not already contain an admin account:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python create_admin.py "Admin User" admin@rozgar.com admin123
```

## Optional: PostgreSQL Setup

If you want PostgreSQL instead of SQLite:

1. Install PostgreSQL.
2. Create a database named `rozgar`.
3. Update `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/rozgar
```

4. Then run:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python migrate.py
python -c "from app.core.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

For most local transfers, `SQLite` is simpler and enough.

## Important Files To Keep

When moving the project to another PC, these are the most important files:

- `backend/.env`
- `backend/rozgar.db`
- `frontend/package.json`
- `backend/requirements.txt`

## Optional Features And Their Keys

These are not required just to start the project, but they are required for some features:

- `GROQ_API_KEY`: optional assistant and search enhancement features
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google auth related backend integration
- `GOOGLE_MAPS_API_KEY`, `GOOGLE_GEOCODING_API_KEY`, `GOOGLE_DISTANCE_MATRIX_API_KEY`: maps and distance features
- `SENDER_EMAIL`, `SENDER_PASSWORD`: email and password reset
- `ESEWA_*`: eSewa payments
- `KHALTI_*`: Khalti payments

## Frontend Notes

The frontend uses Vite dev proxy and expects the backend on port `8000`.

The local setup already matches:

- frontend: `http://localhost:5173`
- backend: `http://127.0.0.1:8000`

## WebSocket Notes

Chat uses WebSocket support through the backend.

As long as:

- backend is running on `8000`
- frontend is running on `5173`
- the user is logged in properly

chat should work locally.

## If You Copied Existing Data

If you copied `backend/rozgar.db` from the old PC:

- old users should still exist
- old jobs, applications, payments, and reviews should still exist
- admin accounts should still exist

## Troubleshooting

### Backend does not start

Check:

- Python is installed correctly
- virtual environment is activated
- dependencies installed successfully
- `backend/.env` exists

### Frontend does not start

Check:

- Node.js is installed
- `npm install` completed successfully

### Login works but some features fail

Usually this means some optional environment keys are missing in `backend/.env`.

### Chat does not work

Check:

- backend is running on `8000`
- frontend is running on `5173`
- login token is valid

### Payments do not work

Check:

- eSewa and Khalti keys in `backend/.env`

### Maps do not work

Check:

- Google Maps related API keys in `backend/.env`

## Stop The Project

To stop the servers, press:

```powershell
Ctrl + C
```

in each running terminal.

## Existing Helper Script

This repository also includes:

- `start-dev.ps1`

It starts backend and frontend in separate PowerShell windows, but it assumes:

- backend `.venv` already exists
- dependencies are already installed

## Verification Checklist

After setup:

1. Open `http://localhost:5173`
2. Register or login
3. Open dashboard
4. Check jobs page
5. Check profile page
6. Check chat if needed
7. Check admin portal if you have admin credentials

## Reference Files

- [backend/.env.example](/abs/path/D:/Rozgar/backend/.env.example)
- [backend/requirements.txt](/abs/path/D:/Rozgar/backend/requirements.txt)
- [frontend/package.json](/abs/path/D:/Rozgar/frontend/package.json)
- [start-dev.ps1](/abs/path/D:/Rozgar/start-dev.ps1)
- [RUN_INSTRUCTIONS.txt](/abs/path/D:/Rozgar/RUN_INSTRUCTIONS.txt)
