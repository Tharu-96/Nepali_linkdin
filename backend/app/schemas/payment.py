from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from uuid import UUID


# Requests
class InitiatePaymentRequest(BaseModel):
    job_id: int
    gateway: str = Field(..., description="esewa or khalti")

class WorkerPaymentNumbersUpdate(BaseModel):
    esewa_number: Optional[str] = Field(default=None, regex=r"^[0-9]{10}$")
    khalti_number: Optional[str] = Field(default=None, regex=r"^[0-9]{10}$")


class EsewaVerifyRequest(BaseModel):
    """Signed response payload returned by eSewa after checkout.

    `data` is the base64-encoded JSON string eSewa appends to the success URL.
    """
    data: str


class KhaltiVerifyRequest(BaseModel):
    pidx: str
    transaction_id: Optional[str] = None
    purchase_order_id: Optional[str] = None

# Responses
class PaymentInitResponse(BaseModel):
    transaction_id: UUID
    redirect_url: str
    payment_url: Optional[str] = None
    gross: float
    commission: float
    net: float
    employer_total: float
    method: str = "redirect"
    form_fields: Optional[Dict[str, str]] = None

class TransactionResponse(BaseModel):
    id: UUID
    job_id: int
    employer_id: int
    worker_id: int
    gross_amount_npr: float
    commission_rate: float
    commission_amount_npr: float
    net_amount_npr: float
    gateway: str
    gateway_transaction_id: Optional[str] = None
    status: str
    worker_payment_number: str
    initiated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class AdminTransactionResponse(BaseModel):
    """Enriched transaction view for the admin panel."""
    id: UUID
    job_id: int
    job_title: Optional[str] = None
    employer_name: Optional[str] = None
    worker_name: Optional[str] = None
    gross_amount_npr: float
    commission_amount_npr: float
    net_amount_npr: float
    gateway: str
    status: str
    worker_payment_number: str
    initiated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class MyTransactionResponse(BaseModel):
    """Transaction view for a worker or employer's own history."""
    id: UUID
    job_id: int
    job_title: Optional[str] = None
    counterpart_name: Optional[str] = None  # employer name for worker, worker name for employer
    gross_amount_npr: float
    commission_amount_npr: float
    net_amount_npr: float
    gateway: str
    status: str
    worker_payment_number: str
    initiated_at: datetime
    completed_at: Optional[datetime] = None
    class Config:
        orm_mode = True


class WorkerWalletEntryResponse(BaseModel):
    id: UUID
    transaction_id: UUID
    job_id: int
    job_title: Optional[str] = None
    amount_npr: float
    entry_type: str
    description: str
    created_at: datetime


class WorkerWalletResponse(BaseModel):
    balance_npr: float
    total_credits: int
    currency: str = "NPR"
    mode: str = "sandbox"
    external_wallet_transfer: bool = False
    entries: List[WorkerWalletEntryResponse]
