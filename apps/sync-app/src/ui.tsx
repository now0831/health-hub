import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

export const colors = {
  light: { bg: "#f7f8fa", surface: "#ffffff", fg: "#171717", muted: "#6b7280", line: "#e5e7eb", accent: "#0f766e" },
  dark: { bg: "#0b0d10", surface: "#14171c", fg: "#ededed", muted: "#9ca3af", line: "#262a31", accent: "#0d9488" },
};

export type Palette = (typeof colors)["light"];

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? colors.dark : colors.light;
}

/** 웹과 같은 상태 색 (항상 라벨과 함께 표시) */
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };

export function scoreColor(score: number) {
  if (score >= 75) return STATUS.good;
  if (score >= 50) return STATUS.warning;
  if (score >= 25) return STATUS.serious;
  return STATUS.critical;
}

export function Section({ title, c, children }: { title: string; c: Palette; children: ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.sectionTitle, { color: c.fg }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Button(props: { label: string; c: Palette; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { label, c, onPress, disabled, secondary } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary ? { borderWidth: 1, borderColor: c.line } : { backgroundColor: c.accent },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={{ color: secondary ? c.fg : "#fff", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  sub: { fontSize: 14 },
  warn: { color: "#dc2626", fontSize: 14 },
  section: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  message: { fontSize: 14, textAlign: "center" },
});
