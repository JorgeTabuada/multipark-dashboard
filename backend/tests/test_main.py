"""
Testes básicos para MultiPark Dashboard API
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from sqlmodel.pool import StaticPool

from app.main import app
from app.database import get_session
from app.models import Booking, FinancialSplit


# Test database setup
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", 
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


class TestMain:
    """Testes para endpoints principais"""
    
    def test_read_root(self, client: TestClient):
        """Teste do endpoint raiz"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "MultiPark Dashboard API"
        assert data["status"] == "online"
    
    def test_dashboard_stats_empty(self, client: TestClient):
        """Teste das estatísticas com BD vazia"""
        response = client.get("/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_bookings"] == 0
        assert data["pending_approval"] == 0
        assert data["total_amount"] == 0.0


class TestBookings:
    """Testes para gestão de bookings"""
    
    def test_get_bookings_empty(self, client: TestClient):
        """Teste listar bookings quando BD está vazia"""
        response = client.get("/api/bookings")
        assert response.status_code == 200
        assert response.json() == []
    
    def test_approve_booking_not_found(self, client: TestClient):
        """Teste aprovar booking que não existe"""
        response = client.patch("/api/bookings/999/approve")
        assert response.status_code == 404
        assert "não encontrado" in response.json()["detail"]
    
    def test_create_booking_via_database(self, session: Session):
        """Teste criar booking directamente na BD"""
        booking = Booking(
            license_plate="TEST123",
            price_delivery=35.50,
            park_brand="skypark",
            name="João",
            lastname="Silva"
        )
        session.add(booking)
        session.commit()
        session.refresh(booking)
        
        assert booking.id is not None
        assert booking.license_plate == "TEST123"
        assert booking.price_delivery == 35.50


class TestFinancialCalculations:
    """Testes para cálculos financeiros"""
    
    def test_financial_split_calculation(self, session: Session):
        """Teste da divisão financeira 60/40"""
        # Criar booking
        booking = Booking(
            license_plate="CALC123",
            price_delivery=100.00,
            park_brand="multipark"
        )
        session.add(booking)
        session.commit()
        session.refresh(booking)
        
        # Criar split financeiro
        split = FinancialSplit(
            booking_id=booking.id,
            partner_amount_60=60.00,
            multipark_amount_40=40.00,
            total_amount=100.00
        )
        session.add(split)
        session.commit()
        
        # Verificar cálculos
        assert split.partner_amount_60 == 60.00
        assert split.multipark_amount_40 == 40.00
        assert split.total_amount == 100.00
        assert split.partner_amount_60 + split.multipark_amount_40 == split.total_amount


class TestFileUpload:
    """Testes para upload de ficheiros"""
    
    def test_upload_invalid_file_type(self, client: TestClient):
        """Teste upload com tipo de ficheiro inválido"""
        # Simular ficheiro texto
        files = {"file": ("test.txt", "content", "text/plain")}
        response = client.post("/api/upload-excel", files=files)
        
        assert response.status_code == 400
        assert "Apenas ficheiros Excel" in response.json()["detail"]
    
    def test_upload_missing_file(self, client: TestClient):
        """Teste upload sem ficheiro"""
        response = client.post("/api/upload-excel")
        assert response.status_code == 422  # Validation error


# Testes de integração
class TestIntegration:
    """Testes de integração end-to-end"""
    
    def test_booking_approval_workflow(self, session: Session, client: TestClient):
        """Teste do fluxo completo de aprovação"""
        # 1. Criar booking que precisa aprovação
        booking = Booking(
            license_plate="FLOW123",
            price_delivery=25.75,
            park_brand="airpark",
            name="Maria",
            lastname="Santos",
            date_difference_days=2,
            needs_approval=True,
            status_approved=False
        )
        session.add(booking)
        session.commit()
        session.refresh(booking)
        
        # 2. Verificar que aparece nas stats como pendente
        response = client.get("/api/dashboard/stats")
        data = response.json()
        assert data["pending_approval"] == 1
        
        # 3. Aprovar booking
        response = client.patch(f"/api/bookings/{booking.id}/approve")
        assert response.status_code == 200
        
        # 4. Verificar que foi aprovado
        session.refresh(booking)
        assert booking.status_approved is True
        assert booking.approved_at is not None
        
        # 5. Verificar stats actualizadas
        response = client.get("/api/dashboard/stats")
        data = response.json()
        assert data["pending_approval"] == 0


# Fixtures para dados de teste
@pytest.fixture
def sample_booking_data():
    """Dados de exemplo para booking"""
    return {
        "license_plate": "ABC123",
        "checkout_timestamp": "2025-07-11T14:30:00Z",
        "checkout_formatted": "11/07/2025, 14:30",
        "price_delivery": 42.50,
        "park_brand": "skypark",
        "payment_method": "Multibanco",
        "name": "Ana",
        "lastname": "Costa"
    }


@pytest.fixture
def sample_excel_data():
    """Dados de exemplo para Excel"""
    return [
        {
            "licensePlate": "XYZ789",
            "checkoutDate": "Timestamp(seconds=1720710600, nanoseconds=0)",
            "checkOut": "11/07/2025, 15:30",
            "priceOnDelivery": 33.25,
            "parkBrand": "multipark",
            "paymentMethod": "Credit Card",
            "name": "Pedro",
            "lastname": "Oliveira"
        }
    ]


# Marks para categorizar testes
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.unit
]

# Configuração específica para testes
def pytest_configure(config):
    """Configuração do pytest"""
    config.addinivalue_line(
        "markers", 
        "unit: marca testes unitários"
    )
    config.addinivalue_line(
        "markers", 
        "integration: marca testes de integração"
    )
    config.addinivalue_line(
        "markers", 
        "slow: marca testes lentos"
    )
