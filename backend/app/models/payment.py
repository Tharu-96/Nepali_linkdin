from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Numeric, JSON, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
import uuid

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    employer_id = Column(Integer, ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    # Agreed job amount (the worker's full payout for transactions created
    # after the employer-paid commission change).
    gross_amount_npr = Column(Numeric, nullable=False)
    commission_rate = Column(Numeric, default=0.08)
    commission_amount_npr = Column(Numeric, nullable=False)
    # Amount credited to the worker. The checkout total is this plus the fee.
    net_amount_npr = Column(Numeric, nullable=False)
    gateway = Column(String, nullable=False)
    gateway_transaction_id = Column(String, nullable=True)
    status = Column(String, default='pending')
    worker_payment_number = Column(String, nullable=False)
    initiated_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    raw_response = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    job = relationship("Job")
    employer = relationship("EmployerProfile")
    worker = relationship("WorkerProfile")


class WorkerWalletEntry(Base):
    """Immutable in-app credit created after a gateway payment is verified.

    This is a sandbox/platform ledger. It deliberately does not claim that the
    worker's external eSewa or Khalti wallet received a provider-side payout.
    The unique transaction id makes gateway callback retries idempotent.
    """
    __tablename__ = "worker_wallet_entries"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    amount_npr = Column(Numeric, nullable=False)
    entry_type = Column(String, nullable=False, default="credit")
    description = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    transaction = relationship("Transaction")
    worker = relationship("WorkerProfile")
