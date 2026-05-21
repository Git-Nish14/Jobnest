import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Props {
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 44,
    backgroundColor: "#fdfcfb",
    color: "#1a1c1b",
  },
  header: {
    marginBottom: 24,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e3e0",
  },
  appName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#99462a",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1c1b",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#55433d",
  },
  bubble: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
  userBubble: {
    backgroundColor: "#99462a",
    marginLeft: 60,
  },
  assistantBubble: {
    backgroundColor: "#f4f3f1",
    marginRight: 60,
  },
  roleLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  userLabel: { color: "#fde8e0" },
  assistantLabel: { color: "#99462a" },
  content: { lineHeight: 1.5, fontSize: 10 },
  userContent: { color: "#ffffff" },
  assistantContent: { color: "#1a1c1b" },
  time: { fontSize: 8, marginTop: 4 },
  userTime: { color: "#fde8e0", opacity: 0.7, textAlign: "right" },
  assistantTime: { color: "#55433d", opacity: 0.6 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    fontSize: 8,
    color: "#55433d",
    opacity: 0.5,
    textAlign: "center",
  },
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPDFDocument({ title, createdAt, messages }: Props) {
  return (
    <Document title={title} author="NESTAi · Jobnest">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.appName}>NESTAi · Jobnest</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.meta}>
            Started {formatDate(createdAt)} · {messages.length} message{messages.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[s.bubble, msg.role === "user" ? s.userBubble : s.assistantBubble]}
          >
            <Text style={[s.roleLabel, msg.role === "user" ? s.userLabel : s.assistantLabel]}>
              {msg.role === "user" ? "You" : "NESTAi"}
            </Text>
            <Text style={[s.content, msg.role === "user" ? s.userContent : s.assistantContent]}>
              {msg.content}
            </Text>
            <Text style={[s.time, msg.role === "user" ? s.userTime : s.assistantTime]}>
              {formatDate(msg.createdAt)}
            </Text>
          </View>
        ))}

        <Text style={s.footer} fixed>
          Exported from Jobnest · jobnest.nishpatel.dev
        </Text>
      </Page>
    </Document>
  );
}
