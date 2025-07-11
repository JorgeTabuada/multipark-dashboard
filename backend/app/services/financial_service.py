"""
Serviço para cálculos financeiros 60/40
"""
from typing import Tuple, Dict, List
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

class FinancialCalculator:
    """Calculadora para divisão financeira Parceiro/Multipark"""
    
    PARTNER_PERCENTAGE = Decimal('0.60')  # 60%
    MULTIPARK_PERCENTAGE = Decimal('0.40')  # 40%
    
    def calculate_split(self, amount: float) -> Tuple[float, float]:
        """
        Calcula divisão 60% Parceiro / 40% Multipark
        
        Args:
            amount: Valor em priceOnDelivery
            
        Returns:
            (partner_60_percent, multipark_40_percent)
        """
        if amount <= 0:
            return 0.0, 0.0
        
        # Usar Decimal para precisão
        total = Decimal(str(amount))
        
        partner_amount = (total * self.PARTNER_PERCENTAGE).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        multipark_amount = (total * self.MULTIPARK_PERCENTAGE).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        return float(partner_amount), float(multipark_amount)
    
    def calculate_batch_totals(self, bookings: List[dict]) -> Dict[str, float]:
        """
        Calcula totais para um lote de bookings
        """
        total_amount = 0.0
        total_partner = 0.0
        total_multipark = 0.0
        
        for booking in bookings:
            amount = booking.get('price_delivery', 0)
            partner, multipark = self.calculate_split(amount)
            
            total_amount += amount
            total_partner += partner
            total_multipark += multipark
        
        return {
            'total_amount': round(total_amount, 2),
            'partner_60_percent': round(total_partner, 2),
            'multipark_40_percent': round(total_multipark, 2),
            'count_bookings': len(bookings)
        }
    
    def get_breakdown_by_brand(self, bookings: List[dict]) -> Dict[str, Dict]:
        """
        Breakdown financeiro por park_brand
        """
        breakdown = {}
        
        for booking in bookings:
            brand = booking.get('park_brand', 'unknown')
            amount = booking.get('price_delivery', 0)
            
            if brand not in breakdown:
                breakdown[brand] = {
                    'total_amount': 0.0,
                    'partner_60': 0.0,
                    'multipark_40': 0.0,
                    'count': 0
                }
            
            partner, multipark = self.calculate_split(amount)
            breakdown[brand]['total_amount'] += amount
            breakdown[brand]['partner_60'] += partner
            breakdown[brand]['multipark_40'] += multipark
            breakdown[brand]['count'] += 1
        
        # Round values
        for brand_data in breakdown.values():
            brand_data['total_amount'] = round(brand_data['total_amount'], 2)
            brand_data['partner_60'] = round(brand_data['partner_60'], 2)
            brand_data['multipark_40'] = round(brand_data['multipark_40'], 2)
        
        return breakdown
    
    def get_breakdown_by_payment_method(self, bookings: List[dict]) -> Dict[str, Dict]:
        """
        Breakdown financeiro por payment_method
        """
        breakdown = {}
        
        for booking in bookings:
            method = booking.get('payment_method', 'unknown')
            amount = booking.get('price_delivery', 0)
            
            if method not in breakdown:
                breakdown[method] = {
                    'total_amount': 0.0,
                    'partner_60': 0.0,
                    'multipark_40': 0.0,
                    'count': 0
                }
            
            partner, multipark = self.calculate_split(amount)
            breakdown[method]['total_amount'] += amount
            breakdown[method]['partner_60'] += partner
            breakdown[method]['multipark_40'] += multipark
            breakdown[method]['count'] += 1
        
        # Round values
        for method_data in breakdown.values():
            method_data['total_amount'] = round(method_data['total_amount'], 2)
            method_data['partner_60'] = round(method_data['partner_60'], 2)
            method_data['multipark_40'] = round(method_data['multipark_40'], 2)
        
        return breakdown
    
    def validate_split_accuracy(self, original_amount: float, partner: float, multipark: float) -> bool:
        """
        Valida se a divisão está correta (sem perda de precisão)
        """
        total_split = partner + multipark
        return abs(original_amount - total_split) < 0.01  # Tolerância de 1 cêntimo
    
    def generate_financial_report(self, bookings: List[dict]) -> Dict[str, any]:
        """
        Gera relatório financeiro completo
        """
        batch_totals = self.calculate_batch_totals(bookings)
        brand_breakdown = self.get_breakdown_by_brand(bookings)
        payment_breakdown = self.get_breakdown_by_payment_method(bookings)
        
        # Top performers
        top_brands = sorted(
            brand_breakdown.items(), 
            key=lambda x: x[1]['total_amount'], 
            reverse=True
        )[:5]
        
        top_payment_methods = sorted(
            payment_breakdown.items(), 
            key=lambda x: x[1]['total_amount'], 
            reverse=True
        )[:5]
        
        return {
            'summary': batch_totals,
            'by_brand': brand_breakdown,
            'by_payment_method': payment_breakdown,
            'top_brands': dict(top_brands),
            'top_payment_methods': dict(top_payment_methods),
            'generated_at': str(datetime.utcnow())
        }
