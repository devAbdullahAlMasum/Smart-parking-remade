import "./global.css";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "@gluestack-ui/config";
import { Box, Center, GluestackUIProvider, HStack, VStack } from "@gluestack-ui/themed";
import { expoClient } from "@better-auth/expo/client";
import * as Ably from "ably";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createAuthClient } from "better-auth/react";

const STORAGE_KEYS = {
  apiUrl: "smartParking.apiUrl",
  user: "smartParking.user",
};

const defaultForm = { name: "", phone: "", licenseNumber: "", vehicleNumber: "" };
const darkInput = "h-14 rounded-2xl border border-base-300 bg-base-300 px-4 text-[15px] font-semibold text-base-content";
const card = "rounded-3xl border border-base-300 bg-base-200 p-5";

function normalizeBaseUrl(url) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return "";

  const urlWithProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedUrl) ? trimmedUrl : `http://${trimmedUrl}`;
  return urlWithProtocol.replace(/\/+$/, "");
}

function formatAssignedTime(assignedAt) {
  return new Date(assignedAt).toLocaleTimeString();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function createNativeAuthClient(apiUrl) {
  return createAuthClient({
    baseURL: apiUrl,
    plugins: [
      expoClient({
        scheme: "smartparking",
        storagePrefix: "smart-parking",
        storage: SecureStore,
      }),
    ],
  });
}

export default function App() {
  return (
    <GluestackUIProvider config={config}>
      <AppContent />
    </GluestackUIProvider>
  );
}

function AppContent() {
  const [apiUrl, setApiUrl] = useState(null);

  useEffect(() => {
    (async () => {
      const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.apiUrl);
      const normalizedUrl = storedUrl ? normalizeBaseUrl(storedUrl) : "";
      if (storedUrl && normalizedUrl !== storedUrl) {
        await AsyncStorage.setItem(STORAGE_KEYS.apiUrl, normalizedUrl);
      }
      setApiUrl(normalizedUrl);
    })();
  }, []);

  if (apiUrl === null) {
    return <LoadingScreen />;
  }

  if (!apiUrl) {
    return <SetupScreen setApiUrl={setApiUrl} />;
  }

  return <Root apiUrl={apiUrl} setApiUrl={setApiUrl} />;
}

function LoadingScreen() {
  return (
    <Center className="flex-1 bg-base-100">
      <StatusBar style="light" />
      <ActivityIndicator color="#00cdb8" size="large" />
    </Center>
  );
}

function Screen({ children, withTabs = false }) {
  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <StatusBar style="light" />
      <ScrollView
        className="bg-base-100"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? 34 : 20,
          paddingBottom: withTabs ? 118 : 44,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="lg">{children}</VStack>
      </ScrollView>
    </SafeAreaView>
  );
}

function Eyebrow({ children }) {
  return <Text className="text-xs font-black uppercase text-accent">{children}</Text>;
}

function TitleBlock({ eyebrow, title, subtitle }) {
  return (
    <VStack space="xs">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text className="text-4xl font-black text-white">{title}</Text>
      <Text className="text-base font-semibold leading-6 text-base-content">{subtitle}</Text>
    </VStack>
  );
}

function Field(props) {
  return <TextInput {...props} className={darkInput} placeholderTextColor="#6f7886" />;
}

function PrimaryButton({ children, onPress, disabled, accent = false, danger = false }) {
  const tone = danger ? "bg-error" : accent ? "bg-accent" : "bg-primary";
  const textTone = danger ? "text-white" : accent ? "text-accent-content" : "text-primary-content";

  return (
    <TouchableOpacity
      className={`h-14 items-center justify-center rounded-2xl ${tone} px-5 ${disabled ? "opacity-60" : ""}`}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text className={`text-base font-black ${textTone}`}>{children}</Text>
    </TouchableOpacity>
  );
}

function NeutralButton({ children, onPress, danger = false }) {
  return (
    <TouchableOpacity
      className={`min-h-14 justify-center rounded-2xl border px-4 py-4 ${
        danger ? "border-error bg-error/10" : "border-base-300 bg-neutral"
      }`}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text className={`text-center text-[15px] font-black ${danger ? "text-error" : "text-neutral-content"}`}>{children}</Text>
    </TouchableOpacity>
  );
}

function TextLink({ children, onPress }) {
  return (
    <TouchableOpacity className="min-h-14 items-center justify-center px-3" onPress={onPress} activeOpacity={0.82}>
      <Text className="text-center text-sm font-extrabold text-accent">{children}</Text>
    </TouchableOpacity>
  );
}

function SetupScreen({ setApiUrl }) {
  const [input, setInput] = useState("");

  async function saveUrl() {
    const normalizedUrl = normalizeBaseUrl(input);
    if (!normalizedUrl) {
      Alert.alert("Missing URL", "Enter your app URL.");
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.apiUrl, normalizedUrl);
    setApiUrl(normalizedUrl);
  }

  return (
    <Screen>
      <TitleBlock
        eyebrow="Smart Parking BD"
        title="Connect your garage"
        subtitle="Add the backend URL once, then manage gate access and parking sessions from this device."
      />

      <VStack className={card} space="md">
        <Field
          value={input}
          onChangeText={setInput}
          placeholder="https://your-worker.your-subdomain.workers.dev"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text className="text-sm font-semibold leading-5 text-base-content">
          Realtime parking status, QR entry, and security actions are synced through the fullstack backend.
        </Text>
        <PrimaryButton onPress={saveUrl}>Save URL</PrimaryButton>
      </VStack>
    </Screen>
  );
}

function Root({ apiUrl, setApiUrl }) {
  const authClient = useMemo(() => createNativeAuthClient(apiUrl), [apiUrl]);
  const [session, setSession] = useState(null);
  const [savedUser, setSavedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const authSession = await authClient.getSession();
      setSession(authSession.data ?? null);

      const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
      if (raw) {
        try {
          setSavedUser(JSON.parse(raw));
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEYS.user);
        }
      }
      setLoading(false);
    })();
  }, [authClient]);

  if (loading) return <LoadingScreen />;

  if (!session) {
    return <AuthScreen authClient={authClient} setSession={setSession} setApiUrl={setApiUrl} />;
  }

  if (!savedUser) {
    return <ProfileScreen setSavedUser={setSavedUser} apiUrl={apiUrl} setApiUrl={setApiUrl} authUser={session.user} />;
  }

  return (
    <Dashboard
      user={savedUser}
      setSavedUser={setSavedUser}
      authClient={authClient}
      setSession={setSession}
      apiUrl={apiUrl}
      setApiUrl={setApiUrl}
    />
  );
}

function AuthScreen({ authClient, setSession, setApiUrl }) {
  const [mode, setMode] = useState("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }

    if (mode === "sign-up" && !name.trim()) {
      Alert.alert("Missing info", "Enter your name.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });

      if (result.error) {
        throw new Error(result.error.message || "Authentication failed");
      }

      const authSession = await authClient.getSession();
      setSession(authSession.data ?? null);
    } catch (error) {
      Alert.alert(mode === "sign-up" ? "Sign-up failed" : "Sign-in failed", error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <TitleBlock
        eyebrow={mode === "sign-up" ? "New rider profile" : "Welcome back"}
        title={mode === "sign-up" ? "Create account" : "Sign in"}
        subtitle="Use your Smart Parking account for fast QR entry, gate alerts, and vehicle security."
      />

      <HStack className="rounded-2xl border border-base-300 bg-base-200 p-1" space="xs">
        <TouchableOpacity
          className={`h-12 flex-1 items-center justify-center rounded-xl ${mode === "sign-in" ? "bg-primary" : "bg-transparent"}`}
          onPress={() => setMode("sign-in")}
        >
          <Text className={`font-black ${mode === "sign-in" ? "text-primary-content" : "text-base-content"}`}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`h-12 flex-1 items-center justify-center rounded-xl ${mode === "sign-up" ? "bg-primary" : "bg-transparent"}`}
          onPress={() => setMode("sign-up")}
        >
          <Text className={`font-black ${mode === "sign-up" ? "text-primary-content" : "text-base-content"}`}>Sign up</Text>
        </TouchableOpacity>
      </HStack>

      <VStack className={card} space="md">
        {mode === "sign-up" ? <Field value={name} onChangeText={setName} placeholder="Full name" /> : null}
        <Field value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" />
        <PrimaryButton onPress={submit} disabled={submitting}>
          {submitting ? "Please wait..." : mode === "sign-up" ? "Create account" : "Sign in"}
        </PrimaryButton>
        <TextLink onPress={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}>
          {mode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </TextLink>
        <TextLink
          onPress={async () => {
            await AsyncStorage.removeItem(STORAGE_KEYS.apiUrl);
            setApiUrl("");
          }}
        >
          Change Backend URL
        </TextLink>
      </VStack>
    </Screen>
  );
}

function ProfileScreen({ setSavedUser, apiUrl, setApiUrl, authUser }) {
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [form, setForm] = useState({ ...defaultForm, name: authUser?.name || "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    const normalizedUrl = normalizeBaseUrl(urlInput);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      licenseNumber: form.licenseNumber.trim(),
      vehicleNumber: form.vehicleNumber.trim(),
    };

    if (!normalizedUrl) {
      Alert.alert("Missing URL", "Enter your app URL.");
      return;
    }

    if (Object.values(payload).some((value) => !value)) {
      Alert.alert("Missing info", "Fill in all fields before registering.");
      return;
    }

    setSaving(true);
    try {
      if (normalizedUrl !== apiUrl) {
        await AsyncStorage.setItem(STORAGE_KEYS.apiUrl, normalizedUrl);
        setApiUrl(normalizedUrl);
        Alert.alert("URL updated", "The app will use the new fullstack app URL now.");
        return;
      }

      const user = await requestJson(`${normalizedUrl}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      setSavedUser(user);
      Alert.alert("Saved", "Profile saved.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TitleBlock
        eyebrow="Vehicle onboarding"
        title="Set up access"
        subtitle="Register the driver and vehicle details used by the gate scanner and security desk."
      />

      <VStack className={card} space="md">
        <Field value={urlInput} onChangeText={setUrlInput} placeholder="https://your-worker.your-subdomain.workers.dev" autoCapitalize="none" autoCorrect={false} />
        <Text className="text-sm font-semibold leading-5 text-base-content">Realtime updates come from Ably through the fullstack app.</Text>
        <Field value={form.name} onChangeText={(value) => setForm({ ...form, name: value })} placeholder="Full name" />
        <Field value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} placeholder="Phone number" keyboardType="phone-pad" />
        <Field value={form.licenseNumber} onChangeText={(value) => setForm({ ...form, licenseNumber: value })} placeholder="License number" />
        <Field value={form.vehicleNumber} onChangeText={(value) => setForm({ ...form, vehicleNumber: value })} placeholder="Vehicle plate" />
        <PrimaryButton onPress={save} disabled={saving} accent>
          {saving ? "Registering..." : "Register Vehicle"}
        </PrimaryButton>
      </VStack>
    </Screen>
  );
}

function Dashboard({ user, setSavedUser, authClient, setSession, apiUrl, setApiUrl }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");
  const [, requestCameraPermission] = useCameraPermissions();
  const [alertedFor, setAlertedFor] = useState(new Set());
  const [statusData, setStatusData] = useState(undefined);

  useEffect(() => {
    let mounted = true;

    async function refreshStatus() {
      try {
        const data = await requestJson(`${apiUrl}/api/users/${user.id}/status`);
        if (mounted) setStatusData(data);
      } catch (error) {
        if (mounted) console.warn(error.message);
      }
    }

    refreshStatus();

    const client = new Ably.Realtime({
      authUrl: `${apiUrl}/api/realtime/token?clientId=user-${user.id}`,
      clientId: `user-${user.id}`,
    });
    const channel = client.channels.get("smart-parking");
    const handleRefresh = () => refreshStatus();

    channel.subscribe("refresh", handleRefresh).catch(console.error);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshStatus();
    });

    return () => {
      mounted = false;
      channel.unsubscribe("refresh", handleRefresh);
      client.close();
      subscription.remove();
    };
  }, [apiUrl, user.id]);

  const session = statusData?.session ?? null;
  const lockdown = statusData?.lockdown ?? false;

  useEffect(() => {
    if (session?.status === "departing" && !lockdown && !alertedFor.has(session.id)) {
      setAlertedFor((prev) => new Set(prev).add(session.id));
      Alert.alert("Car Unparked", "Your car has left the parking slot. Was this you?", [
        { text: "Yes, it was me" },
        {
          text: "It was not me!",
          style: "destructive",
          onPress: () => {
            Alert.alert("Lock down the gate?", "This will lock the gate and prevent the car from leaving.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Lock Down",
                style: "destructive",
                onPress: async () => {
                  try {
                    await requestJson(`${apiUrl}/api/security/lockdown`, { method: "POST" });
                    Alert.alert("Lockdown enabled", "The gate has been locked.");
                  } catch (err) {
                    Alert.alert("Lockdown failed", err.message);
                  }
                },
              },
            ]);
          },
        },
      ]);
    }

    if (session?.status === "parked") {
      setAlertedFor(new Set());
    }
  }, [alertedFor, apiUrl, lockdown, session?.id, session?.status]);

  if (scannerOpen) {
    return (
      <Scanner
        onClose={() => setScannerOpen(false)}
        onScan={async (event) => {
          setScannerOpen(false);
          try {
            const result = await requestJson(`${apiUrl}/api/check-in`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, locationCode: event?.data }),
            });
            Alert.alert("Success", `Park in ${result.assignedSlotCode}`);
          } catch (err) {
            Alert.alert("Check-in failed", err.message);
          }
        }}
      />
    );
  }

  if (lockdown) {
    return <LockdownScreen apiUrl={apiUrl} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <StatusBar style="light" />
      <ScrollView
        className="bg-base-100"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? 34 : 20,
          paddingBottom: 118,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "scan" ? (
          <DashboardHome user={user} session={session} statusData={statusData} requestCameraPermission={requestCameraPermission} setScannerOpen={setScannerOpen} />
        ) : (
          <AccountTab
            user={user}
            apiUrl={apiUrl}
            authClient={authClient}
            setApiUrl={setApiUrl}
            setSavedUser={setSavedUser}
            setSession={setSession}
          />
        )}
      </ScrollView>

      <HStack className="absolute bottom-6 left-5 right-5 rounded-3xl border border-base-300 bg-base-200 p-2" space="xs">
        <TabButton active={activeTab === "scan"} onPress={() => setActiveTab("scan")} label="Scan" />
        <TabButton active={activeTab === "account"} onPress={() => setActiveTab("account")} label="Account" />
      </HStack>
    </SafeAreaView>
  );
}

function DashboardHome({ user, session, statusData, requestCameraPermission, setScannerOpen }) {
  const parked = session?.status === "parked";
  const departing = session?.status === "departing";
  const statusTone = parked ? "text-success" : departing ? "text-warning" : session ? "text-info" : "text-base-content";

  return (
    <VStack space="lg">
      <HStack className="items-start justify-between" space="md">
        <VStack className="flex-1" space="xs">
          <Eyebrow>Dhaka garage access</Eyebrow>
          <Text className="text-3xl font-black text-white">Hi, {user.name}</Text>
          <Text className="text-base font-bold text-base-content">{user.vehicleNumber}</Text>
        </VStack>
        <TouchableOpacity
          className="h-16 w-16 items-center justify-center rounded-3xl bg-accent"
          onPress={async () => {
            if (!(await requestCameraPermission()).granted) return;
            setScannerOpen(true);
          }}
          activeOpacity={0.82}
        >
          <Text className="text-xs font-black text-accent-content">SCAN</Text>
        </TouchableOpacity>
      </HStack>

      <VStack className="rounded-3xl border border-base-300 bg-base-200 p-6" space="lg">
        <HStack className="items-center justify-between">
          <Text className="text-xs font-black uppercase text-base-content">Current Status</Text>
          <Box className={`rounded-full px-3 py-1 ${parked ? "bg-success/15" : departing ? "bg-warning/15" : "bg-info/15"}`}>
            <Text className={`text-xs font-black ${statusTone}`}>{session?.status ? session.status.toUpperCase() : "READY"}</Text>
          </Box>
        </HStack>

        {statusData === undefined ? (
          <ActivityIndicator color="#00cdb8" size="small" />
        ) : session ? (
          <VStack space="sm">
            <Text className={`text-3xl font-black leading-10 ${statusTone}`}>
              {session.status === "active" && `Gate open - drive to ${session.slotCode}`}
              {session.status === "parked" && `Parked in ${session.slotCode}`}
              {session.status === "departing" && `Leaving ${session.slotCode}...`}
              {session.status === "exited" && `Exited ${session.slotCode}`}
            </Text>
            <Text className="text-base font-semibold text-base-content">Since {formatAssignedTime(session.assignedAt)}</Text>
          </VStack>
        ) : (
          <VStack space="sm">
            <Text className="text-3xl font-black leading-10 text-white">Not parked anywhere.</Text>
            <Text className="text-base font-semibold text-base-content">Scan the gate QR to enter.</Text>
          </VStack>
        )}
      </VStack>

      <HStack className="gap-3">
        <Metric label="Vehicle" value="1" />
        <Metric label="Realtime" value="Live" accent />
        <Metric label="Gate" value="QR" />
      </HStack>

      <VStack className={card} space="md">
        <Text className="text-xl font-black text-white">Quick actions</Text>
        <HStack className="gap-3">
          <ActionTile label="Scan Entry" tone="primary" onPress={async () => {
            if (!(await requestCameraPermission()).granted) return;
            setScannerOpen(true);
          }} />
          <ActionTile label="Security Desk" tone="accent" onPress={() => Alert.alert("Security desk", "Contact the gate operator if you see unexpected movement.")} />
        </HStack>
      </VStack>
    </VStack>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <VStack className="flex-1 rounded-2xl border border-base-300 bg-base-200 p-4" space="xs">
      <Text className={`text-xl font-black ${accent ? "text-accent" : "text-white"}`}>{value}</Text>
      <Text className="text-xs font-bold text-base-content">{label}</Text>
    </VStack>
  );
}

function ActionTile({ label, tone, onPress }) {
  const tileTone = tone === "accent" ? "bg-accent" : "bg-primary";
  const textTone = tone === "accent" ? "text-accent-content" : "text-primary-content";

  return (
    <TouchableOpacity className={`min-h-20 flex-1 justify-center rounded-2xl ${tileTone} p-4`} onPress={onPress} activeOpacity={0.82}>
      <Text className={`text-base font-black ${textTone}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabButton({ active, onPress, label }) {
  return (
    <TouchableOpacity className={`h-14 flex-1 items-center justify-center rounded-2xl ${active ? "bg-primary" : "bg-transparent"}`} onPress={onPress}>
      <Text className={`text-sm font-black ${active ? "text-primary-content" : "text-base-content"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function AccountTab({ user, apiUrl, authClient, setApiUrl, setSavedUser, setSession }) {
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    await AsyncStorage.removeItem(STORAGE_KEYS.user);
    setSavedUser(null);
    setSession(null);
  }

  return (
    <VStack space="lg">
      <HStack className="rounded-3xl border border-base-300 bg-neutral p-5" space="md">
        <Center className="h-20 w-20 rounded-3xl bg-accent">
          <Text className="text-2xl font-black text-accent-content">{initials}</Text>
        </Center>
        <VStack className="flex-1 justify-center" space="xs">
          <Text className="text-2xl font-black text-white">{user.name}</Text>
          <Text className="text-sm font-bold text-neutral-content">@{user.vehicleNumber.replace(/\s+/g, "").toLowerCase()}</Text>
        </VStack>
      </HStack>

      <HStack className="gap-3">
        <Metric label="Vehicle" value="1" />
        <Metric label="Account" value="Live" accent />
        <Metric label="Access" value="QR" />
      </HStack>

      <VStack className={card} space="md">
        <InfoRow label="Phone" value={user.phone} />
        <InfoRow label="License" value={user.licenseNumber} />
        <InfoRow label="Vehicle" value={user.vehicleNumber} />
        <InfoRow label="Backend" value={apiUrl} small />
      </VStack>

      <VStack space="sm">
        <NeutralButton
          onPress={async () => {
            await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
            Alert.alert("Saved", "This account is saved on this device.");
          }}
        >
          Save Account
        </NeutralButton>
        <NeutralButton onPress={() => setSavedUser(null)}>Edit Profile</NeutralButton>
        <NeutralButton onPress={signOut}>Switch Account</NeutralButton>
        <NeutralButton
          onPress={async () => {
            await AsyncStorage.removeItem(STORAGE_KEYS.apiUrl);
            setApiUrl("");
          }}
        >
          Change Backend URL
        </NeutralButton>
        <NeutralButton danger onPress={signOut}>
          Logout
        </NeutralButton>
      </VStack>
    </VStack>
  );
}

function InfoRow({ label, value, small = false }) {
  return (
    <VStack className="border-b border-base-300 pb-3" space="xs">
      <Text className="text-xs font-black uppercase text-base-content">{label}</Text>
      <Text className={`${small ? "text-xs" : "text-lg"} font-extrabold text-white`}>{value}</Text>
    </VStack>
  );
}

function LockdownScreen({ apiUrl }) {
  return (
    <SafeAreaView className="flex-1 bg-error">
      <StatusBar style="light" />
      <Center className="flex-1 px-6">
        <VStack className="items-center" space="xl">
          <VStack className="items-center" space="sm">
            <Text className="text-center text-4xl font-black text-white">SECURITY LOCKDOWN</Text>
            <Text className="text-center text-lg font-bold text-white/80">The gate is locked.</Text>
          </VStack>
          <TouchableOpacity
            className="min-h-16 w-full items-center justify-center rounded-3xl bg-white px-5 py-5"
            onPress={async () => {
              try {
                await requestJson(`${apiUrl}/api/security/unlock`, { method: "POST" });
              } catch (err) {
                Alert.alert("Unlock failed", err.message);
              }
            }}
          >
            <Text className="text-center text-base font-black text-error">UNLOCK DOOR & OPEN GATE</Text>
          </TouchableOpacity>
        </VStack>
      </Center>
    </SafeAreaView>
  );
}

function Scanner({ onClose, onScan }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={onScan} />
      <TouchableOpacity className="absolute bottom-10 self-center rounded-full bg-base-200 px-8 py-4" onPress={onClose}>
        <Text className="text-base font-black text-white">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
