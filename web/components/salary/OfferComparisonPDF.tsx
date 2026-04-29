import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import type { SalaryDetails } from "@/types";
import { computeFullTC, computeEffectiveHourlyRate } from "@/lib/utils/salary-helpers";
import { estimateTakeHome } from "@/lib/utils/tax-estimator";

const TERRACOTTA = "#99462a";
const PARCHMENT  = "#faf9f7";
const WARM_GREY  = "#55433d";
const BORDER     = "#dbc1b9";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: PARCHMENT,
    padding: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: `1.5px solid ${BORDER}`,
  },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  headerRight: { fontSize: 8, color: WARM_GREY, textAlign: "right" },
  confidential: { fontSize: 7, color: TERRACOTTA, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: WARM_GREY, marginBottom: 16 },
  offersRow: { flexDirection: "row", gap: 12 },
  offerCard: {
    flex: 1,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    overflow: "hidden",
  },
  offerHeader: {
    backgroundColor: TERRACOTTA,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerCompany: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PARCHMENT },
  offerPosition: { fontSize: 8, color: PARCHMENT, opacity: 0.85, marginTop: 1 },
  tcBig: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottom: `1px solid ${BORDER}`,
    backgroundColor: "#f4f3f1",
  },
  tcLabel: { fontSize: 7, color: WARM_GREY, textTransform: "uppercase", letterSpacing: 0.5 },
  tcAmount: { fontSize: 18, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginTop: 2 },
  rows: { paddingHorizontal: 12, paddingBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottom: `0.5px solid ${BORDER}`,
  },
  rowLast: { borderBottom: "none" },
  rowLabel: { fontSize: 8, color: WARM_GREY },
  rowValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1a1c1b" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginTop: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  footer: {
    marginTop: 28,
    paddingTop: 10,
    borderTop: `0.5px solid ${BORDER}`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 6, color: WARM_GREY },
});

function fmt(n: number, currency = "USD"): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

interface OfferRow {
  salary: SalaryDetails;
  company: string;
  position: string;
}

interface OfferComparisonPDFProps {
  offers: OfferRow[];
  generatedAt: string;
}

export function OfferComparisonPDF({ offers, generatedAt }: OfferComparisonPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Jobnest</Text>
          <View>
            <Text style={styles.headerRight}>Offer Comparison Report — {generatedAt}</Text>
            <Text style={styles.confidential}>Confidential</Text>
          </View>
        </View>

        <Text style={styles.title}>Offer Comparison</Text>

        {/* Offer columns */}
        <View style={styles.offersRow}>
          {offers.map(({ salary, company, position }) => {
            const tc = computeFullTC(salary);
            const takeHome = salary.state_of_work
              ? estimateTakeHome(tc.total, salary.state_of_work, "single")
              : null;
            const hourlyRate = computeEffectiveHourlyRate(tc.total, salary.annual_hours_worked ?? 2080, salary.pto_days);
            const cur = salary.currency ?? "USD";

            return (
              <View key={salary.id} style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <Text style={styles.offerCompany}>{company}</Text>
                  <Text style={styles.offerPosition}>{position}</Text>
                </View>

                <View style={styles.tcBig}>
                  <Text style={styles.tcLabel}>Total Compensation</Text>
                  <Text style={styles.tcAmount}>{fmt(tc.total, cur)}</Text>
                </View>

                <View style={styles.rows}>
                  <Text style={styles.sectionTitle}>TC Breakdown</Text>
                  {[
                    { label: "Base Salary",     value: fmt(tc.base, cur) },
                    { label: "Annual Bonus",     value: fmt(tc.bonus, cur) },
                    { label: "Signing Bonus",    value: fmt(tc.signing, cur) },
                    { label: "Equity (Yr 1)",    value: fmt(tc.equityAnnual, cur) },
                    { label: "401(k) Match",     value: fmt(tc.match401k, cur) },
                    { label: "Benefits Value",   value: fmt(tc.benefits, cur) },
                  ].map(({ label, value }, i, arr) => (
                    <View key={label} style={[styles.row, i === arr.length - 1 ? styles.rowLast : {}]}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowValue}>{value}</Text>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>Analysis</Text>
                  {[
                    { label: "Est. Take-Home/yr", value: takeHome ? fmt(takeHome.netAnnual, cur) : "—" },
                    { label: "Effective Rate",     value: takeHome ? `${(takeHome.effectiveRate * 100).toFixed(1)}%` : "—" },
                    { label: "Eff. Hourly Rate",   value: hourlyRate ? `${fmt(hourlyRate, cur)}/hr` : "—" },
                    { label: "PTO Days",           value: salary.pto_days ? `${salary.pto_days} days` : "—" },
                    { label: "Remote Work",        value: salary.remote_work ?? "—" },
                    { label: "State of Work",      value: salary.state_of_work ?? "—" },
                  ].map(({ label, value }, i, arr) => (
                    <View key={label} style={[styles.row, i === arr.length - 1 ? styles.rowLast : {}]}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Jobnest · jobnest.app</Text>
          <Text style={styles.footerText}>
            Tax estimates are approximations only. Consult a tax professional for accurate figures.
            Equity values based on current price at time of generation.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
