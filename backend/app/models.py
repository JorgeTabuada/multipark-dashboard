"""
SQLModel schemas para MultiPark Dashboard
"""
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
from enum import Enum

class ParkBrand(str, Enum):
    SKYPARK = "skypark"
    AIRPARK = "airpark"
    MULTIPARK = "multipark"

class PaymentMethod(str, Enum):
    MULTIBANCO = "Multibanco"
    CREDIT_CARD = "Credit Card"
    CASH = "Cash"
    OTHER = "Other"

# Base model para Booking
class BookingBase(SQLModel):
    license_plate: str = Field(index=True, max_length=20)
    checkout_timestamp: Optional[datetime] = None
    checkout_formatted: Optional[str] = None
    price_delivery: float = Field(default=0.0, ge=0)
    park_brand: Optional[str] = None
    payment_method: Optional[str] = None
    name: Optional[str] = None
    lastname: Optional[str] = None
    extra_services: Optional[str] = None
    parking_type: Optional[str] = None
    campaign: Optional[str] = None
    alocation: Optional[str] = None
    campaign_pay: Optional[bool] = None
    booking_date: Optional[str] = None
    check_in: Optional[str] = None
    booking_price: Optional[float] = None
    has_online_payment: Optional[bool] = None
    stats: Optional[str] = None
    row: Optional[str] = None
    delivery_price: Optional[float] = None
    payment_intent_id: Optional[str] = None

# Campos calculados/administrativos
class BookingAdmin(SQLModel):
    date_difference_days: Optional[int] = Field(default=0)
    needs_approval: bool = Field(default=False)
    status_approved: bool = Field(default=False)
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

# Tabela principal
class Booking(BookingBase, BookingAdmin, table=True):
    __tablename__ = "bookings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    financial_split: Optional["FinancialSplit"] = Relationship(back_populates="booking")

# Para criação via API
class BookingCreate(BookingBase):
    pass

# Para updates
class BookingUpdate(SQLModel):
    license_plate: Optional[str] = None
    price_delivery: Optional[float] = None
    park_brand: Optional[str] = None
    payment_method: Optional[str] = None
    name: Optional[str] = None
    lastname: Optional[str] = None
    status_approved: Optional[bool] = None

# Divisão financeira
class FinancialSplitBase(SQLModel):
    booking_id: int = Field(foreign_key="bookings.id")
    partner_amount_60: float = Field(ge=0)
    multipark_amount_40: float = Field(ge=0)
    total_amount: float = Field(ge=0)
    
class FinancialSplit(FinancialSplitBase, table=True):
    __tablename__ = "financial_splits"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    booking: Optional[Booking] = Relationship(back_populates="financial_split")

class FinancialSplitCreate(FinancialSplitBase):
    pass

# Responses para API
class BookingResponse(BookingBase, BookingAdmin):
    id: int
    financial_split: Optional[FinancialSplit] = None

class DashboardStats(SQLModel):
    total_bookings: int
    pending_approval: int
    total_amount: float
    partner_60_percent: float
    multipark_40_percent: float
    approval_rate: float

class FinancialSummary(SQLModel):
    park_brand: str
    payment_method: str
    total_amount: float
    count_bookings: int
    percentage_of_total: float

class ApprovalRequest(SQLModel):
    booking_ids: List[int]
    approved_by: str
    notes: Optional[str] = None

# Para upload Excel
class ExcelUploadResponse(SQLModel):
    message: str
    bookings_count: int
    needs_approval: int
    errors: List[str] = []
    success: bool

# Filtros para queries
class BookingFilters(SQLModel):
    park_brand: Optional[str] = None
    payment_method: Optional[str] = None
    needs_approval: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
