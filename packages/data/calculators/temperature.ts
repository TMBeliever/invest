/**
 * 红利板块测温算法
 *
 * 7 个指标加权计算板块温度 (0-100°C)
 * 温度越低 = 越值得买入
 */

export interface TemperatureInputs {
  /** 中证红利 PE 百分位 (0-1) */
  pePercentile: number;
  /** 中证红利当前股息率 (%) */
  dividendYield: number;
  /** 中证红利历史中位数股息率 (%) */
  medianDividendYield: number;
  /** 10 年国债收益率 (%) */
  bondYield10Y: number;
  /** 红利 vs 沪深300 近 60 日超额收益 (%) */
  excessReturn60d: number;
  /** 红利 ETF 近 30 日资金净流入 (亿元) */
  etfNetFlow30d: number;
  /** 红利成份股破净率 (0-1) */
  breakNetRatio: number;
  /** 北向资金红利持仓 30 日变化 (%) */
  northboundChange30d: number;
}

export interface TemperatureResult {
  temperature: number;
  zone: "FREEZING" | "COOL" | "NEUTRAL" | "WARM" | "HOT";
  indicators: {
    pePercentile: number;
    dividendYield: number;
    yieldVsBondRatio: number;
    excessReturn60d: number;
    etfFlowScore: number;
    breakNetRatio: number;
    northboundChange: number;
  };
  suggestion: string;
}

const WEIGHTS = {
  pePercentile: 0.25,
  dividendYield: 0.20,
  yieldVsBondRatio: 0.15,
  excessReturn: 0.15,
  etfFlow: 0.10,
  breakNetRatio: 0.10,
  northboundChange: 0.05,
} as const;

/** 将值限制在 [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 计算红利板块温度
 */
export function calculateTemperature(inputs: TemperatureInputs): TemperatureResult {
  // 1. PE 百分位 → 直接映射 (百分位越高 = 越贵 = 温度越高)
  const peScore = inputs.pePercentile * 100;

  // 2. 股息率 → 高于中位数越多 = 越便宜 = 温度越低
  const yieldRatio = inputs.dividendYield / Math.max(inputs.medianDividendYield, 0.01);
  const yieldScore = clamp((2 - yieldRatio) * 50, 0, 100);

  // 3. 股息率/国债利率比 → 比值越高 = 红利越有吸引力 = 温度越低
  const yieldBondRatio = inputs.dividendYield / Math.max(inputs.bondYield10Y, 0.01);
  const yieldBondScore = clamp((3 - yieldBondRatio) / 3 * 100, 0, 100);

  // 4. 超额收益 → 跑赢越多 = 资金追捧 = 温度升高
  const excessScore = clamp(50 + inputs.excessReturn60d * 5, 0, 100);

  // 5. ETF 资金流 → 大量流入 = 拥挤 = 温度升高
  const etfScore = clamp(50 + inputs.etfNetFlow30d * 2, 0, 100);

  // 6. 破净率 → 破净越多 = 越便宜 = 温度越低
  const breakNetScore = clamp((1 - inputs.breakNetRatio) * 100, 0, 100);

  // 7. 北向变化 → 增持 = 外资看好 = 偏暖
  const northboundScore = clamp(50 + inputs.northboundChange30d * 3, 0, 100);

  // 加权计算
  const temperature = clamp(
    peScore * WEIGHTS.pePercentile +
    yieldScore * WEIGHTS.dividendYield +
    yieldBondScore * WEIGHTS.yieldVsBondRatio +
    excessScore * WEIGHTS.excessReturn +
    etfScore * WEIGHTS.etfFlow +
    breakNetScore * WEIGHTS.breakNetRatio +
    northboundScore * WEIGHTS.northboundChange,
    0, 100
  );

  // 分区
  let zone: TemperatureResult["zone"];
  let suggestion: string;
  if (temperature < 20) {
    zone = "FREEZING";
    suggestion = "极度低估，强烈建议加仓红利资产";
  } else if (temperature < 40) {
    zone = "COOL";
    suggestion = "偏低估，当前是配置红利资产的良好窗口期";
  } else if (temperature < 60) {
    zone = "NEUTRAL";
    suggestion = "估值适中，建议维持现有配置，可定投";
  } else if (temperature < 80) {
    zone = "WARM";
    suggestion = "偏高估，减少新增买入，持有等待";
  } else {
    zone = "HOT";
    suggestion = "过热，建议逐步止盈，锁定收益";
  }

  return {
    temperature: Math.round(temperature),
    zone,
    indicators: {
      pePercentile: Math.round(peScore),
      dividendYield: Math.round(yieldScore),
      yieldVsBondRatio: Math.round(yieldBondScore),
      excessReturn60d: Math.round(excessScore),
      etfFlowScore: Math.round(etfScore),
      breakNetRatio: Math.round(breakNetScore),
      northboundChange: Math.round(northboundScore),
    },
    suggestion,
  };
}
