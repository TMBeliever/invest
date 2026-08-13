import logging
from fastapi import APIRouter, HTTPException
from app.data.akshare_client import akshare_client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/analysis/{code}")
def get_financial_analysis(code: str):
    """
    获取个股财报深度分析报告（包含分红覆盖率、4大排雷、杜邦拆解与财报前瞻）
    """
    try:
        report = akshare_client.get_financial_analysis_report(code)
        if not report:
            raise HTTPException(status_code=404, detail="未找到该股票的财报分析数据")
        return report
    except Exception as err:
        logger.error(f"获取财报分析失败 [{code}]: {err}")
        raise HTTPException(status_code=500, detail=str(err))
