/**
 * 红利股评分算法
 *
 * 6 维度加权评分 → 综合分 0-100
 */

import type { DividendDimensions } from "../schemas";

export interface DividendScoreInputs {
  /** 连续分红年数 */
  consecutiveDividendYears: number;
  /** 股息增长率 (%) 最近 3 年年化 */
  dividendGrowthRate: number;
  /** 分红比例标准差 (越小越稳定) */
  payoutRatioStdDev: number;

  /** PE 百分位 (0-1, 近 5 年) */
  pePercentile: number;
  /** PB 百分位 (0-1, 近 5 年) */
  pbPercentile: number;

  /** ROE 最近 3 年均值 (%) */
  roeAvg3Y: number;
  /** ROE 标准差 */
  roeStdDev: number;
  /** 毛利率趋势 (正=上升, 负=下降) */
  grossMarginTrend: number;
  /** 资产负债率 (%) */
  debtRatio: number;
  /** 经营现金流/净利润 */
  ocfToNetIncome: number;

  /** MA20 > MA60 > MA120? */
  maAligned: boolean;
  /** MACD 金叉? */
  macdGolden: boolean;
  /** RSI (0-100) */
  rsi: number;

  /** 当前 PE 买入，持有 1/2/3 年正收益概率 */
  winRate1Y: number;
  winRate2Y: number;
  winRate3Y: number;

  /** 北向资金 30 日增持 (%) */
  northboundChange: number;
  /** 公募持仓比例变化 (%) */
  mutualFundChange: number;
}

const WEIGHTS = {
  dividendStability: 0.25,
  valuationSafety: 0.20,
  fundamentalQuality: 0.20,
  technicalTrend: 0.15,
  historicalWinRate: 0.15,
  institutionalRecognition: 0.05,
} as const;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateDividendScore(inputs: DividendScoreInputs): {
  overallScore: number;
  dimensions: DividendDimensions;
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
} {
  // 1. 股息稳定性
  const yearsScore = clamp(inputs.consecutiveDividendYears / 10 * 100, 0, 100);
  const growthScore = clamp(50 + inputs.dividendGrowthRate * 5, 0, 100);
  const stabilityScore = clamp(100 - inputs.payoutRatioStdDev * 500, 0, 100);
  const dividendStability = Math.round(yearsScore * 0.4 + growthScore * 0.3 + stabilityScore * 0.3);

  // 2. 估值安全边际 (百分位越低 = 越安全 = 分数越高)
  const valuationSafety = Math.round(
    (1 - inputs.pePercentile) * 60 + (1 - inputs.pbPercentile) * 40
  );

  // 3. 基本面质量
  const roeScore = clamp(inputs.roeAvg3Y / 20 * 100, 0, 100);
  const roeStabilityScore = clamp(100 - inputs.roeStdDev * 20, 0, 100);
  const marginScore = clamp(50 + inputs.grossMarginTrend * 20, 0, 100);
  const debtScore = clamp(100 - inputs.debtRatio, 0, 100);
  const cashFlowScore = clamp(inputs.ocfToNetIncome * 100, 0, 100);
  const fundamentalQuality = Math.round(
    roeScore * 0.3 + roeStabilityScore * 0.15 + marginScore * 0.15 +
    debtScore * 0.2 + cashFlowScore * 0.2
  );

  // 4. 技术面趋势
  const maScore = inputs.maAligned ? 80 : 30;
  const macdScore = inputs.macdGolden ? 80 : 30;
  const rsiScore = (inputs.rsi >= 30 && inputs.rsi <= 70) ? 70 :
                   (inputs.rsi < 30 ? 90 : 20); // 超卖反而有机会
  const technicalTrend = Math.round(maScore * 0.4 + macdScore * 0.3 + rsiScore * 0.3);

  // 5. 历史回测胜率
  const historicalWinRate = Math.round(
    inputs.winRate1Y * 30 + inputs.winRate2Y * 30 + inputs.winRate3Y * 40
  );

  // 6. 机构认可度
  const northScore = clamp(50 + inputs.northboundChange * 5, 0, 100);
  const fundScore = clamp(50 + inputs.mutualFundChange * 5, 0, 100);
  const institutionalRecognition = Math.round(northScore * 0.6 + fundScore * 0.4);

  const dimensions: DividendDimensions = {
    dividendStability: clamp(dividendStability, 0, 100),
    valuationSafety: clamp(valuationSafety, 0, 100),
    fundamentalQuality: clamp(fundamentalQuality, 0, 100),
    technicalTrend: clamp(technicalTrend, 0, 100),
    historicalWinRate: clamp(historicalWinRate, 0, 100),
    institutionalRecognition: clamp(institutionalRecognition, 0, 100),
  };

  const overallScore = Math.round(
    dimensions.dividendStability * WEIGHTS.dividendStability +
    dimensions.valuationSafety * WEIGHTS.valuationSafety +
    dimensions.fundamentalQuality * WEIGHTS.fundamentalQuality +
    dimensions.technicalTrend * WEIGHTS.technicalTrend +
    dimensions.historicalWinRate * WEIGHTS.historicalWinRate +
    dimensions.institutionalRecognition * WEIGHTS.institutionalRecognition
  );

  let signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  if (overallScore >= 85) signal = "STRONG_BUY";
  else if (overallScore >= 70) signal = "BUY";
  else if (overallScore >= 50) signal = "HOLD";
  else if (overallScore >= 35) signal = "SELL";
  else signal = "STRONG_SELL";

  return { overallScore, dimensions, signal };
}
