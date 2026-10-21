import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { usePalette } from "./src/ui";

const TABS = [
  { key: "today", label: "오늘" },
  { key: "settings", label: "동기화·설정" },
] as const;

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = usePalette();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ flexDirection: "row", marginHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: tab === t.key ? c.accent : c.surface }}
          >
            <Text style={{ color: tab === t.key ? "#fff" : c.fg, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "today" ? <TodayScreen /> : <SettingsScreen />}
    </View>
  );
}
