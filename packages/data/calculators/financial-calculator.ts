import type {
  DividendCoverage,
  FinancialHealthScan,
  HealthScanItem,
  DuPontBreakdown,
  EarningsPreview,
} from "../schemas";

export function calculateDividendSustainability(
  freeCashFlow: number,
  totalDividends: number,
  netProfit: number,
  consecutiveYears: number,
  history: Array<{ year: string; dividendPerShare: number; payoutRatio: number }>
): DividendSustainability {
  const coverageRatio = totalDividends > 0 ? (freeCashFlow / totalDividends) * 100 : 0;
  const payoutRatio = netProfit > 0 ? (totalDividends / netProfit) * 100 : 0;

  let status: "HEALTHY" | "WARNING" | "DANGEROUS" = "HEALTHY";
  let message = "分红由充足的自由现金流全面覆盖，支付结构非常健康";

  if (payoutRatio > 100) {
    status = "DANGEROUS";
    message = "分红总额已超过当期净利润（吃老本分红），若非公用事业现金牛，分红极难维持";
  } else if (coverageRatio < 100 && totalDividends > 0) {
    status = "WARNING";
    message = "自由现金流不足以覆盖现金分红，可能依赖举债或变卖资产维持分配";
  }

  return {
    freeCashFlow: Number(freeCashFlow.toFixed(2)),
    totalDividends: Number(totalDividends.toFixed(2)),
    coverageRatio: Number(coverageRatio.toFixed(1)),
    payoutRatio: Number(payoutRatio.toFixed(1)),
    consecutiveYears,
    status,
    message,
    history,
  };
}

export function calculateFinancialHealthScan(
  operatingCashFlow: number,
  netProfit: number,
  monetaryFunds: number,
  interestBearingDebt: number,
  goodwill: number,
  netAssets: number,
  liabilityRatio: number,
  trends: Array<{ year: string; revenue: number; netProfit: number; operatingCashFlow: number }>
): FinancialHealthScan {
  const items: HealthScanItem[] = [];

  // 1. 利润真实度（现金流匹配度）
  const cashNetRatio = netProfit > 0 ? operatingCashFlow / netProfit : 0;
  let cashStatus: "PASS" | "WARNING" | "DANGER" = "PASS";
  let cashDetail = "经营现金流与净利润匹配度高，盈利含金量充沛";
  if (cashNetRatio < 0.6) {
    cashStatus = "DANGER";
    cashDetail = "经营现金流远低于净利润，大量利润滞留在应收账款或存货，需防范虚假利润";
  } else if (cashNetRatio < 0.85) {
    cashStatus = "WARNING";
    cashDetail = "经营现金流略低于净利润，回款节奏较慢";
  }

  items.push({
    key: "cash_quality",
    name: "利润真实度 (现金/净利)",
    status: cashStatus,
    valueStr: `${(cashNetRatio * 100).toFixed(1)}%`,
    detail: cashDetail,
  });

  // 2. 存贷双高风险
  let loanStatus: "PASS" | "WARNING" | "DANGER" = "PASS";
  let loanDetail = "货币资金与债务结构合理，无假账资金风险";
  if (monetaryFunds > 20 && interestBearingDebt > 20 && monetaryFunds / (interestBearingDebt + 1) > 0.8) {
    loanStatus = "WARNING";
    loanDetail = "账面手握大额现金，同时承担高额有息债务（存贷双高现象），需防范资金冻结或造假";
  }

  items.push({
    key: "deposit_loan",
    name: "存贷结构安全度",
    status: loanStatus,
    valueStr: loanStatus === "PASS" ? "正常" : "存贷双高",
    detail: loanDetail,
  });

  // 3. 商誉风险
  const goodwillRatio = netAssets > 0 ? (goodwill / netAssets) * 100 : 0;
  let gwStatus: "PASS" | "WARNING" | "DANGER" = "PASS";
  let gwDetail = "商誉占净资产比例极低，基本无并购减值爆雷风险";
  if (goodwillRatio > 30) {
    gwStatus = "DANGER";
    gwDetail = "商誉占比超过 30%，随时面临大额减值洗大澡砸盘风险";
  } else if (goodwillRatio > 15) {
    gwStatus = "WARNING";
    gwDetail = "商誉占比处于偏高水平，需关注并购子公司业绩承诺完成度";
  }

  items.push({
    key: "goodwill",
    name: "商誉减值预警 (商誉/净资产)",
    status: gwStatus,
    valueStr: `${goodwillRatio.toFixed(1)}%`,
    detail: gwDetail,
  });

  // 4. 资产负债率
  let debtStatus: "PASS" | "WARNING" | "DANGER" = "PASS";
  let debtDetail = "杠杆水平稳健，财务风险可控";
  if (liabilityRatio > 75) {
    debtStatus = "DANGER";
    debtDetail = "资产负债率超过 75%，财务杠杆极高，抗风险能力弱";
  } else if (liabilityRatio > 60) {
    debtStatus = "WARNING";
    debtDetail = "资产负债率处于中高水平，需关注利息偿付能力";
  }

  items.push({
    key: "liability",
    name: "资产负债率",
    status: debtStatus,
    valueStr: `${liabilityRatio.toFixed(1)}%`,
    detail: debtDetail,
  });

  const overallStatus = items.some((i) => i.status === "DANGER")
    ? "DANGER"
    : items.some((i) => i.status === "WARNING")
    ? "WARNING"
    : "PASS";

  return {
    overallStatus,
    items,
    trends,
  };
}

export function calculateDuPontBreakdown(
  roe: number,
  netProfitMargin: number,
  assetTurnover: number,
  equityMultiplier: number,
  history: Array<{ year: string; roe: number; netProfitMargin: number; assetTurnover: number; equityMultiplier: number }>
): DuPontBreakdown {
  let businessType: "HIGH_MARGIN" | "HIGH_TURNOVER" | "HIGH_LEVERAGE" | "BALANCED" = "BALANCED";
  let businessTypeLabel = "均衡稳健型";
  let description = "收益率来源于净利润率、资产周转率与资本杠杆的均衡协同";

  if (netProfitMargin >= 20 && assetTurnover < 0.8) {
    businessType = "HIGH_MARGIN";
    businessTypeLabel = "高毛利护城河型";
    description = "依靠品牌定价权与高净利率驱动盈利（如公用事业独占/高端消费），受经济周期冲击小";
  } else if (assetTurnover >= 1.1) {
    businessType = "HIGH_TURNOVER";
    businessTypeLabel = "高效运营周转型";
    description = "依靠极致的资产周转效率与运营管理赚钱，现金流回笼快";
  } else if (equityMultiplier >= 3.5) {
    businessType = "HIGH_LEVERAGE";
    businessTypeLabel = "高杠杆驱动型";
    description = "收益率高度依赖资本杠杆与债务扩张（如银行/地产/重资产），需密切关注利差与偿债风险";
  }

  return {
    roe: Number(roe.toFixed(2)),
    netProfitMargin: Number(netProfitMargin.toFixed(2)),
    assetTurnover: Number(assetTurnover.toFixed(2)),
    equityMultiplier: Number(equityMultiplier.toFixed(2)),
    businessType,
    businessTypeLabel,
    description,
    history,
  };
}

export function calculateEarningsPreview(
  nextReportName: string,
  disclosureDate: string | null,
  officialNotice?: { hasNotice: boolean; title?: string; netProfitRange?: string; changePctRange?: string; type?: string },
  consensus?: { hasConsensus: boolean; analystCount?: number; predictedProfit?: number; direction?: "UP" | "DOWN" | "FLAT"; changePct?: number },
  runRateProfit?: number,
  lastYearProfit?: number
): EarningsPreview {
  let daysToDisclosure: number | null = null;
  if (disclosureDate) {
    const target = new Date(disclosureDate).getTime();
    const now = new Date().getTime();
    daysToDisclosure = Math.max(0, Math.ceil((target - now) / (1000 * 3600 * 24)));
  }

  let rating: "BEAT" | "IN_LINE" | "MISS" | "NEUTRAL" = "NEUTRAL";
  let summary = "目前暂无充分预测数据，建议关注官方后续发布的业绩预告";

  if (officialNotice?.hasNotice) {
    const t = officialNotice.type || "";
    if (t.includes("预增") || t.includes("预盈") || t.includes("续盈") || t.includes("略增")) {
      rating = "BEAT";
      summary = `官方已发布业绩预告，预计利润区间为 ${officialNotice.netProfitRange || "大幅增长"}，业绩强劲`;
    } else if (t.includes("预减") || t.includes("首亏") || t.includes("续亏")) {
      rating = "MISS";
      summary = `官方业绩预告提示承压（${officialNotice.netProfitRange || "下滑"}），需警惕估值回调`;
    } else {
      rating = "IN_LINE";
      summary = "官方业绩预告显示表现平稳，符合市场既有预期";
    }
  } else if (consensus?.hasConsensus) {
    if (consensus.direction === "UP") {
      rating = "BEAT";
      summary = `卖方分析师普遍上调业绩预期，机构中位数预估净利润为 ${consensus.predictedProfit?.toFixed(2)} 亿元`;
    } else if (consensus.direction === "DOWN") {
      rating = "MISS";
      summary = `卖方分析师近期下调盈利预测，机构一致预估为 ${consensus.predictedProfit?.toFixed(2)} 亿元`;
    } else {
      rating = "IN_LINE";
      summary = `机构预测一致性较高，中位数估算净利润为 ${consensus.predictedProfit?.toFixed(2)} 亿元`;
    }
  }

  let runRateForecast: { predictedProfit: number; yoyPct: number } | undefined = undefined;
  if (runRateProfit !== undefined && lastYearProfit && lastYearProfit > 0) {
    const yoy = ((runRateProfit - lastYearProfit) / lastYearProfit) * 100;
    runRateForecast = {
      predictedProfit: Number(runRateProfit.toFixed(2)),
      yoyPct: Number(yoy.toFixed(1)),
    };
  }

  return {
    nextReportName,
    disclosureDate,
    daysToDisclosure,
    officialNotice,
    consensus,
    runRateForecast,
    rating,
    summary,
  };
}
