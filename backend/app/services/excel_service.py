"""
Serviço para processar ficheiros Excel
"""
import pandas as pd
import openpyxl
from datetime import datetime
from typing import List, Dict, Any
from fastapi import UploadFile, HTTPException
import io

class ExcelProcessor:
    """Processador de ficheiros Excel do MultiPark"""
    
    REQUIRED_COLUMNS = [
        'licensePlate', 'checkoutDate', 'extraServices', 'parkingType', 
        'checkOut', 'campaign', 'paymentMethod', 'lastname', 'name', 
        'alocation', 'priceOnDelivery', 'campaignPay', 'bookingDate', 
        'checkIn', 'lastName', 'bookingPrice', 'hasOnlinePayment', 
        'stats', 'row', 'deliveryPrice', 'paymentIntentId', 'parkBrand'
    ]
    
    async def process_file(self, file: UploadFile) -> List[Dict[str, Any]]:
        """
        Processa ficheiro Excel e retorna lista de bookings
        """
        try:
            # Ler ficheiro
            contents = await file.read()
            df = pd.read_excel(io.BytesIO(contents))
            
            # Validar colunas
            self._validate_columns(df)
            
            # Processar dados
            bookings_data = []
            for _, row in df.iterrows():
                booking_data = self._process_row(row)
                if booking_data:  # Skip rows vazias
                    bookings_data.append(booking_data)
            
            return bookings_data
            
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Erro ao processar Excel: {str(e)}"
            )
    
    def _validate_columns(self, df: pd.DataFrame):
        """Validar se Excel tem colunas necessárias"""
        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Colunas em falta no Excel: {', '.join(missing_columns)}"
            )
    
    def _process_row(self, row: pd.Series) -> Dict[str, Any]:
        """Processar uma linha do Excel"""
        try:
            # Skip se não tem matrícula
            if pd.isna(row['licensePlate']) or not row['licensePlate']:
                return None
            
            # Processar timestamp checkout
            checkout_timestamp = self._parse_timestamp(row['checkoutDate'])
            
            return {
                'license_plate': str(row['licensePlate']).strip(),
                'checkout_timestamp': checkout_timestamp,
                'checkout_formatted': str(row.get('checkOut', '')).strip(),
                'price_delivery': self._safe_float(row.get('priceOnDelivery', 0)),
                'park_brand': str(row.get('parkBrand', '')).strip().lower(),
                'payment_method': str(row.get('paymentMethod', '')).strip(),
                'name': str(row.get('name', '')).strip(),
                'lastname': str(row.get('lastname', '')).strip(),
                'extra_services': str(row.get('extraServices', '')).strip(),
                'parking_type': str(row.get('parkingType', '')).strip(),
                'campaign': str(row.get('campaign', '')).strip(),
                'alocation': str(row.get('alocation', '')).strip(),
                'campaign_pay': self._safe_bool(row.get('campaignPay')),
                'booking_date': str(row.get('bookingDate', '')).strip(),
                'check_in': str(row.get('checkIn', '')).strip(),
                'booking_price': self._safe_float(row.get('bookingPrice', 0)),
                'has_online_payment': self._safe_bool(row.get('hasOnlinePayment')),
                'stats': str(row.get('stats', '')).strip(),
                'row': str(row.get('row', '')).strip(),
                'delivery_price': self._safe_float(row.get('deliveryPrice', 0)),
                'payment_intent_id': str(row.get('paymentIntentId', '')).strip()
            }
            
        except Exception as e:
            print(f"Erro a processar linha: {e}")
            return None
    
    def _parse_timestamp(self, timestamp_value) -> datetime:
        """
        Parse timestamp do Firebase formato: 
        Timestamp(seconds=1750625764, nanoseconds=637000000)
        """
        try:
            if pd.isna(timestamp_value):
                return None
                
            timestamp_str = str(timestamp_value)
            
            # Se já é datetime
            if isinstance(timestamp_value, datetime):
                return timestamp_value
            
            # Parse Firebase timestamp
            if 'Timestamp(' in timestamp_str:
                # Extract seconds
                start = timestamp_str.find('seconds=') + 8
                end = timestamp_str.find(',', start)
                seconds = int(timestamp_str[start:end])
                
                return datetime.fromtimestamp(seconds)
            
            # Parse string data normal
            for fmt in ['%d/%m/%Y, %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
                try:
                    return datetime.strptime(timestamp_str, fmt)
                except ValueError:
                    continue
            
            return None
            
        except Exception as e:
            print(f"Erro parse timestamp {timestamp_value}: {e}")
            return None
    
    def _safe_float(self, value) -> float:
        """Converter para float seguro"""
        try:
            if pd.isna(value) or value == '':
                return 0.0
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _safe_bool(self, value) -> bool:
        """Converter para bool seguro"""
        try:
            if pd.isna(value):
                return False
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes', 'sim']
            return bool(value)
        except (ValueError, TypeError):
            return False
    
    def get_summary(self, bookings_data: List[Dict]) -> Dict[str, Any]:
        """Sumário dos dados processados"""
        if not bookings_data:
            return {
                'total_records': 0,
                'total_amount': 0,
                'unique_brands': [],
                'payment_methods': []
            }
        
        total_amount = sum(booking['price_delivery'] for booking in bookings_data)
        unique_brands = list(set(booking['park_brand'] for booking in bookings_data if booking['park_brand']))
        payment_methods = list(set(booking['payment_method'] for booking in bookings_data if booking['payment_method']))
        
        return {
            'total_records': len(bookings_data),
            'total_amount': total_amount,
            'unique_brands': unique_brands,
            'payment_methods': payment_methods
        }
