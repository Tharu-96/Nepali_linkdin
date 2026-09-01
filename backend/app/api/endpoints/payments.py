from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import hmac
import hashlib
import base64
import uuid
import httpx
import re
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

from app.api.deps import get_current_user, RoleChecker
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User, Job, WorkerProfile, EmployerProfile, Application
from app.models.payment import Transaction, WorkerWalletEntry
from app.api.websocket import manager
from app.services.notifications import create_notification, broadcast_notification
from app.schemas.payment import (
    InitiatePaymentRequest, PaymentInitResponse, TransactionResponse,
    WorkerPaymentNumbersUpdate, MyTransactionResponse,
    EsewaVerifyRequest, KhaltiVerifyRequest, WorkerWalletResponse,
    WorkerWalletEntryResponse
)
from app.schemas.profile import WorkerProfileResponse

router = APIRouter()

MONEY_PLACES = Decimal("0.01")


def money(value: Any) -> Decimal:
    try:
        return Decimal(str(value)).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid payment amount")


def money_text(value: Any) -> str:
    return format(money(value), ".2f")


def employer_total(tx: Transaction) -> Decimal:
    """The amount the employer was charged at checkout.

    `net_amount_npr` is the worker's payout.  Adding the separately recorded
    platform fee works for both the new employer-paid fee model and legacy
    transactions, whose worker payout was previously reduced by that fee.
    """
    return money(money(tx.net_amount_npr) + money(tx.commission_amount_npr))


def add_query_params(url: str, **params: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update({key: str(value) for key, value in params.items() if value is not None})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def require_setting(value: str, label: str) -> str:
    if not value or value.strip().lower() in {"test", "change_this_for_production"}:
        raise HTTPException(status_code=503, detail=f"{label} is not configured")
    return value.strip()


def get_payable_application(db: Session, job_id: int) -> Application:
    application = db.query(Application).filter(
        Application.job_id == job_id,
        Application.status.in_(["accepted", "completed"]),
    ).first()
    if not application:
        raise HTTPException(status_code=400, detail="No accepted worker found for this job")
    return application


def assert_transaction_owner(db: Session, tx: Transaction, current_user: User) -> None:
    if current_user.role == "admin":
        return
    if current_user.role == "employer":
        profile = db.query(EmployerProfile).filter(EmployerProfile.id == tx.employer_id).first()
    elif current_user.role == "worker":
        profile = db.query(WorkerProfile).filter(WorkerProfile.id == tx.worker_id).first()
    else:
        profile = None
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to access this payment")


def clear_pending_attempts(db: Session, job_id: int, gateway: str) -> None:
    db.query(Transaction).filter(
        Transaction.job_id == job_id,
        Transaction.gateway == gateway,
        Transaction.status == "pending",
    ).update({Transaction.status: "failed"}, synchronize_session=False)

def generate_esewa_signature(amount: str, tx_uuid: str, product_code: str) -> str:
    message = f"total_amount={amount},transaction_uuid={tx_uuid},product_code={product_code}"
    key = settings.ESEWA_SECRET_KEY.encode('utf-8')
    msg = message.encode('utf-8')
    # Compute HMAC-SHA256 and return base64 signature
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode('utf-8')


def verify_esewa_signature(payload: Dict[str, Any]) -> bool:
    """Re-compute the HMAC-SHA256 signature over the fields eSewa signed and
    constant-time compare it with the signature eSewa returned. Never trust the
    incoming status without a valid signature.
    """
    signed_field_names = payload.get("signed_field_names")
    received_sig = payload.get("signature")
    if not signed_field_names or not received_sig:
        return False
    fields = [f.strip() for f in signed_field_names.split(",") if f.strip()]
    required_fields = {"transaction_code", "status", "total_amount", "transaction_uuid", "product_code", "signed_field_names"}
    if not required_fields.issubset(set(fields)) or any(field not in payload for field in fields):
        return False
    message = ",".join(f"{f}={payload.get(f)}" for f in fields)
    key = settings.ESEWA_SECRET_KEY.encode("utf-8")
    digest = hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, str(received_sig))


async def confirm_esewa_status(tx: Transaction) -> Dict[str, Any]:
    verify_url = require_setting(settings.ESEWA_VERIFY_URL, "eSewa verification URL")
    params = {
        "product_code": settings.ESEWA_MERCHANT_CODE,
        "total_amount": money_text(employer_total(tx)),
        "transaction_uuid": str(tx.id),
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(verify_url, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not verify eSewa payment: {exc}")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="eSewa payment verification service rejected the request")
    try:
        result = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="eSewa returned an invalid verification response")
    if str(result.get("status", "")).upper() != "COMPLETE":
        raise HTTPException(status_code=400, detail="eSewa payment is not complete")
    return result


def decode_esewa_data(data: str) -> Dict[str, Any]:
    try:
        decoded = base64.b64decode(data, validate=True).decode("utf-8")
        payload = json.loads(decoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed eSewa payment response")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid eSewa payment response")
    return payload


def get_esewa_transaction(db: Session, payload: Dict[str, Any]) -> Transaction:
    if not verify_esewa_signature(payload):
        raise HTTPException(status_code=400, detail="Invalid eSewa response signature")
    try:
        transaction_id = uuid.UUID(str(payload.get("transaction_uuid")))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid eSewa transaction reference")
    tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.gateway == "esewa").first()
    if not tx:
        raise HTTPException(status_code=404, detail="eSewa transaction not found")
    if str(payload.get("product_code")) != settings.ESEWA_MERCHANT_CODE:
        raise HTTPException(status_code=400, detail="eSewa merchant code does not match")
    if money(payload.get("total_amount")) != employer_total(tx):
        raise HTTPException(status_code=400, detail="eSewa payment amount does not match the transaction")
    return tx


def ensure_worker_wallet_credit(db: Session, tx: Transaction) -> WorkerWalletEntry:
    """Credit the internal worker wallet once for a verified transaction."""
    entry = db.query(WorkerWalletEntry).filter(
        WorkerWalletEntry.transaction_id == tx.id
    ).first()
    if entry:
        return entry

    job = db.query(Job).filter(Job.id == tx.job_id).first()
    entry = WorkerWalletEntry(
        worker_id=tx.worker_id,
        transaction_id=tx.id,
        amount_npr=money(tx.net_amount_npr),
        entry_type="credit",
        description=f"Sandbox earnings credit for {job.title if job else 'completed job'}",
    )
    db.add(entry)
    return entry


async def complete_transaction(db: Session, tx: Transaction, gateway_data: Dict[str, Any], gateway_transaction_id: str | None) -> None:
    # Serialize concurrent gateway callbacks for the same checkout. SQLite
    # safely ignores FOR UPDATE; PostgreSQL uses it to prevent double credits.
    db.refresh(tx, with_for_update=True)
    if tx.status == "success":
        # Backfill a ledger row for transactions completed before the wallet
        # feature existed, while keeping repeated callbacks idempotent.
        ensure_worker_wallet_credit(db, tx)
        db.commit()
        return
    if tx.status != "pending":
        raise HTTPException(status_code=409, detail=f"Payment is already {tx.status}")
    tx.status = "success"
    tx.completed_at = datetime.utcnow()
    tx.gateway_transaction_id = gateway_transaction_id or tx.gateway_transaction_id
    tx.raw_response = gateway_data
    ensure_worker_wallet_credit(db, tx)
    db.commit()
    db.refresh(tx)
    await _finalize_paid_job(db, tx)


async def lookup_khalti_payment(tx: Transaction) -> Dict[str, Any]:
    secret_key = require_setting(settings.KHALTI_SECRET_KEY, "Khalti secret key")
    headers = {"Authorization": f"Key {secret_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(khalti_lookup_url(), json={"pidx": tx.gateway_transaction_id}, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not verify Khalti payment: {exc}")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Khalti payment lookup failed")
    try:
        result = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Khalti returned an invalid verification response")
    expected_paisa = int(employer_total(tx) * 100)
    try:
        returned_paisa = int(result.get("total_amount"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Khalti did not return a valid payment amount")
    if returned_paisa != expected_paisa:
        raise HTTPException(status_code=400, detail="Khalti payment amount does not match the transaction")
    return result


def khalti_initiate_url() -> str:
    return settings.KHALTI_INITIATE_URL or f"{settings.KHALTI_BASE_URL.rstrip('/')}/epayment/initiate/"


def khalti_lookup_url() -> str:
    return settings.KHALTI_LOOKUP_URL or f"{settings.KHALTI_BASE_URL.rstrip('/')}/epayment/lookup/"


async def _finalize_paid_job(db: Session, tx: Transaction) -> None:
    """Mark the job paid and publish the existing `payment_released` event.

    The event name is retained for frontend compatibility; in sandbox it means
    a verified checkout and an internal Rozgar wallet credit, not an external
    provider-side payout to the worker.
    """
    job = db.query(Job).filter(Job.id == tx.job_id).first()
    worker_profile = db.query(WorkerProfile).filter(WorkerProfile.id == tx.worker_id).first()
    employer_profile = db.query(EmployerProfile).filter(EmployerProfile.id == tx.employer_id).first()
    worker_user_id = worker_profile.user_id if worker_profile else None
    employer_user_id = employer_profile.user_id if employer_profile else None

    if job:
        if job.status == "paid":
            return
        job.status = "paid"
        if worker_user_id:
            worker_notification = create_notification(
                db, worker_user_id, "Payment received",
                f"Payment for '{job.title}' was credited to your Rozgar sandbox wallet.",
                "payment", "/payment/history",
            )
        else:
            worker_notification = None
        if employer_user_id:
            employer_notification = create_notification(
                db, employer_user_id, "Payment completed",
                f"Payment for '{job.title}' was verified and recorded successfully.",
                "payment", "/payment/history",
            )
        else:
            employer_notification = None
        db.commit()
        if worker_notification:
            db.refresh(worker_notification)
        if employer_notification:
            db.refresh(employer_notification)
    else:
        worker_notification = None
        employer_notification = None

    event = {
        "type": "payment_released",
        "job_id": tx.job_id,
        "job_title": job.title if job else None,
        "transaction_id": str(tx.id),
        "gateway": tx.gateway,
        "gross": float(tx.gross_amount_npr),
        "net": float(tx.net_amount_npr),
        "commission": float(tx.commission_amount_npr),
        "employer_total": float(employer_total(tx)),
        "worker_id": worker_user_id,
        "employer_id": employer_user_id,
        "status": "paid",
        "timestamp": datetime.utcnow().isoformat(),
    }

    targets = set()
    if worker_user_id:
        targets.add(worker_user_id)
    if employer_user_id:
        targets.add(employer_user_id)
    for admin in db.query(User).filter(User.role == "admin").all():
        targets.add(admin.id)
    for uid in targets:
        await manager.send_personal_message(event, uid)
    if worker_notification:
        await broadcast_notification(worker_notification)
    if employer_notification:
        await broadcast_notification(employer_notification)

def parse_salary_amount(salary: str) -> float:
    """Extract the payable numeric amount from display text like 'Rs. 5000/day'."""
    normalized = str(salary or "").replace(",", "")
    matches = re.findall(r"\d+(?:\.\d+)?", normalized)
    if not matches:
        raise HTTPException(
            status_code=400,
            detail="Job estimated salary must contain a numeric amount before payment can be initiated",
        )
    return float(matches[0])


def get_or_create_employer_profile(db: Session, current_user: User) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    if not profile:
        profile = EmployerProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()
    return profile

@router.put("/jobs/{job_id}/complete")
async def complete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(RoleChecker(["employer"]))):
    job = db.query(Job).filter(Job.id == job_id, Job.employer_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by you")
    accepted_application = db.query(Application).filter(
        Application.job_id == job.id, Application.status.in_(["accepted", "completed"])
    ).first()
    if not accepted_application:
        raise HTTPException(status_code=400, detail="No accepted worker found for this job")
    if job.status not in ["open", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Job cannot be completed from '{job.status}' status")

    # Older accepted jobs may still be marked open; accepting workers now moves
    # new jobs to in_progress, while this keeps existing records payable.
    job.status = "completed"
    platform_notification = None
    accepted_application.status = "completed"
    platform_notification = create_notification(
        db,
        accepted_application.worker_id,
        "Work marked completed",
        f"The employer marked '{job.title}' as completed. Payment will be processed next.",
        "job",
        "/payment/history",
    )
    db.commit()
    if platform_notification:
        db.refresh(platform_notification)
        await broadcast_notification(platform_notification)
    return {"message": "Job marked as completed"}

@router.get("/job/{job_id}", response_model=List[TransactionResponse])
def get_job_payments(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if current_user.role == "employer" and job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to view these payments")
    if current_user.role == "worker":
        application = db.query(Application).filter(
            Application.job_id == job_id,
            Application.worker_id == current_user.id,
            Application.status.in_(["accepted", "completed"]),
        ).first()
        if not application:
            raise HTTPException(status_code=403, detail="You are not authorized to view these payments")
    if current_user.role not in ["admin", "employer", "worker"]:
        raise HTTPException(status_code=403, detail="You are not authorized to view these payments")
    txs = db.query(Transaction).filter(Transaction.job_id == job_id).all()
        
    return txs

@router.post("/initiate", response_model=PaymentInitResponse)
def initiate_payment(
    req: InitiatePaymentRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["employer"]))
):
    if req.gateway != "esewa":
        raise HTTPException(status_code=400, detail="Use gateway 'esewa' for this endpoint")
    require_setting(settings.ESEWA_SECRET_KEY, "eSewa secret key")
    require_setting(settings.ESEWA_MERCHANT_CODE, "eSewa merchant code")
    payment_url = require_setting(settings.ESEWA_PAYMENT_URL, "eSewa payment URL")

    job = db.query(Job).filter(Job.id == req.job_id, Job.employer_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not yours")
    
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job must be marked completed before payment")
        
    app = get_payable_application(db, job.id)
        
    worker_profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == app.worker_id).first()
    if not worker_profile:
        raise HTTPException(status_code=400, detail="Worker profile not found")
        
    worker_payment_number = worker_profile.esewa_number
    if not worker_payment_number:
        raise HTTPException(status_code=400, detail="Worker has not provided an eSewa number")
        
    # Ignore orphaned test transactions from an older job whose SQLite ID was
    # later reused. A real payment for this job can only exist after the job was
    # created.
    existing = db.query(Transaction).filter(
        Transaction.job_id == job.id,
        Transaction.status == "success",
        Transaction.created_at >= job.created_at,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment already completed for this job")
        
    gross = money(parse_salary_amount(job.salary))
    commission = money(gross * Decimal(str(settings.PLATFORM_COMMISSION_RATE)))
    # The employer pays the service fee in addition to the agreed job amount.
    # The worker therefore receives the full agreed amount.
    net = gross
    total = money(net + commission)
    clear_pending_attempts(db, job.id, "esewa")
    
    tx_id = uuid.uuid4()
    
    tx = Transaction(
        id=tx_id,
        job_id=job.id,
        employer_id=get_or_create_employer_profile(db, current_user).id,
        worker_id=worker_profile.id,
        gross_amount_npr=gross,
        commission_rate=settings.PLATFORM_COMMISSION_RATE,
        commission_amount_npr=commission,
        net_amount_npr=net,
        gateway="esewa",
        status="pending",
        worker_payment_number=worker_payment_number
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    
    amount = money_text(gross)
    total_amount = money_text(total)
    signature = generate_esewa_signature(total_amount, str(tx_id), settings.ESEWA_MERCHANT_CODE)
    form_fields = {
        "amount": amount,
        "tax_amount": "0",
        "total_amount": total_amount,
        "transaction_uuid": str(tx_id),
        "product_code": settings.ESEWA_MERCHANT_CODE,
        "product_service_charge": money_text(commission),
        "product_delivery_charge": "0",
        "success_url": settings.PAYMENT_SUCCESS_URL,
        "failure_url": add_query_params(settings.PAYMENT_FAILURE_URL, gateway="esewa", transaction_id=str(tx_id)),
        "signed_field_names": "total_amount,transaction_uuid,product_code",
        "signature": signature,
    }
    return PaymentInitResponse(
        transaction_id=tx_id,
        redirect_url=payment_url,
        payment_url=payment_url,
        gross=float(gross),
        commission=float(commission),
        net=float(net),
        employer_total=float(total),
        method="post",
        form_fields=form_fields,
    )

# Khalti specific initiation route as we need to make an API call from backend
@router.post("/initiate/khalti", response_model=PaymentInitResponse)
async def initiate_khalti(
    req: InitiatePaymentRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["employer"]))
):
    if req.gateway != "khalti":
        raise HTTPException(status_code=400, detail="Use /initiate for non-khalti gateways")
    secret_key = require_setting(settings.KHALTI_SECRET_KEY, "Khalti secret key")
        
    job = db.query(Job).filter(Job.id == req.job_id, Job.employer_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not yours")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job must be marked completed before payment")
        
    app = get_payable_application(db, job.id)

    worker_profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == app.worker_id).first()
    if not worker_profile:
        raise HTTPException(status_code=400, detail="Worker profile not found")
    
    if not worker_profile.khalti_number:
        raise HTTPException(status_code=400, detail="Worker has no Khalti number")

    existing = db.query(Transaction).filter(
        Transaction.job_id == job.id,
        Transaction.status == "success",
        Transaction.created_at >= job.created_at,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment already completed for this job")

    gross = money(parse_salary_amount(job.salary))
    commission = money(gross * Decimal(str(settings.PLATFORM_COMMISSION_RATE)))
    net = gross
    total = money(net + commission)
    clear_pending_attempts(db, job.id, "khalti")
    
    tx_id = uuid.uuid4()
    
    tx = Transaction(
        id=tx_id,
        job_id=job.id,
        employer_id=get_or_create_employer_profile(db, current_user).id,
        worker_id=worker_profile.id,
        gross_amount_npr=gross,
        commission_rate=settings.PLATFORM_COMMISSION_RATE,
        commission_amount_npr=commission,
        net_amount_npr=net,
        gateway="khalti",
        status="pending",
        worker_payment_number=worker_profile.khalti_number
    )
    db.add(tx)
    db.commit()
    
    payload = {
        "return_url": settings.PAYMENT_SUCCESS_URL,
        "website_url": settings.FRONTEND_BASE_URL,
        "amount": int(total * 100), # Khalti expects Paisa
        "purchase_order_id": str(tx_id),
        "purchase_order_name": f"Job payment + Rozgar fee - {job.title}",
        "customer_info": {
            "name": current_user.name,
            "email": current_user.email,
        }
    }
    if current_user.phone_number:
        payload["customer_info"]["phone"] = current_user.phone_number
    
    headers = {
        "Authorization": f"Key {secret_key}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(khalti_initiate_url(), json=payload, headers=headers)
    except httpx.HTTPError as exc:
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Could not connect to Khalti: {exc}")
    if resp.status_code != 200:
        tx.status = "failed"
        db.commit()
        try:
            gateway_error = resp.json().get("detail") or resp.json()
        except ValueError:
            gateway_error = resp.text
        raise HTTPException(status_code=400, detail=f"Khalti initiation failed: {gateway_error}")

    try:
        data = resp.json()
    except ValueError:
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail="Khalti returned an invalid response")
    if not data.get("pidx") or not data.get("payment_url"):
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail="Khalti did not return a payment reference and checkout URL")
    tx.gateway_transaction_id = data["pidx"]
    db.commit()
        
    return PaymentInitResponse(
        transaction_id=tx_id,
        redirect_url=data["payment_url"],
        payment_url=data["payment_url"],
        gross=float(gross),
        commission=float(commission),
        net=float(net),
        employer_total=float(total),
        method="redirect",
    )

# Superseded by the verified callback below; kept as an unregistered helper for
# compatibility with older local references.
async def esewa_callback(data: str, db: Session = Depends(get_db)):
    # eSewa returns a base64 encoded, HMAC-signed JSON string on success.
    import json
    try:
        decoded = base64.b64decode(data).decode('utf-8')
        payload = json.loads(decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed eSewa response: {e}")

    # SECURITY: never trust the incoming status without a valid signature.
    if not verify_esewa_signature(payload):
        raise HTTPException(status_code=400, detail="Invalid eSewa signature — payment rejected")

    tx_id = payload.get("transaction_uuid")
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if payload.get("status") == "COMPLETE":
        tx.status = "success"
        tx.completed_at = datetime.utcnow()
        tx.gateway_transaction_id = payload.get("transaction_code")
        tx.raw_response = payload
        db.commit()
        await _finalize_paid_job(db, tx)
        return {"message": "Payment successful", "status": "paid", "transaction_id": str(tx.id)}

    tx.status = "failed"
    db.commit()
    return {"message": "Payment failed", "status": "failed"}


async def verify_esewa_payment(req: EsewaVerifyRequest, db: Session = Depends(get_db)):
    """Server-side verification entry point for the frontend success callback.
    Validates the signed eSewa payload before releasing the payment.
    """
    import json
    try:
        decoded = base64.b64decode(req.data).decode('utf-8')
        payload = json.loads(decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed eSewa response: {e}")

    if not verify_esewa_signature(payload):
        raise HTTPException(status_code=400, detail="Invalid eSewa signature — payment rejected")

    tx = db.query(Transaction).filter(Transaction.id == payload.get("transaction_uuid")).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if payload.get("status") != "COMPLETE":
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="eSewa reported the payment as not complete")

    tx.status = "success"
    tx.completed_at = datetime.utcnow()
    tx.gateway_transaction_id = payload.get("transaction_code")
    tx.raw_response = payload
    db.commit()
    await _finalize_paid_job(db, tx)
    return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}


@router.get("/esewa/callback")
async def verified_esewa_callback(data: str, db: Session = Depends(get_db)):
    payload = decode_esewa_data(data)
    tx = get_esewa_transaction(db, payload)
    if str(payload.get("status", "")).upper() != "COMPLETE":
        if tx.status == "pending":
            tx.status = "failed"
            db.commit()
        raise HTTPException(status_code=400, detail="eSewa payment was not completed")
    gateway_status = await confirm_esewa_status(tx)
    await complete_transaction(
        db, tx, {"callback": payload, "status_lookup": gateway_status}, payload.get("transaction_code")
    )
    return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}


@router.post("/verify/esewa")
async def verified_esewa_payment(
    req: EsewaVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["employer"])),
):
    payload = decode_esewa_data(req.data)
    tx = get_esewa_transaction(db, payload)
    assert_transaction_owner(db, tx, current_user)
    if tx.status == "success":
        return {"message": "Payment was already verified", "status": "paid", "transaction_id": str(tx.id)}
    if str(payload.get("status", "")).upper() != "COMPLETE":
        if tx.status == "pending":
            tx.status = "failed"
            db.commit()
        raise HTTPException(status_code=400, detail="eSewa reported the payment as not complete")
    gateway_status = await confirm_esewa_status(tx)
    await complete_transaction(
        db, tx, {"callback": payload, "status_lookup": gateway_status}, payload.get("transaction_code")
    )
    return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}


# Older server callback retained without route registration. Browser return
# verification is handled by the authenticated endpoint below.
async def khalti_callback(req: Request, db: Session = Depends(get_db)):
    data = await req.json()
    pidx = data.get("pidx")
    
    if not pidx:
        raise HTTPException(400, "Missing pidx")
        
    tx = db.query(Transaction).filter(Transaction.gateway_transaction_id == pidx).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
        
    headers = {
        "Authorization": f"Key {settings.KHALTI_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(khalti_lookup_url(), json={"pidx": pidx}, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Khalti lookup error: {resp.text}")
        result = resp.json()
        
        if result.get("status") == "Completed":
            tx.status = "success"
            tx.completed_at = datetime.utcnow()
            tx.raw_response = result
            db.commit()
            await _finalize_paid_job(db, tx)
            return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}
        else:
            tx.status = "failed"
            db.commit()
            return {"message": "Payment failed or pending", "status": "failed"}


async def verify_khalti_payment(req: KhaltiVerifyRequest, db: Session = Depends(get_db)):
    """Server-side Khalti lookup verification. Only releases payment after Khalti
    confirms the transaction is Completed — the pidx string is never trusted alone.
    """
    tx = db.query(Transaction).filter(Transaction.gateway_transaction_id == req.pidx).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    headers = {
        "Authorization": f"Key {settings.KHALTI_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            khalti_lookup_url(),
            json={"pidx": req.pidx},
            headers=headers,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Khalti lookup error: {resp.text}")
        result = resp.json()

    if result.get("status") != "Completed":
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Khalti reported the payment as not complete")

    tx.status = "success"
    tx.completed_at = datetime.utcnow()
    tx.raw_response = result
    db.commit()
    await _finalize_paid_job(db, tx)
    return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}


@router.post("/verify/khalti")
async def verified_khalti_payment(
    req: KhaltiVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["employer"])),
):
    tx = db.query(Transaction).filter(
        Transaction.gateway_transaction_id == req.pidx,
        Transaction.gateway == "khalti",
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Khalti transaction not found")
    assert_transaction_owner(db, tx, current_user)
    if req.purchase_order_id and req.purchase_order_id != str(tx.id):
        raise HTTPException(status_code=400, detail="Khalti order reference does not match")
    if tx.status == "success":
        return {"message": "Payment was already verified", "status": "paid", "transaction_id": str(tx.id)}

    result = await lookup_khalti_payment(tx)
    gateway_status = str(result.get("status", "")).strip().lower()
    if gateway_status != "completed":
        if gateway_status in {"expired", "user canceled", "cancelled", "canceled", "failed"} and tx.status == "pending":
            tx.status = "failed"
            tx.raw_response = result
            db.commit()
        if gateway_status in {"pending", "initiated"}:
            raise HTTPException(status_code=409, detail="Khalti payment is still pending")
        raise HTTPException(status_code=400, detail=f"Khalti payment is {gateway_status or 'not complete'}")

    await complete_transaction(db, tx, result, result.get("transaction_id") or req.transaction_id)
    return {"message": "Payment verified", "status": "paid", "transaction_id": str(tx.id)}


@router.put("/status/{transaction_id}/failed")
async def mark_payment_failed(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["employer"])),
):
    try:
        tx_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction reference")
    tx = db.query(Transaction).filter(Transaction.id == tx_uuid).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    assert_transaction_owner(db, tx, current_user)
    if tx.status != "pending":
        return {"message": "Payment attempt already closed", "status": tx.status}

    if tx.gateway == "esewa":
        try:
            gateway_result = await confirm_esewa_status(tx)
        except HTTPException as exc:
            if exc.status_code >= 500:
                raise
            tx.status = "failed"
            db.commit()
        else:
            await complete_transaction(db, tx, gateway_result, gateway_result.get("ref_id"))
    elif tx.gateway == "khalti" and tx.gateway_transaction_id:
        result = await lookup_khalti_payment(tx)
        gateway_status = str(result.get("status", "")).strip().lower()
        if gateway_status == "completed":
            await complete_transaction(db, tx, result, result.get("transaction_id"))
        elif gateway_status in {"expired", "user canceled", "cancelled", "canceled", "failed"}:
            tx.status = "failed"
            tx.raw_response = result
            db.commit()
    return {"message": "Payment attempt closed", "status": tx.status}


@router.put("/status/{transaction_id}/cancel")
def cancel_pending_payment(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["employer"])),
):
    """Close an employer's pending checkout before it is verified as paid."""
    try:
        tx_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction reference")

    tx = db.query(Transaction).filter(Transaction.id == tx_uuid).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    assert_transaction_owner(db, tx, current_user)
    if tx.status != "pending":
        raise HTTPException(status_code=409, detail=f"Only pending payments can be cancelled; this payment is {tx.status}")

    tx.status = "cancelled"
    tx.raw_response = {"status": "cancelled", "cancelled_by": "employer", "cancelled_at": datetime.utcnow().isoformat()}
    db.commit()
    return {"message": "Pending payment cancelled", "status": tx.status}

@router.get("/status/{transaction_id}", response_model=TransactionResponse)
def get_tx_status(transaction_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        tx_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction reference")
    tx = db.query(Transaction).filter(Transaction.id == tx_uuid).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    assert_transaction_owner(db, tx, current_user)
    return tx

@router.put("/workers/profile/payment-numbers", response_model=WorkerProfileResponse)
def update_payment_numbers(req: WorkerPaymentNumbersUpdate, db: Session = Depends(get_db), current_user: User = Depends(RoleChecker(["worker"]))):
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)

    if req.esewa_number is not None:
        profile.esewa_number = req.esewa_number
    if req.khalti_number is not None:
        profile.khalti_number = req.khalti_number
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/wallet/me", response_model=WorkerWalletResponse)
def get_my_worker_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["worker"])),
):
    """Return the worker's in-app sandbox balance and immutable credit ledger.

    Existing verified transactions are reconciled here once so deployments that
    predate this table do not lose their recorded worker earnings.
    """
    worker_profile = db.query(WorkerProfile).filter(
        WorkerProfile.user_id == current_user.id
    ).first()
    if not worker_profile:
        return WorkerWalletResponse(balance_npr=0, total_credits=0, entries=[])

    successful_transactions = db.query(Transaction).filter(
        Transaction.worker_id == worker_profile.id,
        Transaction.status == "success",
    ).with_for_update().all()
    for tx in successful_transactions:
        ensure_worker_wallet_credit(db, tx)
    db.commit()

    wallet_entries = db.query(WorkerWalletEntry).filter(
        WorkerWalletEntry.worker_id == worker_profile.id
    ).order_by(WorkerWalletEntry.created_at.desc()).all()

    entries = []
    for entry in wallet_entries:
        tx = db.query(Transaction).filter(Transaction.id == entry.transaction_id).first()
        job = db.query(Job).filter(Job.id == tx.job_id).first() if tx else None
        entries.append(WorkerWalletEntryResponse(
            id=entry.id,
            transaction_id=entry.transaction_id,
            job_id=tx.job_id if tx else 0,
            job_title=job.title if job else None,
            amount_npr=float(entry.amount_npr),
            entry_type=entry.entry_type,
            description=entry.description,
            created_at=entry.created_at,
        ))

    balance = db.query(func.coalesce(func.sum(WorkerWalletEntry.amount_npr), 0)).filter(
        WorkerWalletEntry.worker_id == worker_profile.id
    ).scalar()
    return WorkerWalletResponse(
        balance_npr=float(balance or 0),
        total_credits=len(entries),
        entries=entries,
    )


@router.get("/me", response_model=List[MyTransactionResponse])
def get_my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all transactions for the currently logged-in user.
    - Workers see transactions where they were the worker.
    - Employers see transactions where they were the employer.
    Results are sorted newest-first.
    """
    results = []

    if current_user.role == "worker":
        worker_profile = db.query(WorkerProfile).filter(
            WorkerProfile.user_id == current_user.id
        ).first()
        if not worker_profile:
            return []

        txs = (
            db.query(Transaction)
            .filter(Transaction.worker_id == worker_profile.id)
            .order_by(Transaction.initiated_at.desc())
            .all()
        )

        for tx in txs:
            job = db.query(Job).filter(Job.id == tx.job_id).first()
            employer_profile = db.query(EmployerProfile).filter(
                EmployerProfile.id == tx.employer_id
            ).first()
            employer_user = (
                db.query(User).filter(User.id == employer_profile.user_id).first()
                if employer_profile else None
            )
            results.append(MyTransactionResponse(
                id=tx.id,
                job_id=tx.job_id,
                job_title=job.title if job else None,
                counterpart_name=employer_user.name if employer_user else "Unknown Employer",
                gross_amount_npr=float(tx.gross_amount_npr),
                commission_amount_npr=float(tx.commission_amount_npr),
                net_amount_npr=float(tx.net_amount_npr),
                gateway=tx.gateway,
                status=tx.status,
                worker_payment_number=tx.worker_payment_number,
                initiated_at=tx.initiated_at,
                completed_at=tx.completed_at,
            ))

    elif current_user.role == "employer":
        employer_profile = db.query(EmployerProfile).filter(
            EmployerProfile.user_id == current_user.id
        ).first()
        if not employer_profile:
            return []

        txs = (
            db.query(Transaction)
            .filter(Transaction.employer_id == employer_profile.id)
            .order_by(Transaction.initiated_at.desc())
            .all()
        )

        for tx in txs:
            job = db.query(Job).filter(Job.id == tx.job_id).first()
            worker_profile_obj = db.query(WorkerProfile).filter(
                WorkerProfile.id == tx.worker_id
            ).first()
            worker_user = (
                db.query(User).filter(User.id == worker_profile_obj.user_id).first()
                if worker_profile_obj else None
            )
            results.append(MyTransactionResponse(
                id=tx.id,
                job_id=tx.job_id,
                job_title=job.title if job else None,
                counterpart_name=worker_user.name if worker_user else "Unknown Worker",
                gross_amount_npr=float(tx.gross_amount_npr),
                commission_amount_npr=float(tx.commission_amount_npr),
                net_amount_npr=float(tx.net_amount_npr),
                gateway=tx.gateway,
                status=tx.status,
                worker_payment_number=tx.worker_payment_number,
                initiated_at=tx.initiated_at,
                completed_at=tx.completed_at,
            ))

    return results
