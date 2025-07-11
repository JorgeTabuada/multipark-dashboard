"""
Configuração da base de dados Supabase PostgreSQL
"""
from sqlmodel import SQLModel, create_engine, Session
import os
from typing import Generator

# Supabase connection
SUPABASE_URL = os.getenv("SUPABASE_URL", "postgresql://postgres:password@localhost:5432/multipark")
DATABASE_URL = SUPABASE_URL.replace("postgresql://", "postgresql+psycopg2://")

# Engine
engine = create_engine(
    DATABASE_URL,
    echo=True if os.getenv("DEBUG") == "true" else False,
    pool_pre_ping=True,
    pool_recycle=300
)

def create_db_and_tables():
    """Criar tabelas na primeira execução"""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """Dependency para obter sessão de BD"""
    with Session(engine) as session:
        yield session

# Para testes
def get_test_session():
    """Sessão para testes unitários"""
    from sqlmodel import create_engine
    test_engine = create_engine("sqlite:///test.db", echo=True)
    SQLModel.metadata.create_all(test_engine)
    
    with Session(test_engine) as session:
        yield session
