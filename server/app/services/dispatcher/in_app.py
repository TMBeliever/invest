from typing import Dict, Any
from app.services.dispatcher.base import BaseChannelAdapter
from app.schemas.intelligence import IntelligencePayload, ReportType
from app.data.storage import storage_db

class InAppAdapter(BaseChannelAdapter):
    channel_name = "IN_APP"

    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        try:
            if payload.report_type == ReportType.SENTINEL_ALERT and payload.user_id:
                # 存入哨兵告警表
                alert_dict = {
                    "id": payload.id,
                    "user_id": payload.user_id,
                    "rule_code": payload.structured_metrics.get("rule_code", "GENERIC_RISK"),
                    "category": payload.structured_metrics.get("category", "RISK"),
                    "severity": payload.severity.value,
                    "symbol": payload.symbol,
                    "symbol_name": payload.symbol_name,
                    "title": payload.title,
                    "summary": payload.summary,
                    "markdown_content": payload.markdown_content,
                    "structured_metrics": payload.structured_metrics,
                    "decision_options": [opt.model_dump() for opt in payload.decision_options] if payload.decision_options else [],
                }
                storage_db.save_sentinel_alert(alert_dict)
            else:
                # 存入研报与宏观情报表
                report_dict = {
                    "id": payload.id,
                    "report_type": payload.report_type.value,
                    "severity": payload.severity.value,
                    "title": payload.title,
                    "summary": payload.summary,
                    "markdown_content": payload.markdown_content,
                    "structured_metrics": payload.structured_metrics,
                    "decision_options": [opt.model_dump() for opt in payload.decision_options] if payload.decision_options else [],
                    "created_date": payload.created_at[:10],
                }
                storage_db.save_intelligence_report(report_dict)
            return True
        except Exception as e:
            print(f"[InAppAdapter] Error saving in-app alert: {e}")
            return False
