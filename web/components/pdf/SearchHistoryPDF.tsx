import {
  Document, Page, Text, View, StyleSheet, Svg, Rect, Line, G,
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
const ORANGE     = "#ea580c";

const s = StyleSheet.create({
  page:        { fontFamily: "Helvetica", backgroundColor: PARCHMENT, padding: 40, fontSize: 9, color: WARM_GREY },
  coverPage:   { fontFamily: "Helvetica", backgroundColor: TERRACOTTA, padding: 60, flex: 1, justifyContent: "center" },
  coverBrand:  { fontSize: 32, fontFamily: "Helvetica-Bold", color: PARCHMENT, marginBottom: 8 },
  coverTitle:  { fontSize: 18, color: `${PARCHMENT}cc`, marginBottom: 40 },
  coverStat:   { fontSize: 14, fontFamily: "Helvetica-Bold", color: PARCHMENT },
  coverStatLbl:{ fontSize: 9, color: `${PARCHMENT}99`, marginBottom: 4 },
  coverMeta:   { fontSize: 9, color: `${PARCHMENT}80`, marginTop: 40 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, paddingBottom: 10, borderBottom: `1.5px solid ${BORDER}` },
  brand:       { fontSize: 14, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  headerSub:   { fontSize: 7, color: MUTED, textAlign: "right", lineHeight: 1.5 },
  sectionTitle:{ fontSize: 11, fontFamily: "Helvetica-Bold", color: WARM_GREY, marginBottom: 10, marginTop: 18 },
  statsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  statBox:     { width: "30%", borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: LIGHT_BG, padding: 10 },
  statLabel:   { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue:   { fontSize: 18, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  statSub:     { fontSize: 7, color: MUTED, marginTop: 3 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  insightBox:  { width: "30%", borderRadius: 6, border: `1px solid ${BORDER}`, padding: 8 },
  insightLbl:  { fontSize: 6, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  insightVal:  { fontSize: 14, fontFamily: "Helvetica-Bold", color: TERRACOTTA },
  insightSub:  { fontSize: 6.5, color: MUTED, marginTop: 3, lineHeight: 1.4 },
  funnelRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  funnelLbl:   { width: 88, fontSize: 8, color: MUTED, textAlign: "right" },
  funnelCnt:   { width: 20, fontSize: 8, fontFamily: "Helvetica-Bold", color: WARM_GREY, textAlign: "right" },
  tableHead:   { flexDirection: "row", backgroundColor: TERRACOTTA, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 2 },
  tableHeadTx: { fontSize: 7, fontFamily: "Helvetica-Bold", color: PARCHMENT },
  tableRow:    { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderBottom: `0.5px solid ${BORDER}` },
  tableRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderBottom: `0.5px solid ${BORDER}`, backgroundColor: `${LIGHT_BG}80` },
  tableTx:     { fontSize: 7.5, color: WARM_GREY },
  footer:      { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

const STAGE_COLOURS_HEX = [AMBER, ORANGE, TERRACOTTA, EMERALD, "#047857"];
const BENCHMARKS_CONV: Record<string, number> = {
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

const STATUS_COLOUR: Record<string, string> = {
  Applied:        AMBER,
  "Phone Screen": ORANGE,
  Interview:      TERRACOTTA,
  Offer:          EMERALD,
  Accepted:       "#047857",
  Rejected:       "#dc2626",
  Withdrawn:      MUTED,
  Ghosted:        MUTED,
};

interface AppRow {
  company: string;
  position: string;
  status: string;
  applied_date: string;
  source: string | null;
}

interface Props {
  analytics: DashboardAnalytics;
  applications: AppRow[];
  generatedAt: string;
  userName?: string;
  userEmail?: string;
}

function Header({ generatedAt, userEmail }: { generatedAt: string; userEmail?: string }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.brand}>Jobnest · Job Search Report</Text>
      <View style={s.headerSub}>
        <Text>{generatedAt}</Text>
        {userEmail && <Text>{userEmail}</Text>}
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>Jobnest · Confidential · Job Search Report</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function SearchHistoryPDF({ analytics, applications, generatedAt, userName, userEmail }: Props) {
  const {
    totalApplications, thisWeek, thisMonth, responseRate,
    averageTimeToResponse, interviewToOfferRate, ghostRate,
    activePipeline, weeklyMomentum, topSource,
    stageFunnel, monthlyTrends, sourceEffectiveness, weeklyTrends,
  } = analytics;

  // Date range from first to last application
  const sortedDates = applications
    .map((a) => a.applied_date)
    .filter(Boolean)
    .sort();
  const firstDate = sortedDates[0] ?? "";
  const lastDate  = sortedDates[sortedDates.length - 1] ?? "";

  // Monthly trend chart (last 12 months)
  const chartMonths = monthlyTrends.slice(-12);
  const maxMonth = Math.max(...chartMonths.map((m) => m.count), 1);
  const CHART_W = 480;
  const CHART_H = 70;
  const monthBarW = Math.floor((CHART_W - 2 * (chartMonths.length - 1)) / chartMonths.length);

  // Weekly chart (last 12 weeks)
  const chartWeeks = weeklyTrends.slice(-12);
  const maxWeek = Math.max(...chartWeeks.map((w) => w.count), 1);
  const WK_W = 480;
  const WK_H = 50;
  const wkBarW = Math.floor((WK_W - 2 * (chartWeeks.length - 1)) / chartWeeks.length);

  // Application log (cap at 100)
  const appLog = applications.slice(0, 100);
  const truncated = applications.length > 100;

  return (
    <Document>
      {/* ── Page 1: Cover ── */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverBrand}>Jobnest</Text>
        <Text style={s.coverTitle}>Job Search Report</Text>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={s.coverStatLbl}>Total Applications</Text>
            <Text style={s.coverStat}>{totalApplications}</Text>
          </View>
          <View>
            <Text style={s.coverStatLbl}>Date Range</Text>
            <Text style={s.coverStat}>{firstDate || "—"} → {lastDate || "—"}</Text>
          </View>
          <View>
            <Text style={s.coverStatLbl}>Response Rate</Text>
            <Text style={s.coverStat}>{responseRate}%</Text>
          </View>
        </View>

        {userName && (
          <Text style={s.coverMeta}>Prepared for {userName} · {generatedAt}</Text>
        )}
      </Page>

      {/* ── Page 2: Search Intelligence ── */}
      <Page size="A4" style={s.page}>
        <Header generatedAt={generatedAt} userEmail={userEmail} />

        <Text style={s.sectionTitle}>Search Intelligence</Text>
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Total Applications</Text>
            <Text style={s.statValue}>{totalApplications}</Text>
            <Text style={s.statSub}>All time</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>This Week</Text>
            <Text style={s.statValue}>{thisWeek}</Text>
            <Text style={s.statSub}>vs {thisMonth} this month</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Response Rate</Text>
            <Text style={[s.statValue, { color: responseRate >= 20 ? EMERALD : AMBER }]}>{responseRate}%</Text>
            <Text style={s.statSub}>Industry avg ~18%</Text>
          </View>
        </View>

        <View style={s.insightGrid}>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Avg. Response Time</Text>
            <Text style={[s.insightVal, { color: averageTimeToResponse != null && averageTimeToResponse <= 14 ? EMERALD : AMBER }]}>
              {averageTimeToResponse != null ? `${averageTimeToResponse}d` : "—"}
            </Text>
            <Text style={s.insightSub}>Days from apply to first response</Text>
          </View>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Interview → Offer</Text>
            <Text style={[s.insightVal, { color: interviewToOfferRate != null && interviewToOfferRate >= 30 ? EMERALD : AMBER }]}>
              {interviewToOfferRate != null ? `${interviewToOfferRate}%` : "—"}
            </Text>
            <Text style={s.insightSub}>Conversion rate from interview stage</Text>
          </View>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Ghosting Rate</Text>
            <Text style={[s.insightVal, { color: ghostRate != null && ghostRate <= 25 ? WARM_GREY : "#dc2626" }]}>
              {ghostRate != null ? `${ghostRate}%` : "—"}
            </Text>
            <Text style={s.insightSub}>Applications with no response ≥30 days</Text>
          </View>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Active Pipeline</Text>
            <Text style={[s.insightVal, { color: activePipeline >= 4 ? EMERALD : TERRACOTTA }]}>
              {String(activePipeline).padStart(2, "0")}
            </Text>
            <Text style={s.insightSub}>Phone Screen + Interview stage</Text>
          </View>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Weekly Momentum</Text>
            <Text style={[s.insightVal, { color: weeklyMomentum != null && weeklyMomentum > 0 ? EMERALD : AMBER }]}>
              {weeklyMomentum != null ? (weeklyMomentum > 0 ? `+${weeklyMomentum}%` : `${weeklyMomentum}%`) : "—"}
            </Text>
            <Text style={s.insightSub}>vs. 4-week trailing average</Text>
          </View>
          <View style={s.insightBox}>
            <Text style={s.insightLbl}>Best Source</Text>
            <Text style={[s.insightVal, { fontSize: 11, color: EMERALD }]}>
              {topSource?.source ?? "—"}
            </Text>
            <Text style={s.insightSub}>
              {topSource ? `${topSource.responseRate}% response rate` : "Need data from ≥2 sources"}
            </Text>
          </View>
        </View>

        {/* Monthly trend chart */}
        <Text style={s.sectionTitle}>Monthly Application Volume (last 12 months)</Text>
        <Svg width={CHART_W} height={CHART_H + 20}>
          <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} strokeWidth={0.5} stroke={BORDER} />
          {chartMonths.map((m, i) => {
            const bH = maxMonth > 0 ? Math.max((m.count / maxMonth) * CHART_H, m.count > 0 ? 3 : 0) : 0;
            const x = i * (monthBarW + 2);
            return (
              <G key={m.month}>
                <Rect x={x} y={CHART_H - bH} width={monthBarW} height={bH} rx={2} fill={AMBER} opacity={0.8} />
                {m.rejections > 0 && (
                  <Rect x={x} y={CHART_H - Math.max((m.rejections / maxMonth) * CHART_H, 2)} width={monthBarW} height={Math.max((m.rejections / maxMonth) * CHART_H, 2)} rx={1} fill="#dc2626" opacity={0.6} />
                )}
                {m.offers > 0 && (
                  <Rect x={x} y={CHART_H - Math.max((m.offers / maxMonth) * CHART_H, 2)} width={monthBarW} height={Math.max((m.offers / maxMonth) * CHART_H, 2)} rx={1} fill={EMERALD} />
                )}
              </G>
            );
          })}
          {/* X labels: first and last */}
          {chartMonths.length > 0 && (
            <>
              <Text x={0} y={CHART_H + 12} style={{ fontSize: 6, fill: MUTED }}>{chartMonths[0]!.month}</Text>
              <Text x={CHART_W - 24} y={CHART_H + 12} style={{ fontSize: 6, fill: TERRACOTTA }}>{chartMonths[chartMonths.length - 1]!.month}</Text>
            </>
          )}
        </Svg>
        {/* Legend */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 6, marginBottom: 4 }}>
          {[["Applied", AMBER], ["Rejected", "#dc2626"], ["Offers", EMERALD]].map(([lbl, col]) => (
            <View key={lbl} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Svg width={8} height={8}><Rect x={0} y={0} width={8} height={8} rx={1} fill={col} /></Svg>
              <Text style={{ fontSize: 7, color: MUTED }}>{lbl}</Text>
            </View>
          ))}
        </View>

        <Footer />
      </Page>

      {/* ── Page 3: Funnel + Source ── */}
      <Page size="A4" style={s.page}>
        <Header generatedAt={generatedAt} userEmail={userEmail} />

        {/* Funnel */}
        <Text style={s.sectionTitle}>Application Funnel</Text>
        <View style={{ gap: 0, marginBottom: 16 }}>
          {stageFunnel.map((item, i) => {
            const top = stageFunnel[0]?.count ?? 1;
            const barPct = top > 0 ? Math.max(Math.round((item.count / top) * 100), item.count > 0 ? 4 : 0) : 0;
            const barW_f = Math.round((barPct / 100) * 340);
            const nextCount = stageFunnel[i + 1]?.count ?? null;
            const convRate = nextCount != null && item.count > 0 ? Math.round((nextCount / item.count) * 100) : null;
            const bLabel = TRANSITION_LABELS[i];
            const bench = bLabel ? BENCHMARKS_CONV[bLabel] : null;

            return (
              <View key={item.stage}>
                <View style={s.funnelRow}>
                  <Text style={s.funnelLbl}>{item.stage}</Text>
                  <Svg width={340} height={16}>
                    <Rect x={0} y={0} width={340} height={16} rx={3} fill={`${BORDER}50`} />
                    <Rect x={0} y={0} width={barW_f} height={16} rx={3} fill={STAGE_COLOURS_HEX[i] ?? STAGE_COLOURS_HEX[4]} />
                  </Svg>
                  <Text style={s.funnelCnt}>{item.count}</Text>
                </View>
                {convRate !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2, paddingLeft: 94 }}>
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

        {/* Source effectiveness */}
        {sourceEffectiveness.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Source Effectiveness</Text>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadTx, { flex: 2 }]}>Source</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Applied</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Responded</Text>
              <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Rate</Text>
            </View>
            {sourceEffectiveness.map((src, idx) => (
              <View key={src.source} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
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

        {/* 12-week velocity */}
        {chartWeeks.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>12-Week Application Velocity</Text>
            <Svg width={WK_W} height={WK_H + 16}>
              <Line x1={0} y1={WK_H} x2={WK_W} y2={WK_H} strokeWidth={0.5} stroke={BORDER} />
              {chartWeeks.map((w, i) => {
                const bH = maxWeek > 0 ? Math.max((w.count / maxWeek) * WK_H, w.count > 0 ? 3 : 0) : 0;
                const x = i * (wkBarW + 2);
                return (
                  <Rect key={w.week} x={x} y={WK_H - bH} width={wkBarW} height={bH} rx={1}
                    fill={i === chartWeeks.length - 1 ? TERRACOTTA : BORDER} />
                );
              })}
              <Text x={0} y={WK_H + 12} style={{ fontSize: 6, fill: MUTED }}>{chartWeeks[0]?.week}</Text>
              <Text x={WK_W - 28} y={WK_H + 12} style={{ fontSize: 6, fill: TERRACOTTA }}>{chartWeeks[chartWeeks.length - 1]?.week}</Text>
            </Svg>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── Page 4+: Application Log ── */}
      <Page size="A4" style={s.page}>
        <Header generatedAt={generatedAt} userEmail={userEmail} />

        <Text style={s.sectionTitle}>
          Application Log {truncated ? `(first 100 of ${applications.length})` : `(${applications.length} total)`}
        </Text>

        <View style={s.tableHead}>
          <Text style={[s.tableHeadTx, { flex: 2 }]}>Company</Text>
          <Text style={[s.tableHeadTx, { flex: 2 }]}>Position</Text>
          <Text style={[s.tableHeadTx, { flex: 1 }]}>Status</Text>
          <Text style={[s.tableHeadTx, { flex: 1, textAlign: "right" }]}>Applied</Text>
        </View>
        {appLog.map((app, idx) => (
          <View key={`${app.company}-${idx}`} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={[s.tableTx, { flex: 2 }]}>{app.company.slice(0, 30)}</Text>
            <Text style={[s.tableTx, { flex: 2 }]}>{app.position.slice(0, 30)}</Text>
            <Text style={[s.tableTx, { flex: 1, color: STATUS_COLOUR[app.status] ?? WARM_GREY }]}>
              {app.status}
            </Text>
            <Text style={[s.tableTx, { flex: 1, textAlign: "right" }]}>{app.applied_date}</Text>
          </View>
        ))}

        {truncated && (
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 8, fontStyle: "italic" }}>
            Showing first 100 of {applications.length} applications. Export as CSV for the complete list.
          </Text>
        )}

        <Footer />
      </Page>
    </Document>
  );
}
