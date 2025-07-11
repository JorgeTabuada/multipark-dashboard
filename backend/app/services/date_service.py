"""
Serviço para comparação de datas e timestamps
"""
from datetime import datetime, time, timedelta
from typing import Tuple, Optional
import re

class DateComparator:
    """Comparador de datas para validação de discrepâncias"""
    
    # Limiar: 01:00 do dia seguinte = +1 dia
    THRESHOLD_HOUR = 1
    
    def compare_dates(self, checkout_timestamp: Optional[datetime], checkout_formatted: str) -> Tuple[int, bool]:
        """
        Compara timestamp vs data formatada
        
        Returns:
            (dias_diferenca, needs_approval)
        """
        try:
            if not checkout_timestamp:
                return 0, False
            
            # Parse data formatada
            formatted_date = self._parse_formatted_date(checkout_formatted)
            if not formatted_date:
                return 0, False
            
            # Calcular diferença
            diff = abs((checkout_timestamp.date() - formatted_date.date()).days)
            
            # Verificar se precisa aprovação
            needs_approval = self._needs_approval(checkout_timestamp, formatted_date, diff)
            
            return diff, needs_approval
            
        except Exception as e:
            print(f"Erro comparar datas: {e}")
            return 0, False
    
    def _parse_formatted_date(self, date_str: str) -> Optional[datetime]:
        """Parse string de data em vários formatos"""
        if not date_str or date_str.strip() == '':
            return None
        
        # Formatos possíveis
        formats = [
            '%d/%m/%Y, %H:%M',     # 22/06/2025, 21:56
            '%d/%m/%Y %H:%M',      # 22/06/2025 21:56
            '%d-%m-%Y, %H:%M',     # 22-06-2025, 21:56
            '%d-%m-%Y %H:%M',      # 22-06-2025 21:56
            '%Y-%m-%d %H:%M:%S',   # 2025-06-22 21:56:00
            '%Y-%m-%d %H:%M',      # 2025-06-22 21:56
            '%d/%m/%Y',            # 22/06/2025
            '%d-%m-%Y',            # 22-06-2025
            '%Y-%m-%d',            # 2025-06-22
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        print(f"Formato de data não reconhecido: {date_str}")
        return None
    
    def _needs_approval(self, timestamp: datetime, formatted: datetime, days_diff: int) -> bool:
        """
        Determina se precisa aprovação manual
        
        Regra: apartir de 1 dia a uma da manhã do dia seguinte
        """
        if days_diff == 0:
            return False
        
        if days_diff >= 1:
            # Verificar se passou da 01:00 do dia seguinte
            next_day_threshold = timestamp.replace(
                hour=self.THRESHOLD_HOUR, 
                minute=0, 
                second=0, 
                microsecond=0
            ) + timedelta(days=1)
            
            # Se a data formatada é depois da 01:00 do dia seguinte
            if formatted >= next_day_threshold:
                return True
        
        return days_diff >= 1
    
    def get_color_class(self, days_diff: int, needs_approval: bool) -> str:
        """
        Determina classe CSS para colorir linha
        
        Returns:
            'success' (verde), 'warning' (amarelo), 'danger' (vermelho)
        """
        if days_diff == 0:
            return 'success'
        elif days_diff == 1 and not needs_approval:
            return 'warning'
        else:
            return 'danger'
    
    def format_difference_message(self, days_diff: int, needs_approval: bool) -> str:
        """Mensagem explicativa da diferença"""
        if days_diff == 0:
            return "✅ Datas coincidem"
        elif days_diff == 1:
            if needs_approval:
                return "⚠️ Diferença de 1 dia - Requer aprovação"
            else:
                return "⚠️ Diferença de 1 dia - Dentro do limite"
        else:
            return f"❌ Diferença de {days_diff} dias - Requer aprovação"
    
    def get_batch_stats(self, bookings: list) -> dict:
        """Estatísticas do lote processado"""
        total = len(bookings)
        needs_approval = sum(1 for b in bookings if b.get('needs_approval', False))
        perfect_match = sum(1 for b in bookings if b.get('date_difference_days', 0) == 0)
        
        return {
            'total_bookings': total,
            'perfect_matches': perfect_match,
            'needs_approval': needs_approval,
            'auto_approved': total - needs_approval,
            'approval_rate': round((total - needs_approval) / total * 100, 2) if total > 0 else 0
        }
