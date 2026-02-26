import { useState, useEffect, useRef, useCallback } from "react";

import {
  Button,
  TextInput,
  PasswordInput,
  Select,
  SelectItem,
  Tile,
  ClickableTile,
  Tag,
  ProgressBar,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ContentSwitcher,
  Switch,
  Loading,
  InlineNotification,
  Grid,
  Column,
  Theme,
  NumberInput,
  Checkbox,
  ProgressStep,
  ProgressIndicator,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  Layer,
  Section,
  Heading,
  FileUploader,
  FormGroup,
  Stack,
  Modal,
} from "@carbon/react";

import {
  Dashboard as DashboardIcon,
  Camera,
  UserAvatar,
  Logout,
  Restaurant,
  Edit,
  Checkmark,
  Close,
  Upload,
  Analytics,
  WarningAlt,
  CheckmarkFilled,
  InformationFilled,
  ChartBar,
  FitToScreen,
  Wheat,
  Scale,
  TrashCan,
} from "@carbon/react/icons";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

/* ────────────────────────────────────────────
   API Layer
   ──────────────────────────────────────────── */

const api = {
  token: localStorage.getItem("ns_token"),
  setToken(t) { this.token = t; localStorage.setItem("ns_token", t); },
  clear() { this.token = null; localStorage.removeItem("ns_token"); },
  async req(path, opts = {}) {
    const h = { ...(opts.headers || {}) };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    if (!(opts.body instanceof FormData)) h["Content-Type"] = "application/json";
    const r = await fetch(`${API}${path}`, { ...opts, headers: h });
    if (r.status === 401) { this.clear(); window.location.reload(); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Failed");
    return r.json();
  },
  get: (p) => api.req(p),
  post: (p, b) => api.req(p, { method: "POST", body: b instanceof FormData ? b : JSON.stringify(b) }),
  put: (p, b) => api.req(p, { method: "PUT", body: JSON.stringify(b) }),
  del: (p) => api.req(p, { method: "DELETE" }),
};

/* ────────────────────────────────────────────
   Risk Tag Component
   ──────────────────────────────────────────── */

function RiskTag({ level, label }) {
  const map = {
    low: "green",
    moderate: "magenta",
    high: "red",
    very_high: "red",
  };
  return <Tag type={map[level] || "gray"} size="sm">{label || level?.replace("_", " ")}</Tag>;
}

/* ────────────────────────────────────────────
   Auth Screen
   ──────────────────────────────────────────── */

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState(0); // 0 = login, 1 = register
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "", password: "", name: "", age: "", weight_kg: "", height_cm: "",
    gender: "male", activity_level: "moderate", health_goal: "maintain",
    dietary_preference: "non-veg", daily_calorie_target: "2000", health_conditions: [],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === 0) {
        const r = await api.post("/login", { email: form.email, password: form.password });
        api.setToken(r.token); onAuth();
      } else {
        const p = {
          ...form,
          age: parseInt(form.age) || null,
          weight_kg: parseFloat(form.weight_kg) || null,
          height_cm: parseFloat(form.height_cm) || null,
          daily_calorie_target: parseInt(form.daily_calorie_target) || 2000,
        };
        const r = await api.post("/register", p);
        api.setToken(r.token); onAuth();
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const conditions = ["Diabetes", "Pre-diabetes", "PCOS", "Thyroid", "Heart condition", "High BP", "High cholesterol"];

  return (
    <Theme theme="g10">
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f4f4f4" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Branding */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 8,
              background: "#0f62fe", color: "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 600, marginBottom: 16,
            }}>NS</div>
            <h1 style={{ fontSize: 28, fontWeight: 300, margin: "0 0 4px", color: "#161616" }}>NutriScan</h1>
            <p style={{ fontSize: 14, color: "#525252", margin: 0 }}>AI-powered nutrition tracking</p>
          </div>

          {/* Form */}
          <Tile style={{ padding: 32 }}>
            <ContentSwitcher onChange={({ index }) => { setMode(index); setStep(0); setError(""); }} selectedIndex={mode}
              style={{ marginBottom: 28 }}>
              <Switch name="login" text="Sign In" />
              <Switch name="register" text="Create Account" />
            </ContentSwitcher>

            {/* Login */}
            {mode === 0 && (
              <Stack gap={6}>
                <TextInput id="email" labelText="Email" placeholder="name@example.com"
                  value={form.email} onChange={e => set("email", e.target.value)} />
                <PasswordInput id="password" labelText="Password" placeholder="Enter password"
                  value={form.password} onChange={e => set("password", e.target.value)} />
                <Button onClick={submit} disabled={loading} style={{ width: "100%", maxWidth: "100%" }}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </Stack>
            )}

            {/* Register */}
            {mode === 1 && (
              <div>
                <ProgressIndicator currentIndex={step} style={{ marginBottom: 28 }}>
                  <ProgressStep label="Account" />
                  <ProgressStep label="Profile" />
                  <ProgressStep label="Goals" />
                </ProgressIndicator>

                {step === 0 && (
                  <Stack gap={6}>
                    <TextInput id="name" labelText="Full Name" placeholder="Your name"
                      value={form.name} onChange={e => set("name", e.target.value)} />
                    <TextInput id="reg-email" labelText="Email" placeholder="name@example.com"
                      value={form.email} onChange={e => set("email", e.target.value)} />
                    <PasswordInput id="reg-pass" labelText="Password" placeholder="Min 6 characters"
                      value={form.password} onChange={e => set("password", e.target.value)} />
                    <Button onClick={() => {
                      if (!form.name || !form.email || form.password.length < 6) { setError("Fill all fields (password min 6)"); return; }
                      setError(""); setStep(1);
                    }} style={{ width: "100%", maxWidth: "100%" }}>Continue</Button>
                  </Stack>
                )}

                {step === 1 && (
                  <Stack gap={6}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <TextInput id="age" labelText="Age" type="number" placeholder="30"
                        value={form.age} onChange={e => set("age", e.target.value)} style={{ flex: 1 }} />
                      <Select id="gender" labelText="Gender" value={form.gender}
                        onChange={e => set("gender", e.target.value)} style={{ flex: 1 }}>
                        <SelectItem value="male" text="Male" />
                        <SelectItem value="female" text="Female" />
                        <SelectItem value="other" text="Other" />
                      </Select>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <TextInput id="weight" labelText="Weight (kg)" type="number" placeholder="70"
                        value={form.weight_kg} onChange={e => set("weight_kg", e.target.value)} style={{ flex: 1 }} />
                      <TextInput id="height" labelText="Height (cm)" type="number" placeholder="170"
                        value={form.height_cm} onChange={e => set("height_cm", e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <Select id="activity" labelText="Activity Level" value={form.activity_level}
                      onChange={e => set("activity_level", e.target.value)}>
                      <SelectItem value="sedentary" text="Sedentary (desk job)" />
                      <SelectItem value="light" text="Light (1-2 days/week)" />
                      <SelectItem value="moderate" text="Moderate (3-5 days/week)" />
                      <SelectItem value="active" text="Very active" />
                    </Select>
                    <div style={{ display: "flex", gap: 12 }}>
                      <Button kind="secondary" onClick={() => setStep(0)} style={{ flex: 1 }}>Back</Button>
                      <Button onClick={() => setStep(2)} style={{ flex: 1 }}>Continue</Button>
                    </div>
                  </Stack>
                )}

                {step === 2 && (
                  <Stack gap={6}>
                    <Select id="goal" labelText="Health Goal" value={form.health_goal}
                      onChange={e => set("health_goal", e.target.value)}>
                      <SelectItem value="lose_weight" text="Lose weight" />
                      <SelectItem value="gain_muscle" text="Gain muscle" />
                      <SelectItem value="maintain" text="Maintain weight" />
                      <SelectItem value="manage_sugar" text="Manage blood sugar" />
                      <SelectItem value="heart_health" text="Heart health" />
                    </Select>
                    <Select id="diet" labelText="Dietary Preference" value={form.dietary_preference}
                      onChange={e => set("dietary_preference", e.target.value)}>
                      <SelectItem value="veg" text="Vegetarian" />
                      <SelectItem value="non-veg" text="Non-vegetarian" />
                      <SelectItem value="vegan" text="Vegan" />
                      <SelectItem value="eggetarian" text="Eggetarian" />
                      <SelectItem value="jain" text="Jain" />
                    </Select>
                    <TextInput id="caltarget" labelText="Daily Calorie Target" type="number"
                      value={form.daily_calorie_target} onChange={e => set("daily_calorie_target", e.target.value)} />

                    <FormGroup legendText="Health Conditions">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {conditions.map(c => (
                          <Tag key={c} type={form.health_conditions.includes(c) ? "blue" : "gray"}
                            size="md"
                            onClick={() => set("health_conditions",
                              form.health_conditions.includes(c)
                                ? form.health_conditions.filter(x => x !== c)
                                : [...form.health_conditions, c]
                            )}
                            style={{ cursor: "pointer" }}>
                            {c}
                          </Tag>
                        ))}
                      </div>
                    </FormGroup>

                    <div style={{ display: "flex", gap: 12 }}>
                      <Button kind="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</Button>
                      <Button onClick={submit} disabled={loading} style={{ flex: 1 }}>
                        {loading ? "Creating..." : "Start Tracking"}
                      </Button>
                    </div>
                  </Stack>
                )}
              </div>
            )}

            {error && (
              <InlineNotification kind="error" title="Error" subtitle={error}
                lowContrast hideCloseButton style={{ marginTop: 16 }} />
            )}
          </Tile>
        </div>
      </div>
    </Theme>
  );
}

/* ────────────────────────────────────────────
   Meal Scanner
   ──────────────────────────────────────────── */

function PaywallScreen({ onPaid }) {
  const [subInfo, setSubInfo] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/subscription/status").then(setSubInfo).catch(() => {});
  }, []);

  const handlePayment = async () => {
    setPaying(true); setError(null);
    try {
      const order = await api.post("/subscription/create-order");

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.order_id,
        prefill: order.prefill,
        theme: { color: "#0f62fe" },
        handler: async (response) => {
          try {
            await api.post("/subscription/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onPaid();
          } catch (e) {
            setError("Payment verification failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setError(resp.error?.description || "Payment failed");
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.message);
      setPaying(false);
    }
  };

  return (
    <Stack gap={5}>
      <Tile style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#EDF5FF", display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 28, marginBottom: 20,
        }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: "#161616", margin: "0 0 8px" }}>
          Upgrade to NutriScan Pro
        </h2>
        <p style={{ fontSize: 14, color: "#525252", lineHeight: 1.6, margin: "0 0 8px" }}>
          {subInfo?.is_trial
            ? `You've used ${subInfo.free_scans_used} of ${subInfo.free_scans_total} free scans.`
            : "Subscribe to continue scanning meals."}
        </p>
      </Tile>

      <Tile style={{ padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 42, fontWeight: 600, color: "#161616", lineHeight: 1 }}>
            ₹300
          </div>
          <p style={{ fontSize: 14, color: "#525252", margin: "8px 0 0" }}>for 3 months</p>
        </div>

        <StructuredListWrapper>
          <StructuredListBody>
            {[
              "Unlimited meal scans",
              "AI-powered nutrition analysis",
              "Sugar spike & insulin resistance tracking",
              "Detailed macro breakdowns",
              "Personalized recommendations",
              "7-day history & overall stats",
            ].map((feature, i) => (
              <StructuredListRow key={i}>
                <StructuredListCell>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckmarkFilled size={16} style={{ color: "#198038", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#161616" }}>{feature}</span>
                  </span>
                </StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>

        <div style={{ marginTop: 24 }}>
          <Button onClick={handlePayment} disabled={paying}
            style={{ width: "100%", maxWidth: "100%" }} size="lg">
            {paying ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Loading withOverlay={false} small /> Processing...
              </span>
            ) : "Pay ₹300 — Activate Pro"}
          </Button>
        </div>

        <p style={{ fontSize: 12, color: "#8d8d8d", textAlign: "center", margin: "16px 0 0" }}>
          Secured by Razorpay · UPI, Cards, Netbanking accepted
        </p>

        {error && (
          <InlineNotification kind="error" title="Payment Error" subtitle={error}
            lowContrast hideCloseButton style={{ marginTop: 16 }} />
        )}
      </Tile>
    </Stack>
  );
}

function ScannerScreen() {
  const [image, setImage] = useState(null);
  const [file, setFile] = useState(null);
  const [mealType, setMealType] = useState(1); // 0=breakfast,1=lunch,2=dinner,3=snack
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [subChecked, setSubChecked] = useState(false);
  const ref = useRef(null);

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  // Check subscription on mount
  useEffect(() => {
    api.get("/subscription/status").then(s => {
      if (!s.active) setShowPaywall(true);
      setSubChecked(true);
    }).catch(() => setSubChecked(true));
  }, []);

  const pick = useCallback((f) => {
    if (!f?.type.startsWith("image/")) return;
    setError(null); setResult(null); setFile(f);
    const r = new FileReader();
    r.onload = (e) => setImage(e.target.result);
    r.readAsDataURL(f);
  }, []);

  const scan = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("meal_type", mealTypes[mealType]);
      setResult(await api.post("/meals/analyze", fd));
    } catch (e) {
      if (e.message === "subscription_required") {
        setShowPaywall(true);
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  const reset = () => { setImage(null); setFile(null); setResult(null); setError(null); };

  if (!subChecked) return <div style={{ padding: 60, textAlign: "center" }}><Loading withOverlay={false} /></div>;

  if (showPaywall) return <PaywallScreen onPaid={() => setShowPaywall(false)} />;

  const R = result;

  return (
    <div>
      {/* Upload state */}
      {!image && (
        <Stack gap={5}>
          <ContentSwitcher onChange={({ index }) => setMealType(index)} selectedIndex={mealType} size="lg">
            <Switch name="breakfast" text="Breakfast" />
            <Switch name="lunch" text="Lunch" />
            <Switch name="dinner" text="Dinner" />
            <Switch name="snack" text="Snack" />
          </ContentSwitcher>

          <Tile style={{ textAlign: "center", padding: "48px 24px", cursor: "pointer" }}
            onClick={() => ref.current?.click()}>
            <Camera size={48} style={{ color: "#0f62fe", marginBottom: 16 }} />
            <h3 style={{ fontSize: 20, fontWeight: 400, margin: "0 0 8px", color: "#161616" }}>
              Photograph your meal
            </h3>
            <p style={{ fontSize: 14, color: "#525252", margin: 0 }}>
              Take a photo or choose from gallery
            </p>
            <input ref={ref} type="file" accept="image/*" capture="environment"
              onChange={e => pick(e.target.files?.[0])} style={{ display: "none" }} />
          </Tile>
        </Stack>
      )}

      {/* Preview state */}
      {image && !R && (
        <Stack gap={5}>
          <Tile style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ position: "relative" }}>
              <img src={image} alt="" style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />
              <Button kind="ghost" size="sm" renderIcon={Close} iconDescription="Remove"
                hasIconOnly onClick={reset}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff" }} />
            </div>
            <div style={{ padding: 20 }}>
              <ContentSwitcher onChange={({ index }) => setMealType(index)} selectedIndex={mealType} size="sm"
                style={{ marginBottom: 16 }}>
                <Switch name="breakfast" text="Breakfast" />
                <Switch name="lunch" text="Lunch" />
                <Switch name="dinner" text="Dinner" />
                <Switch name="snack" text="Snack" />
              </ContentSwitcher>
              <Button onClick={scan} disabled={loading} style={{ width: "100%", maxWidth: "100%" }}
                renderIcon={loading ? undefined : Analytics}>
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Loading withOverlay={false} small />
                    Analyzing your meal...
                  </span>
                ) : "Analyze Meal"}
              </Button>
            </div>
          </Tile>
        </Stack>
      )}

      {error && (
        <InlineNotification kind="error" title="Analysis failed" subtitle={error}
          lowContrast hideCloseButton style={{ marginTop: 16 }} />
      )}

      {/* ─── Results ─── */}
      {R && (
        <Stack gap={5}>

          {/* Hero */}
          <Tile style={{ padding: 0, overflow: "hidden" }}>
            <img src={image} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px", color: "#161616" }}>{R.meal_name}</h2>
                  {R.meal_format && <p style={{ fontSize: 13, color: "#0f62fe", margin: "0 0 4px", fontWeight: 500 }}>{R.meal_format}</p>}
                  <p style={{ fontSize: 13, color: "#525252", margin: 0 }}>
                    Day {R.day_number} · Meal #{R.meal_number} · {mealTypes[mealType]}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 36, fontWeight: 600, color: "#161616", lineHeight: 1 }}>{R.total_calories}</div>
                  <span style={{ fontSize: 12, color: "#525252" }}>kcal</span>
                </div>
              </div>
              {R.total_weight_g > 0 && (
                <Tag type="outline" size="sm" style={{ marginTop: 12 }}>⚖️ {R.total_weight_g}g total weight</Tag>
              )}
            </div>
          </Tile>

          {/* Macros */}
          <Tile style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 20px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
              Macronutrients
            </h4>
            <Stack gap={5}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#525252" }}>Protein</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#161616" }}>{Math.round(R.macros.protein_g)}g</span>
                </div>
                <ProgressBar value={Math.min((R.macros.protein_g / 50) * 100, 100)} size="big" status="active" hideLabel />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#525252" }}>Carbs</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#161616" }}>{Math.round(R.macros.carbs_g)}g</span>
                </div>
                <ProgressBar value={Math.min((R.macros.carbs_g / 80) * 100, 100)} size="big" status="active" hideLabel />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#525252" }}>Fat</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#161616" }}>{Math.round(R.macros.fat_g)}g</span>
                </div>
                <ProgressBar value={Math.min((R.macros.fat_g / 50) * 100, 100)} size="big" status="active" hideLabel />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#525252" }}>Fiber</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#161616" }}>{Math.round(R.macros.fiber_g)}g</span>
                </div>
                <ProgressBar value={Math.min((R.macros.fiber_g / 12) * 100, 100)} size="big" status="active" hideLabel />
              </div>
            </Stack>
          </Tile>

          {/* Health Signals */}
          <Tile style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 20px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
              Health Signals
            </h4>

            <StructuredListWrapper>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Blood Sugar Impact</div>
                    <div style={{ fontSize: 13, color: "#525252" }}>
                      Peak ~{R.sugar_spike.estimated_peak_mg_dl} mg/dL in {R.sugar_spike.time_to_peak_minutes} min
                    </div>
                  </StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right" }}>
                    <RiskTag level={R.sugar_spike.glycemic_impact} />
                  </StructuredListCell>
                </StructuredListRow>

                {R.insulin_resistance && (
                  <StructuredListRow>
                    <StructuredListCell>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>Insulin Resistance Risk</div>
                      <div style={{ fontSize: 13, color: "#525252", lineHeight: 1.5 }}>
                        {R.insulin_resistance.explanation}
                      </div>
                    </StructuredListCell>
                    <StructuredListCell style={{ textAlign: "right" }}>
                      <RiskTag level={R.insulin_resistance.risk} />
                    </StructuredListCell>
                  </StructuredListRow>
                )}

                <StructuredListRow>
                  <StructuredListCell>
                    <div style={{ fontWeight: 500 }}>Health Score</div>
                  </StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 20, fontWeight: 600 }}>{R.healthiness_score}</span>
                    <span style={{ fontSize: 13, color: "#525252" }}> / 10</span>
                  </StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>

          {/* Detected Items */}
          <Tile style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
              Detected Items
            </h4>
            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Item</StructuredListCell>
                  <StructuredListCell head>Portion</StructuredListCell>
                  <StructuredListCell head style={{ textAlign: "right" }}>Cal</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {R.items?.map((item, i) => (
                  <StructuredListRow key={i}>
                    <StructuredListCell>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </StructuredListCell>
                    <StructuredListCell>
                      <span style={{ color: "#525252", fontSize: 13 }}>
                        {item.portion}{item.weight_g ? ` · ${item.weight_g}g` : ""}
                      </span>
                    </StructuredListCell>
                    <StructuredListCell style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 600 }}>{item.calories}</span>
                    </StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>

          {/* Sugar explanation */}
          {R.sugar_spike.explanation && (
            <InlineNotification kind="warning" title="Sugar Note" subtitle={R.sugar_spike.explanation}
              lowContrast hideCloseButton />
          )}

          {/* Recommendations */}
          {R.recommendations && (
            <InlineNotification kind="info" title="Recommendations" subtitle={R.recommendations}
              lowContrast hideCloseButton />
          )}

          <Button kind="tertiary" onClick={reset} style={{ width: "100%", maxWidth: "100%" }}
            renderIcon={Camera}>
            Scan Another Meal
          </Button>
        </Stack>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   Dashboard
   ──────────────────────────────────────────── */

function DashboardScreen() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState(null);
  const [stats, setStats] = useState(null);
  const [view, setView] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null); // meal id to confirm delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = () => {
    Promise.all([
      api.get("/dashboard/today"),
      api.get("/dashboard/history?days=7"),
      api.get("/dashboard/stats"),
    ]).then(([t, h, s]) => { setToday(t); setHistory(h); setStats(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.del(`/meals/${deleting}`);
      setDeleting(null);
      setLoading(true);
      load();
    } catch (e) { alert(e.message); }
    setDeleteLoading(false);
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center" }}><Loading withOverlay={false} /></div>;

  const cal = today?.summary?.total_calories || 0;
  const target = today?.calorie_target || 2000;
  const pct = Math.min((cal / target) * 100, 100);
  const rem = target - cal;

  return (
    <Stack gap={5}>
      <ContentSwitcher onChange={({ index }) => setView(index)} selectedIndex={view}>
        <Switch name="today" text="Today" />
        <Switch name="week" text="7 Days" />
        <Switch name="overall" text="Overall" />
      </ContentSwitcher>

      {/* ── Today ── */}
      {view === 0 && (
        <Stack gap={5}>
          <Tile style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 12, color: "#525252", textTransform: "uppercase", letterSpacing: "0.32px", margin: "0 0 4px" }}>
                  Day {today?.day_number}
                </p>
                <p style={{ fontSize: 13, color: "#8d8d8d", margin: 0 }}>{today?.date}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 36, fontWeight: 600, color: "#161616" }}>{cal}</span>
                <span style={{ fontSize: 14, color: "#525252" }}> / {target}</span>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: rem > 0 ? "#198038" : "#da1e28",
                }}>
                  {rem > 0 ? `${rem} remaining` : `${Math.abs(rem)} over`}
                </div>
              </div>
            </div>
            <ProgressBar value={pct} size="big" status={pct > 100 ? "error" : "active"} hideLabel />

            {today?.summary && (
              <div style={{ marginTop: 24 }}>
                <Stack gap={4}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#525252" }}>Protein</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(today.summary.total_protein_g)}g</span>
                    </div>
                    <ProgressBar value={Math.min((today.summary.total_protein_g / 120) * 100, 100)} size="small" status="active" hideLabel />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#525252" }}>Carbs</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(today.summary.total_carbs_g)}g</span>
                    </div>
                    <ProgressBar value={Math.min((today.summary.total_carbs_g / 250) * 100, 100)} size="small" status="active" hideLabel />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#525252" }}>Fat</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(today.summary.total_fat_g)}g</span>
                    </div>
                    <ProgressBar value={Math.min((today.summary.total_fat_g / 80) * 100, 100)} size="small" status="active" hideLabel />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#525252" }}>Fiber</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(today.summary.total_fiber_g)}g</span>
                    </div>
                    <ProgressBar value={Math.min((today.summary.total_fiber_g / 30) * 100, 100)} size="small" status="active" hideLabel />
                  </div>
                </Stack>
              </div>
            )}
          </Tile>

          <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", textTransform: "uppercase", letterSpacing: "0.32px" }}>
            Meals Today
          </h4>

          {!today?.meals?.length ? (
            <Tile style={{ textAlign: "center", padding: 48 }}>
              <Restaurant size={32} style={{ color: "#8d8d8d", marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: "#525252" }}>No meals logged yet today</p>
            </Tile>
          ) : today.meals.map((m, i) => (
            <Tile key={i} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <Tag type="blue" size="sm">#{m.meal_number}</Tag>
                    <span style={{ fontSize: 12, color: "#8d8d8d", textTransform: "capitalize" }}>{m.meal_type}</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#161616" }}>{m.meal_name}</h4>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#161616" }}>{m.total_calories}</div>
                    <span style={{ fontSize: 11, color: "#8d8d8d" }}>
                      kcal{m.total_weight_g > 0 ? ` · ${m.total_weight_g}g` : ""}
                    </span>
                  </div>
                  <Button kind="ghost" size="sm" hasIconOnly renderIcon={TrashCan}
                    iconDescription="Delete meal" onClick={() => setDeleting(m.id)}
                    style={{ color: "#da1e28", minHeight: "auto", padding: 8 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <Tag type="green" size="sm">P {Math.round(m.protein_g)}g</Tag>
                <Tag type="teal" size="sm">C {Math.round(m.carbs_g)}g</Tag>
                <Tag type="warm-gray" size="sm">F {Math.round(m.fat_g)}g</Tag>
                <RiskTag level={m.glycemic_impact} label={`Sugar: ${m.glycemic_impact?.replace("_", " ")}`} />
                {m.insulin_resistance_risk && <RiskTag level={m.insulin_resistance_risk} label={`IR: ${m.insulin_resistance_risk}`} />}
              </div>
              {m.recommendations && (
                <p style={{
                  fontSize: 13, color: "#525252", lineHeight: 1.6,
                  margin: "14px 0 0", paddingTop: 14,
                  borderTop: "1px solid #e0e0e0",
                }}>{m.recommendations}</p>
              )}
            </Tile>
          ))}

          {/* Delete Confirmation Modal */}
          <Modal
            open={!!deleting}
            modalHeading="Delete Meal"
            primaryButtonText={deleteLoading ? "Deleting..." : "Delete"}
            secondaryButtonText="Cancel"
            danger
            onRequestSubmit={handleDelete}
            onRequestClose={() => setDeleting(null)}
            size="xs"
          >
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Are you sure you want to delete this meal? This action cannot be undone. 
              Your daily totals will be recalculated automatically.
            </p>
          </Modal>
        </Stack>
      )}

      {/* ── Week ── */}
      {view === 1 && (
        <Stack gap={4}>
          {!history?.days?.length ? (
            <Tile style={{ textAlign: "center", padding: 48 }}>
              <p style={{ color: "#525252" }}>No history yet</p>
            </Tile>
          ) : history.days.map((d, i) => {
            const p = Math.min((d.total_calories / history.calorie_target) * 100, 100);
            return (
              <Tile key={i} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#161616" }}>Day {d.day_number}</span>
                    <span style={{ fontSize: 13, color: "#8d8d8d", marginLeft: 10 }}>{d.date}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#8d8d8d" }}>{d.meal_count} meals</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: "#161616" }}>{d.total_calories} kcal</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {d.high_sugar_meals > 0 && <Tag type="red" size="sm">{d.high_sugar_meals} high sugar</Tag>}
                    {d.high_insulin_risk_meals > 0 && <Tag type="magenta" size="sm">{d.high_insulin_risk_meals} high IR</Tag>}
                  </div>
                </div>
                <ProgressBar value={p} size="small" status={p > 100 ? "error" : "active"} hideLabel />
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#525252" }}>
                  <span>P: {Math.round(d.total_protein_g)}g</span>
                  <span>C: {Math.round(d.total_carbs_g)}g</span>
                  <span>F: {Math.round(d.total_fat_g)}g</span>
                  <span>Score: {d.avg_healthiness?.toFixed(1)}/10</span>
                </div>
              </Tile>
            );
          })}
        </Stack>
      )}

      {/* ── Overall ── */}
      {view === 2 && stats && (
        <Stack gap={4}>
          {/* Key Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Days Tracked", value: stats.current_day, icon: <ChartBar size={20} /> },
              { label: "Total Meals", value: stats.total_meals, icon: <Restaurant size={20} /> },
              { label: "Avg Calories", value: Math.round(stats.avg_calories || 0), icon: <Analytics size={20} /> },
              { label: "Avg Weight/Meal", value: `${Math.round(stats.avg_weight_g || 0)}g`, icon: <Scale size={20} /> },
            ].map((s, i) => (
              <Tile key={i} style={{ padding: 20 }}>
                <div style={{ color: "#0f62fe", marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#161616", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#525252" }}>{s.label}</div>
              </Tile>
            ))}
          </div>

          {/* Averages */}
          <Tile style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
              Averages Per Meal
            </h4>
            <StructuredListWrapper>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>Protein</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right", fontWeight: 600 }}>{Math.round(stats.avg_protein || 0)}g</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>Carbs</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right", fontWeight: 600 }}>{Math.round(stats.avg_carbs || 0)}g</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>Fat</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right", fontWeight: 600 }}>{Math.round(stats.avg_fat || 0)}g</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>Health Score</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right", fontWeight: 600 }}>{(stats.avg_healthiness || 0).toFixed(1)} / 10</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>

          {/* Flags */}
          <Tile style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
              Health Flags
            </h4>
            <StructuredListWrapper>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>High Sugar Meals</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right" }}>
                    <Tag type={stats.high_sugar_meals > 0 ? "red" : "green"} size="sm">
                      {stats.high_sugar_meals || 0}
                    </Tag>
                  </StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>High IR Risk Meals</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right" }}>
                    <Tag type={stats.high_insulin_meals > 0 ? "red" : "green"} size="sm">
                      {stats.high_insulin_meals || 0}
                    </Tag>
                  </StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>
        </Stack>
      )}
    </Stack>
  );
}

/* ────────────────────────────────────────────
   Profile
   ──────────────────────────────────────────── */

function ProfileScreen({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [sub, setSub] = useState(null);

  useEffect(() => {
    api.get("/profile").then(p => { setProfile(p); setForm(p); });
    api.get("/subscription/status").then(setSub).catch(() => {});
  }, []);

  const save = async () => {
    try { await api.put("/profile", form); setProfile(form); setEditing(false); }
    catch (e) { alert(e.message); }
  };

  if (!profile) return <div style={{ padding: 60, textAlign: "center" }}><Loading withOverlay={false} /></div>;

  return (
    <Stack gap={5}>
      {/* Avatar card */}
      <Tile style={{ padding: 32, textAlign: "center" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "#0f62fe", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 600, margin: "0 auto 16px",
        }}>
          {profile.name?.[0]?.toUpperCase()}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: "#161616", margin: "0 0 4px" }}>{profile.name}</h2>
        <p style={{ fontSize: 14, color: "#525252", margin: "0 0 12px" }}>{profile.email}</p>
        <Tag type="blue" size="sm">Day {profile.current_day}</Tag>
      </Tile>

      {/* Details */}
      <Tile style={{ padding: 24 }}>
        {editing ? (
          <Stack gap={5}>
            <TextInput id="edit-name" labelText="Name" value={form.name || ""}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ display: "flex", gap: 16 }}>
              <TextInput id="edit-weight" labelText="Weight (kg)" type="number" value={form.weight_kg || ""}
                onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} style={{ flex: 1 }} />
              <TextInput id="edit-height" labelText="Height (cm)" type="number" value={form.height_cm || ""}
                onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} style={{ flex: 1 }} />
            </div>
            <TextInput id="edit-cal" labelText="Daily Calorie Target" type="number" value={form.daily_calorie_target || ""}
              onChange={e => setForm(f => ({ ...f, daily_calorie_target: e.target.value }))} />
            <div style={{ display: "flex", gap: 12 }}>
              <Button kind="secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={save} style={{ flex: 1 }}>Save Changes</Button>
            </div>
          </Stack>
        ) : (
          <>
            <StructuredListWrapper>
              <StructuredListBody>
                {[
                  ["Age", profile.age],
                  ["Gender", profile.gender],
                  ["Weight", profile.weight_kg ? `${profile.weight_kg} kg` : null],
                  ["Height", profile.height_cm ? `${profile.height_cm} cm` : null],
                  ["Activity", profile.activity_level],
                  ["Goal", profile.health_goal?.replace(/_/g, " ")],
                  ["Diet", profile.dietary_preference],
                  ["Daily Target", `${profile.daily_calorie_target} kcal`],
                  ["Conditions", profile.health_conditions?.join(", ") || "None"],
                ].map(([k, v], i) => (
                  <StructuredListRow key={i}>
                    <StructuredListCell style={{ color: "#525252" }}>{k}</StructuredListCell>
                    <StructuredListCell style={{ textAlign: "right", fontWeight: 500, textTransform: "capitalize" }}>
                      {v || "—"}
                    </StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
            <Button onClick={() => setEditing(true)} renderIcon={Edit} style={{ width: "100%", maxWidth: "100%", marginTop: 16 }}>
              Edit Profile
            </Button>
          </>
        )}
      </Tile>

      {/* Subscription */}
      {sub && (
        <Tile style={{ padding: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: "#161616", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.32px" }}>
            Subscription
          </h4>
          <StructuredListWrapper>
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell>Status</StructuredListCell>
                <StructuredListCell style={{ textAlign: "right" }}>
                  <Tag type={sub.active && !sub.is_trial ? "green" : sub.is_trial ? "blue" : "red"} size="sm">
                    {sub.active && !sub.is_trial ? "Active" : sub.is_trial ? `Free Trial (${sub.free_scans_used}/${sub.free_scans_total})` : "Expired"}
                  </Tag>
                </StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>Plan</StructuredListCell>
                <StructuredListCell style={{ textAlign: "right", fontWeight: 500 }}>
                  {sub.plan || sub.plan_name}
                </StructuredListCell>
              </StructuredListRow>
              {sub.expires_at && (
                <StructuredListRow>
                  <StructuredListCell>Expires</StructuredListCell>
                  <StructuredListCell style={{ textAlign: "right", fontWeight: 500 }}>
                    {new Date(sub.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </StructuredListCell>
                </StructuredListRow>
              )}
              <StructuredListRow>
                <StructuredListCell>Price</StructuredListCell>
                <StructuredListCell style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{sub.plan_amount} / {sub.plan_duration_days} days
                </StructuredListCell>
              </StructuredListRow>
            </StructuredListBody>
          </StructuredListWrapper>
        </Tile>
      )}

      <Button kind="danger--tertiary" onClick={onLogout} renderIcon={Logout}
        style={{ width: "100%", maxWidth: "100%" }}>
        Sign Out
      </Button>
    </Stack>
  );
}

/* ────────────────────────────────────────────
   App Shell
   ──────────────────────────────────────────── */

export default function App() {
  const [authed, setAuthed] = useState(!!api.token);
  const [tab, setTab] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  // Load Razorpay checkout script
  useEffect(() => {
    if (!document.getElementById("razorpay-script")) {
      const s = document.createElement("script");
      s.id = "razorpay-script";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show install banner if not dismissed before
      if (!localStorage.getItem("ns_install_dismissed")) {
        setShowInstall(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowInstall(false);
    }
    setInstallPrompt(null);
  };

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem("ns_install_dismissed", "1");
  };

  if (!authed) return <AuthScreen onAuth={() => setAuthed(true)} />;

  const tabs = [
    { icon: "📸", label: "Scan" },
    { icon: "📊", label: "Dashboard" },
    { icon: "👤", label: "Profile" },
  ];

  return (
    <Theme theme="g10">
      <div style={{ minHeight: "100vh", background: "#f4f4f4", paddingBottom: 80 }}>

        {/* PWA Install Banner */}
        {showInstall && (
          <div style={{
            background: "#0f62fe", color: "#fff",
            padding: "10px 16px", display: "flex",
            alignItems: "center", justifyContent: "space-between",
            fontSize: 13, gap: 12,
          }}>
            <span>📲 Install NutriScan for the best experience</span>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Button kind="ghost" size="sm" onClick={handleInstall}
                style={{ color: "#fff", minHeight: "auto", padding: "4px 12px" }}>
                Install
              </Button>
              <Button kind="ghost" size="sm" onClick={dismissInstall}
                style={{ color: "rgba(255,255,255,0.6)", minHeight: "auto", padding: "4px 8px" }}>
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div style={{
          background: "#161616", color: "#fff",
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4, background: "#0f62fe",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 600,
          }}>NS</div>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.16px" }}>NutriScan</span>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 20px 24px", maxWidth: 540, margin: "0 auto" }}>
          {tab === 0 && <ScannerScreen />}
          {tab === 1 && <DashboardScreen />}
          {tab === 2 && <ProfileScreen onLogout={() => { api.clear(); setAuthed(false); }} />}
        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 540,
          background: "#fff", borderTop: "1px solid #e0e0e0",
          display: "flex", zIndex: 9999,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "10px 0 14px",
              background: tab === i ? "#EDF5FF" : "none", border: "none", cursor: "pointer",
              color: tab === i ? "#0f62fe" : "#8d8d8d",
              transition: "all 0.15s",
              borderTop: tab === i ? "2px solid #0f62fe" : "2px solid transparent",
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: tab === i ? 600 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Theme>
  );
}
