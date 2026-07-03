from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from utils.auth_utils import verify_password, create_access_token, get_current_employee, JWT_SECRET, ALGORITHM
from services.notify import send_email
from pydantic import BaseModel
from datetime import datetime, timedelta
import os
import secrets
import msal
from jose import jwt as jose_jwt
from fastapi.responses import RedirectResponse

router = APIRouter()

# In-memory failed-login tracker: { email: [attempt_datetime, ...] }
# Safe because this backend runs as a single gunicorn worker.
_failed_login_attempts = {}

MAX_ATTEMPTS = 5
LOCKOUT_WINDOW_MINUTES = 5


def _check_rate_limit(email: str):
    """Raise 429 if this email has too many recent failed attempts."""
    now = datetime.utcnow()
    attempts = _failed_login_attempts.get(email, [])
    attempts = [a for a in attempts if now - a < timedelta(minutes=LOCKOUT_WINDOW_MINUTES)]
    _failed_login_attempts[email] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {LOCKOUT_WINDOW_MINUTES} minutes."
        )


def _record_failed_attempt(email: str):
    now = datetime.utcnow()
    _failed_login_attempts.setdefault(email, []).append(now)


def _clear_failed_attempts(email: str):
    _failed_login_attempts.pop(email, None)


class LoginInput(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    _check_rate_limit(data.email)
    employee = db.query(Employee).filter(Employee.email == data.email).first()
    if not employee:
        _record_failed_attempt(data.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, employee.password_hash):
        _record_failed_attempt(data.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")

    _clear_failed_attempts(data.email)
    token = create_access_token({"sub": employee.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role,
            "department": employee.department,
        },
    }


@router.get("/auth/me")
def get_me(current_employee: Employee = Depends(get_current_employee)):
    return {
        "id": current_employee.id,
        "name": current_employee.name,
        "email": current_employee.email,
        "role": current_employee.role,
        "department": current_employee.department,
        "phone": current_employee.phone,
        "joining_date": current_employee.joining_date,
        "is_active": current_employee.is_active,
    }


@router.get("/test-email")
def test_email(current_employee: Employee = Depends(get_current_employee)):
    send_email(
        to=current_employee.email,
        subject="Test email from Xarka ERP",
        body=f"Hi {current_employee.name},\n\nThis is a test email from Xarka ERP.\nMicrosoft Graph API is working correctly!\n\nXarka ERP",
    )
    return {"message": "Test email sent — check your inbox!"}


# ── Microsoft OAuth ─────────────────────────────────────────────────────

MS_CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
MS_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
MS_TENANT_ID = os.getenv("AZURE_TENANT_ID")
MS_AUTHORITY = f"https://login.microsoftonline.com/{MS_TENANT_ID}"
MS_SCOPES = ["openid", "profile", "email"]
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _get_msal_app():
    return msal.ConfidentialClientApplication(
        MS_CLIENT_ID,
        authority=MS_AUTHORITY,
        client_credential=MS_CLIENT_SECRET,
    )


def _create_state_token() -> str:
    """Sign a short-lived state token using our existing JWT system."""
    return jose_jwt.encode(
        {"iat": datetime.utcnow(), "exp": datetime.utcnow() + timedelta(minutes=5), "nonce": secrets.token_hex(16)},
        JWT_SECRET,
        algorithm=ALGORITHM,
    )


def _verify_state_token(state: str) -> bool:
    """Verify the state JWT is valid and not expired. Returns True if valid."""
    try:
        jose_jwt.decode(state, JWT_SECRET, algorithms=[ALGORITHM])
        return True
    except Exception:
        return False


@router.get("/auth/microsoft/login")
def microsoft_login():
    state = _create_state_token()
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": f"{BACKEND_URL}/auth/microsoft/callback",
        "scope": " ".join(MS_SCOPES),
        "state": state,
    }
    auth_url = f"{MS_AUTHORITY}/oauth2/v2.0/authorize?" + "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=auth_url)


@router.get("/auth/microsoft/callback")
def microsoft_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error={error_description or error}")

    if not state or not _verify_state_token(state):
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=Invalid+or+expired+state")

    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=No+authorization+code+received")

    # Exchange authorization code for tokens via MSAL
    app = _get_msal_app()
    result = app.acquire_token_by_authorization_code(
        code,
        scopes=MS_SCOPES,
        redirect_uri=f"{BACKEND_URL}/auth/microsoft/callback",
    )

    if "error" in result:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error={result.get('error_description', 'Token exchange failed')}"
        )

    id_token_claims = result.get("id_token_claims", {})
    email = id_token_claims.get("preferred_username") or id_token_claims.get("email")
    if not email:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=No+email+in+Microsoft+token")

    # Tenant check (defense in depth — already enforced by authority URL)
    if id_token_claims.get("tid") != MS_TENANT_ID:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=Unauthorized+tenant")

    employee = db.query(Employee).filter(Employee.email == email).first()
    if not employee:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=No+account+found+for+{email}")
    if not employee.is_active:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=Account+deactivated.+Contact+admin.")

    token = create_access_token({"sub": employee.email})
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={token}")
