"""
FastAPI backend para MultiPark Dashboard
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
import pandas as pd
from datetime import datetime, timedelta
import os
from typing import List, Optional

from .models import Booking, FinancialSplit, BookingCreate, BookingUpdate
from .database import get_session, create_db_and_tables
from .services.excel_service import ExcelProcessor
from .services.date_service import DateComparator
from .services.financial_service import FinancialCalculator

app = FastAPI(
    title="MultiPark Dashboard API",
    description="API para gestão de bookings e divisão financeira",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get("/")
def read_root():
    return {"message": "MultiPark Dashboard API", "status": "online"}

@app.post("/api/upload-excel")
async def upload_excel(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Upload e processa ficheiro Excel"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Apenas ficheiros Excel (.xlsx, .xls)")
    
    # Processar Excel
    processor = ExcelProcessor()
    bookings_data = await processor.process_file(file)
    
    # Guardar na BD
    bookings_created = []
    for booking_data in bookings_data:
        # Comparar datas
        comparator = DateComparator()
        date_diff, needs_approval = comparator.compare_dates(
            booking_data['checkout_timestamp'], 
            booking_data['checkout_formatted']
        )
        
        # Criar booking
        booking = Booking(
            license_plate=booking_data['license_plate'],
            checkout_timestamp=booking_data['checkout_timestamp'],
            checkout_formatted=booking_data['checkout_formatted'],
            price_delivery=float(booking_data['price_delivery'] or 0),
            park_brand=booking_data['park_brand'],
            payment_method=booking_data['payment_method'],
            name=booking_data['name'],
            lastname=booking_data['lastname'],
            date_difference_days=date_diff,
            needs_approval=needs_approval,
            status_approved=not needs_approval  # Auto-aprova se não precisar
        )
        
        session.add(booking)
        session.commit()
        session.refresh(booking)
        
        # Calcular divisão financeira
        calculator = FinancialCalculator()
        partner_60, multipark_40 = calculator.calculate_split(booking.price_delivery)
        
        financial_split = FinancialSplit(
            booking_id=booking.id,
            partner_amount_60=partner_60,
            multipark_amount_40=multipark_40,
            total_amount=booking.price_delivery
        )
        session.add(financial_split)
        
        bookings_created.append(booking)
    
    session.commit()
    
    return {
        "message": f"Processados {len(bookings_created)} registos",
        "bookings_count": len(bookings_created),
        "needs_approval": len([b for b in bookings_created if b.needs_approval])
    }

@app.get("/api/bookings", response_model=List[Booking])
def get_bookings(
    skip: int = 0, 
    limit: int = 100,
    needs_approval: Optional[bool] = None,
    session: Session = Depends(get_session)
):
    """Lista bookings com filtros"""
    query = select(Booking)
    
    if needs_approval is not None:
        query = query.where(Booking.needs_approval == needs_approval)
    
    bookings = session.exec(query.offset(skip).limit(limit)).all()
    return bookings

@app.patch("/api/bookings/{booking_id}/approve")
def approve_booking(booking_id: int, session: Session = Depends(get_session)):
    """Aprovar booking manualmente"""
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking não encontrado")
    
    booking.status_approved = True
    booking.approved_at = datetime.utcnow()
    session.add(booking)
    session.commit()
    
    return {"message": "Booking aprovado", "booking_id": booking_id}

@app.get("/api/dashboard/stats")
def get_dashboard_stats(session: Session = Depends(get_session)):
    """Estatísticas para dashboard"""
    total_bookings = session.exec(select(Booking)).all()
    pending_approval = session.exec(select(Booking).where(Booking.needs_approval == True, Booking.status_approved == False)).all()
    
    # Totais financeiros
    financial_splits = session.exec(select(FinancialSplit)).all()
    total_partner = sum(fs.partner_amount_60 for fs in financial_splits)
    total_multipark = sum(fs.multipark_amount_40 for fs in financial_splits)
    total_amount = sum(fs.total_amount for fs in financial_splits)
    
    return {
        "total_bookings": len(total_bookings),
        "pending_approval": len(pending_approval),
        "total_amount": total_amount,
        "partner_60_percent": total_partner,
        "multipark_40_percent": total_multipark,
        "approval_rate": round((len(total_bookings) - len(pending_approval)) / len(total_bookings) * 100, 2) if total_bookings else 0
    }

@app.get("/api/financial/partner")
def get_partner_financials(session: Session = Depends(get_session)):
    """Contas Parceiro (60%)"""
    return {"message": "Implementar query financeira parceiro"}

@app.get("/api/financial/multipark")
def get_multipark_financials(session: Session = Depends(get_session)):
    """Contas Multipark (40%)"""
    return {"message": "Implementar query financeira multipark"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
