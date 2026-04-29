// 2026 US Federal & State Income Tax Estimator
// Federal brackets from IRS Rev. Proc. 2025-28 (inflation-adjusted for 2026)
// State rates are flat or simplified progressive estimates; not tax advice.

export type FilingStatus = "single" | "married";

interface Bracket {
  rate: number;
  from: number;
  to: number;
}

// 2026 Federal income tax brackets (single filer)
const FEDERAL_BRACKETS_SINGLE: Bracket[] = [
  { rate: 0.10, from: 0,      to: 11_925  },
  { rate: 0.12, from: 11_925, to: 48_475  },
  { rate: 0.22, from: 48_475, to: 103_350 },
  { rate: 0.24, from: 103_350,to: 197_300 },
  { rate: 0.32, from: 197_300,to: 250_525 },
  { rate: 0.35, from: 250_525,to: 626_350 },
  { rate: 0.37, from: 626_350,to: Infinity },
];

// 2026 Federal income tax brackets (married filing jointly)
const FEDERAL_BRACKETS_MARRIED: Bracket[] = [
  { rate: 0.10, from: 0,      to: 23_850  },
  { rate: 0.12, from: 23_850, to: 96_950  },
  { rate: 0.22, from: 96_950, to: 206_700 },
  { rate: 0.24, from: 206_700,to: 394_600 },
  { rate: 0.32, from: 394_600,to: 501_050 },
  { rate: 0.35, from: 501_050,to: 751_600 },
  { rate: 0.37, from: 751_600,to: Infinity },
];

// Standard deductions 2026
const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single:  15_000,
  married: 30_000,
};

// State rates — flat rate or effective progressive approximation.
// TX, WA, FL have no income tax. Rates are marginal top brackets for typical tech salaries.
const STATE_RATES: Record<string, number> = {
  CA: 0.093, // 9.3% bracket for $67k–$339k
  NY: 0.0685,
  TX: 0,
  WA: 0,
  FL: 0,
  IL: 0.0495, // flat
  MA: 0.05,   // flat (Millionaire's surtax not modeled)
  NJ: 0.0897,
  PA: 0.0307, // flat
  OH: 0.0399,
  GA: 0.055,
  NC: 0.0499,
  MI: 0.0425, // flat
  VA: 0.0575,
  CO: 0.044,  // flat
  AZ: 0.025,
  WI: 0.0765,
  MN: 0.0985,
  MD: 0.0575,
  OR: 0.099,
  IN: 0.0305, // flat
  TN: 0,      // no income tax
  NV: 0,
  WY: 0,
  SD: 0,
  AK: 0,
  NH: 0,
  MT: 0.069,
  ID: 0.058,
  UT: 0.0485,
  KY: 0.04,   // flat
  AL: 0.05,
  SC: 0.064,
  KS: 0.057,
  MO: 0.0495,
  IA: 0.048,
  NE: 0.0664,
  AR: 0.044,
  MS: 0.05,
  OK: 0.0475,
  LA: 0.03,
  RI: 0.0599,
  CT: 0.069,
  DE: 0.066,
  NM: 0.059,
  HI: 0.11,
  DC: 0.085,
  ME: 0.0715,
  VT: 0.0875,
  WV: 0.065,
  ND: 0.025,
};

function applyBrackets(taxableIncome: number, brackets: Bracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.from) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.to) - bracket.from;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

export interface TakeHomeResult {
  grossAnnual: number;
  federalTax: number;
  stateTax: number;
  fica: number;
  totalTax: number;
  netAnnual: number;
  effectiveRate: number;
  stateCode: string | null;
  stateSupported: boolean;
}

/**
 * Estimate annual take-home after federal + state income tax + FICA.
 * Uses standard deduction. Not tax advice.
 */
export function estimateTakeHome(
  grossIncome: number,
  stateCode: string | null,
  filingStatus: FilingStatus = "single"
): TakeHomeResult {
  if (grossIncome <= 0) {
    return {
      grossAnnual: 0, federalTax: 0, stateTax: 0,
      fica: 0, totalTax: 0, netAnnual: 0, effectiveRate: 0,
      stateCode, stateSupported: false,
    };
  }

  const deduction     = STANDARD_DEDUCTION[filingStatus];
  const taxableIncome = Math.max(grossIncome - deduction, 0);

  const brackets = filingStatus === "single"
    ? FEDERAL_BRACKETS_SINGLE
    : FEDERAL_BRACKETS_MARRIED;

  const federalTax = applyBrackets(taxableIncome, brackets);

  // FICA: Social Security (6.2% up to $176,100 wage base 2026) + Medicare (1.45% + 0.9% over $200k)
  const ssCap        = 176_100;
  const ssTax        = Math.min(grossIncome, ssCap) * 0.062;
  const medicareTax  = grossIncome * 0.0145;
  const additionalMC = grossIncome > 200_000 ? (grossIncome - 200_000) * 0.009 : 0;
  const fica         = ssTax + medicareTax + additionalMC;

  const upperCode      = stateCode?.toUpperCase() ?? "";
  const stateRate      = STATE_RATES[upperCode] ?? null;
  const stateSupported = stateRate !== null;
  // Apply state rate to taxable income (after federal standard deduction) to avoid
  // overstating state tax — most states mirror the federal standard deduction structure.
  const stateTax       = stateSupported ? taxableIncome * stateRate : 0;

  const totalTax   = federalTax + fica + stateTax;
  const netAnnual  = grossIncome - totalTax;
  const effectiveRate = totalTax / grossIncome;

  return {
    grossAnnual: grossIncome,
    federalTax: Math.round(federalTax),
    stateTax: Math.round(stateTax),
    fica: Math.round(fica),
    totalTax: Math.round(totalTax),
    netAnnual: Math.round(netAnnual),
    effectiveRate,
    stateCode: upperCode || null,
    stateSupported,
  };
}

export const SUPPORTED_STATES = Object.keys(STATE_RATES).filter((k) => STATE_RATES[k] !== undefined);
