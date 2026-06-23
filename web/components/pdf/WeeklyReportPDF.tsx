import {
  Document, Page, Text, View, StyleSheet, Svg, Rect, Line,
} from "@react-pdf/renderer";
import type { DashboardAnalytics } from "@/types";

const TERRACOTTA = "#99462a";
const PARCHMENT  = "#faf9f7";
const WARM_GREY  = "#55433d";
const BORDER     = "#dbc1b9";
const LIGHT_BG   = "#f4f3f1";
const MUTED      = "#88726c";
const EMERALD    = "#059669";
const AMBER      = "#d97706";

const s = StyleSheet.create({
  page:       { fontFamily: "Helvetica", backgroundColor: PARCHMENT, padding: 40, fontSize: 9, color: WARM_GREY },
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, paddingBottom: 10, borderBottom: `1.5px solid ${BORDER}` },
  brand:      { fontSize: 18, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  headerSub:  { fontSize: 7, color: MUTED, textAlign: "right", lineHeight: 1.5 },
  sectionTitle:{ fontSize: 10, fontFamily: "Helvetica-Bold", color: WARM_GREY, marginBottom: 8, marginTop: 16 },
  statsRow:   { flexDirection: "row", gap: 10, marginBottom: 16 },
  statBox:    { flex: 1, borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: LIGHT_BG, padding: 10 },
  statLabel:  { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue:  { fontSize: 20, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  statSub:    { fontSize: 7, color: MUTED, marginTop: 3 },
  funnelRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  funnelLabel:{ width: 90, fontSize: 8, color: MUTED, textAlign: "right" },
  funnelCount:{ width: 20, fontSize: 8, fontFamily: "Helvetica-Bold", color: WARM_GREY, textAlign: "right" },
  tableHead:  { flexDirection: "row", backgroundColor: TERRACOTTA, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 2 },
  tableHeadTx:{ fontSize: 7, fontFamily: "Helvetica-Bold", color: PARCHMENT },
  tableRow:   { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderBottom: `0.5px solid ${BORDER}` },
  tableTx:    { fontSize: 8, color: WARM_GREY },
  footer:     { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

const STAGE_COLOURS = [AMBER, "#f97316", TERRACOTTA, EMERALD, "#047857"];
const BENCHMARKS: Record<string, number> = {
  "Applied → Phone Screen":   18,
  "Phone Screen → Interview": 42,
  "Interview → Offer":        22,
  "Offer → Accepted":         88,
};
const TRANSITION_LABELS = [
  "Applied → Phone Screen",
  "Phone Screen → Interview",
  "Interview → Offer",
  "Offer → Accepted",
];

interface Props {
  analytics: DashboardAnalytics;
  goal: number;
  generatedAt: string;
  userEmail?: string;
}

export function WeeklyReportPDF({ analytics, goal, generatedAt, userEmail }: Props) {
  const {
    totalApplications, thisWeek, responseRate, activePipeline,
    weeklyTrends, stageFunnel, sourceEffectiveness,
  } = analytics;

  // Last 12 weeks for the velocity chart
  const chartWeeks = weeklyTrends.slice(-12);
  const maxWeek = Math.max(...chartWeeks.map((w) => w.count), 1);

  // Chart dimensions
  const CHART_W = 500;
  const CHART_H = 80;
  const BAR_GAP = 3;
  const barW = (CHART_W - BAR_GAP * (chartWeeks.length - 1)) / chartWeeks.length;

  // Goal progress
  const goalPct = Math.min((thisWeek / goal) * 100, 100);
  const goalColour = thisWeek >= goal ? EMERALD : TERRACOTTA;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Jobnest</Text>
            <Text style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>Weekly Cadence Report</Text>
          </View>
          <View style={s.headerSub}>
            <Text>{generatedAt}</Text>
            {userEmail && <Text>{userEmail}</Text>}
            <Text style={{ color: TERRACOTTA, fontSize: 7, letterSpacing: 0.5 }}>CONFIDENTIAL</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Total Applications</Text>
            <Text style={s.statValue}>{totalApplications}</Text>
            <Text style={s.statSub}>All time</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>This Week</Text>
            <Text style={[s.statValue, { color: goalColour }]}>{thisWeek}</Text>
            <Text style={s.statSub}>Goal: {goal} · {Math.round(goalPct)}% complete</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Response Rate</Text>
            <Text style={[s.statValue, { color: responseRate >= 20 ? EMERALD : AMBER }]}>{responseRate}%</Text>
            <Text style={s.statSub}>Industry avg ~18%</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Active Pipeline</Text>
            <Text style={[s.statValue, { color: activePipeline >= 4 ? EMERALD : TERRACOTTA }]}>
              {String(activePipeline).padStart(2, "0")}
            </Text>
            <Text style={s.statSub}>Phone Screen + Interview</Text>
          </View>
        </View>

        {/* Goal progress bar */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, color: MUTED, marginBottom: 5 }}>
            Weekly goal progress — {thisWeek} of {goal} applications
          </Text>
          <Svg width={CHART_W} height={8}>
            <Rect x="0" y="0" width={CHART_W} height={8} rx="4" fill={BORDER} />
            <Rect x="0" y="0" width={Math.round((goalPct / 100) * CHART_W)} height={8} rx="4" fill={goalColour} />
          </Svg>
        </View>

        {/* 12-week velocity chart */}
        <Text style={s.sectionTitle}>12-Week Application Velocity</Text>
        <Svg width={CHART_W} height={CHART_H + 20}>
          {/* Baseline */}
          <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} strokeWidth={0.5} stroke={BORDER} />
          {chartWeeks.map((w, i) => {
            const barH = maxWeek > 0 ? Math.max((w.count / maxWeek) * CHART_H, w.count > 0 ? 4 : 0) : 0;
            const x = i * (barW + BAR_GAP);
            const isLatest = i === chartWeeks.length - 1;
            return (
              <Rect
                key={w.week}
                x={x}
                y={CHART_H - barH}
                width={barW}
                height={barH}
                rx={2}
                fill={isLatest ? TERRACOTTA : BORDER}
              />
            );
          })}
          {/* X-axis labels: first and last */}
          <Text x={0} y={CHART_H + 12} style={{ fontSize: 6, fill: MUTED }}>{chartWeeks[0]?.week}</Text>
          <Text x={CHART_W - 30} y={CHART_H + 12} style={{ fontSize: 6, fill: TERRACOTTA }}>{chartWeeks[chartWeeks.length - 1]?.week}</Text>
        </Svg>

        {/* Stage funnel */}
        <Text style={s.sectionTitle}>Application Funnel</Text>
        <View style={{ gap: 0 }}>
          {stageFunnel.map((item, i) => {
            const top = stageFunnel[0]?.count ?? 1;
            const barPct = top > 0
              ? Math.max(Math.round((item.count / top) * 100), item.count > 0 ? 4 : 0)
              : 0;
            const nextCount = stageFunnel[i + 1]?.count ?? null;
            const convRate = nextCount != null && item.count > 0
              ? Math.round((nextCount / item.count) * 100)
              : null;
            const bLabel = TRANSITION_LABELS[i];
            const bench = bLabel ? BENCHMARKS[bLabel] : null;
            const barW_funnel = Math.round((barPct / 100) * 340);

            return (
              <View key={item.stage}>
                <View style={s.funnelRow}>
                  <Text style={s.funnelLabel}>{item.stage}</Text>
                  <Svg width={340} height={16}>
                    <Rect x={0} y={0} width={340} height={16} rx={3} fill={`${BORDER}50`} />
                    <Rect x={0} y={0} width={barW_funnel} height={16} rx={3} fill={STAGE_COLOURS[i] ?? STAGE_COLOURS[4]} />
                  </Svg>
                  <Text style={s.funnelCount}>{item.count}</Text>
                </View>
                {convRate !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2, paddingLeft: 96 }}>
                    <Text style={{ fontSize: 7, color: MUTED }}>↓</Text>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: convRate >= (bench ?? 0) ? EMERALD : AMBER }}>
                      {convRate}%
                    </Text>
                    {bench != null && (
                      <Text style={{ fontSize: 7, color: MUTED }}>· industry avg {bench}%</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Source breakdown */}
        {sourceEffectiveness.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Source Effectiveness</Text>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadTx, { flex: 2 }]}>Source</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Applied</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Responded</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Rate</Text>
            </View>
            {sourceEffectiveness.map((src) => (
              <View key={src.source} style={s.tableRow}>
                <Text style={[s.tableTx, { flex: 2 }]}>{src.source}</Text>
                <Text style={[s.tableTx, { flex: 1, textAlign: "right" }]}>{src.total}</Text>
                <Text style={[s.tableTx, { flex: 1, textAlign: "right" }]}>{src.responded}</Text>
                <Text style={[s.tableTx, { flex: 1, textAlign: "right", color: src.responseRate >= 20 ? EMERALD : WARM_GREY }]}>
                  {src.responseRate}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>Jobnest · Weekly Cadence Report · {generatedAt}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
