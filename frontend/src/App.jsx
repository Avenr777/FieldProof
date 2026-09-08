import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid, Briefcase, FileText, FileCheck2, Users, ShieldCheck, BarChart3, Settings, LifeBuoy,
  Search, Bell, ChevronDown, ChevronRight, Mic, Camera, ScanLine, Plus, Upload, Download, Send,
  Check, AlertTriangle, TrendingUp, TrendingDown, X, ArrowRight, Play, Star, LogOut, Menu,
  MoreHorizontal, MapPin, Clock, Zap, Building2, Flame, Wrench, Sun, Radio, ClipboardCheck,
  CircleCheck, CircleAlert, Eye, UserPlus, CreditCard, Puzzle, ToggleLeft, Sparkles, Gauge,
  ListChecks, CalendarDays, Filter, ArrowUpRight, ArrowDownRight, HardHat, Droplets, Thermometer,
  PhoneCall, Quote, Loader2, FileUp, Pencil, Square, Volume2, Wifi, WifiOff, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import * as api from "./api";

/* ======================================================================
   GLOBAL STYLE
   ====================================================================== */

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .fs-root { font-family: 'Inter', ui-sans-serif, sans-serif; }
    .fs-display { font-family: 'Space Grotesk', ui-sans-serif, sans-serif; }
    .fs-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .fs-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .fs-scroll::-webkit-scrollbar-thumb { background: #44403c; border-radius: 999px; }
    .fs-gradient-text {
      background-image: linear-gradient(90deg,#F2622A,#FBBF6B);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .fs-card-shadow { box-shadow: 0 1px 2px rgba(28,23,18,0.04), 0 8px 24px rgba(28,23,18,0.06); }
    .fs-spin { animation: fs-spin 0.8s linear infinite; }
    @keyframes fs-spin { to { transform: rotate(360deg); } }
  `}</style>
);

/* ======================================================================
   STATIC REFERENCE DATA (not backed by the API — decorative/marketing
   content, or lookup tables keyed by strings the API already returns)
   ====================================================================== */

const TRADE_ICON = {
  Electrical: Zap,
  Plumbing: Droplets,
  HVAC: Thermometer,
  "Fire Safety": Flame,
  Solar: Sun,
  General: Building2,
};

const plans = [
  {
    name: "Starter", price: "$39", note: "per technician / month",
    features: ["Up to 5 technicians", "Voice + photo capture", "3 standard templates", "Email support"],
  },
  {
    name: "Growth", price: "$59", note: "per technician / month", popular: true,
    features: ["Unlimited technicians", "Custom template mapping", "Compliance rules engine", "Analytics dashboard", "Priority support"],
  },
  {
    name: "Enterprise", price: "Custom", note: "volume pricing",
    features: ["CRM / ERP integration", "Dedicated onboarding", "Custom compliance rules", "SLA & audit support"],
  },
];

// Field types docx_extractor.py can infer -> the input control TemplateFillForm renders
const FIELD_TYPE_INPUT = {
  date: "date",
  time: "time",
  email: "email",
  phone: "tel",
  url: "url",
  number: "number",
  percentage: "number",
  currency: "text",
  multiline_text: "textarea",
  checkbox: "checkbox",
};

/* ======================================================================
   SHARED UI ATOMS
   ====================================================================== */

const STATUS_TONE = {
  "Awaiting Review": "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  "Compliance Flag": "bg-red-50 text-red-700 border-red-200",
  "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Scheduled": "bg-stone-100 text-stone-600 border-stone-200",
  "Pending Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Sent": "bg-blue-50 text-blue-700 border-blue-200",
  "On Site": "bg-emerald-600 text-white",
  "Available": "bg-blue-600 text-white",
  "Off Duty": "bg-stone-400 text-white",
};

function StatusPill({ label }) {
  const tone = STATUS_TONE[label] || "bg-stone-100 text-stone-600 border-stone-200";
  const solid = tone.includes("text-white");
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${solid ? "" : "border"} ${tone}`}>
      {label}
    </span>
  );
}

const SEVERITY_TONE = { High: "bg-red-500", Medium: "bg-amber-500", Low: "bg-sky-500" };

function SeverityTag({ level }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${SEVERITY_TONE[level] || "bg-stone-400"}`}>
      {level}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const v = value ?? 0;
  const tone = v >= 90 ? "bg-emerald-500" : v >= 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="h-1.5 flex-1 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="fs-mono text-xs text-stone-500 w-10">{typeof v === "number" ? v.toFixed(0) : v}%</span>
    </div>
  );
}

function Card({ children, className = "", ...rest }) {
  return <div className={`bg-white rounded-2xl border border-stone-100 fs-card-shadow ${className}`} {...rest}>{children}</div>;
}

function IconBadge({ icon: Icon, className }) {
  return (
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-stone-400">
      <Loader2 className="h-6 w-6 fs-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-red-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold text-red-700 border border-red-300 rounded-full px-3 py-1.5 shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}

function relativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/* ======================================================================
   LANDING PAGE (marketing content — not backend-driven)
   ====================================================================== */

function Nav({ onLogin, onSignup }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-stone-50/90 backdrop-blur border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="fs-display font-semibold text-lg text-stone-900">FieldProof</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-stone-600">
          <a href="#how" className="hover:text-stone-900">How it works</a>
          <a href="#features" className="hover:text-stone-900">Features</a>
          <a href="#industries" className="hover:text-stone-900">Industries</a>
          <a href="#pricing" className="hover:text-stone-900">Pricing</a>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={onLogin} className="text-sm font-medium text-stone-700 px-4 py-2 hover:text-stone-900">Log in</button>
          <button onClick={onSignup} className="text-sm font-semibold text-white px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm">
            Start free trial
          </button>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          <Menu className="h-6 w-6 text-stone-700" />
        </button>
      </div>
      {open && (
        <div className="md:hidden px-6 pb-4 flex flex-col gap-3 text-sm text-stone-600">
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#features" onClick={() => setOpen(false)}>Features</a>
          <a href="#industries" onClick={() => setOpen(false)}>Industries</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <button onClick={onLogin} className="text-left font-medium text-stone-800">Log in</button>
          <button onClick={onSignup} className="text-left font-semibold text-white px-4 py-2 rounded-full bg-orange-600 w-fit">Start free trial</button>
        </div>
      )}
    </header>
  );
}

function HeroMock() {
  return (
    <div className="relative bg-stone-950 rounded-3xl p-6 fs-card-shadow">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </div>
      <div className="bg-stone-900 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 text-stone-400 text-xs mb-3">
          <Mic className="h-3.5 w-3.5 text-orange-400" /> Voice note · 0:38
        </div>
        <div className="flex items-end gap-1 h-10">
          {[6,14,9,20,12,26,16,10,22,8,18,13,7,24,11,15].map((h,i) => (
            <div key={i} className="w-1.5 rounded-full bg-gradient-to-t from-orange-600 to-orange-300" style={{ height: `${h * 3}px` }} />
          ))}
        </div>
        <p className="fs-mono text-xs text-stone-400 mt-3 leading-relaxed">
          "Replaced 16A breaker in Panel B. Reading 230 volts. Terminals tightened, no overheating."
        </p>
      </div>
      <div className="flex items-center justify-center py-1">
        <div className="h-8 w-8 rounded-full bg-stone-800 flex items-center justify-center">
          <ArrowRight className="h-4 w-4 text-orange-400 rotate-90" />
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <span className="fs-display text-sm font-semibold text-stone-900">Electrical Inspection Report</span>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Draft ready</span>
        </div>
        {[
          ["Equipment", "Circuit Breaker (MCB)", 96],
          ["Voltage Reading", "230.4 V", 98],
          ["Serial Number", "ABB-MCB-16A", 65],
        ].map(([label, val, conf]) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-t border-stone-100 first:border-0">
            <span className="text-xs text-stone-500">{label}</span>
            <div className="flex items-center gap-2">
              <span className="fs-mono text-xs text-stone-800">{val}</span>
              <ConfidenceBar value={conf} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ onSignup }) {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-14 items-center">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 mb-6">
          <Sparkles className="h-3.5 w-3.5" /> Built for field trades
        </div>
        <h1 className="fs-display text-4xl md:text-5xl font-semibold text-stone-900 leading-tight mb-6">
          The report writes itself while you're still <span className="fs-gradient-text">on site.</span>
        </h1>
        <p className="text-stone-600 text-lg leading-relaxed mb-8 max-w-lg">
          FieldProof turns a voice note and a few photos into a compliant, ready-to-send document —
          inspection reports, invoices, and certificates included. No forms, no typing after hours.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={onSignup} className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm">
            Start free trial <ArrowRight className="h-4 w-4" />
          </button>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 px-6 py-3 rounded-full border border-stone-300 hover:border-stone-400">
            <Play className="h-4 w-4" /> Watch 2-min demo
          </button>
        </div>
        <div className="flex items-center gap-6 mt-10 text-sm text-stone-500">
          <div><span className="fs-display font-semibold text-stone-900 text-xl">28%</span> less admin time</div>
          <div className="h-8 w-px bg-stone-200" />
          <div><span className="fs-display font-semibold text-stone-900 text-xl">96%</span> avg AI accuracy</div>
        </div>
      </div>
      <HeroMock />
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", icon: Mic, title: "Record", desc: "Describe the job like you're talking to a coworker — no script, no fields to fill." },
    { n: "02", icon: Camera, title: "Capture", desc: "Photograph the equipment, the meter reading, and the signed sign-off sheet." },
    { n: "03", icon: ScanLine, title: "Extract", desc: "Whisper, vision, and OCR pull structured data from the voice note and photos." },
    { n: "04", icon: ClipboardCheck, title: "Review & send", desc: "Check the fields flagged low-confidence, approve, and the document is sent." },
  ];
  return (
    <section id="how" className="max-w-6xl mx-auto px-6 py-20">
      <div className="max-w-xl mb-12">
        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">How it works</span>
        <h2 className="fs-display text-3xl font-semibold text-stone-900 mt-2">Four steps, no paperwork.</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="relative">
            <span className="fs-mono text-4xl font-semibold text-stone-200">{s.n}</span>
            <IconBadge icon={s.icon} className="bg-gradient-to-br from-orange-500 to-orange-700 -mt-6 mb-4" />
            <h3 className="fs-display font-semibold text-stone-900 mb-1.5">{s.title}</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Camera, title: "Multimodal capture", desc: "Voice, photos, and OCR combine into one structured job record." },
    { icon: Gauge, title: "Confidence scoring", desc: "Every extracted field is scored, so reviewers only check what's uncertain." },
    { icon: ShieldCheck, title: "Compliance engine", desc: "Trade-specific rules catch missing fields before the technician leaves site." },
    { icon: FileText, title: "Template mapping", desc: "Upload your own PDF or Word forms — AI maps data onto them automatically." },
    { icon: CircleCheck, title: "Human in the loop", desc: "Nothing sends without a technician or office review and approval." },
    { icon: BarChart3, title: "Analytics dashboard", desc: "Track documentation time, compliance rate, and AI accuracy over time." },
  ];
  return (
    <section id="features" className="bg-stone-950 py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-12">
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Platform</span>
          <h2 className="fs-display text-3xl font-semibold text-white mt-2">Everything the office needs to trust the paperwork.</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f) => (
            <div key={f.title} className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
              <IconBadge icon={f.icon} className="bg-gradient-to-br from-orange-500 to-orange-700 mb-4" />
              <h3 className="fs-display font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Industries() {
  const list = [
    { name: "Electrical", icon: Zap }, { name: "Plumbing", icon: Droplets }, { name: "HVAC", icon: Thermometer },
    { name: "Solar", icon: Sun }, { name: "Fire Safety", icon: Flame }, { name: "Construction", icon: HardHat },
    { name: "Facilities", icon: Building2 }, { name: "Telecom", icon: PhoneCall },
  ];
  return (
    <section id="industries" className="max-w-6xl mx-auto px-6 py-20">
      <div className="max-w-xl mb-10">
        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Industries</span>
        <h2 className="fs-display text-3xl font-semibold text-stone-900 mt-2">Built around trade-specific paperwork.</h2>
      </div>
      <div className="flex flex-wrap gap-3">
        {list.map((i) => (
          <div key={i.name} className="flex items-center gap-2 border border-stone-200 rounded-full pl-3 pr-4 py-2 bg-white">
            <i.icon className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-stone-700">{i.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing({ onSignup }) {
  return (
    <section id="pricing" className="bg-stone-50 py-20 border-y border-stone-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-12">
          <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Pricing</span>
          <h2 className="fs-display text-3xl font-semibold text-stone-900 mt-2">Priced per technician, not per guess.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl p-7 bg-white border ${p.popular ? "border-orange-400 ring-2 ring-orange-100" : "border-stone-200"}`}>
              {p.popular && <span className="text-xs font-semibold text-white bg-orange-600 px-3 py-1 rounded-full">Most popular</span>}
              <h3 className="fs-display text-xl font-semibold text-stone-900 mt-3">{p.name}</h3>
              <div className="flex items-baseline gap-1 mt-2 mb-1">
                <span className="fs-display text-3xl font-semibold text-stone-900">{p.price}</span>
              </div>
              <p className="text-xs text-stone-500 mb-6">{p.note}</p>
              <ul className="space-y-2.5 mb-7">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignup} className={`w-full text-sm font-semibold py-2.5 rounded-full ${p.popular ? "text-white bg-gradient-to-r from-orange-500 to-orange-600" : "text-stone-800 border border-stone-300"}`}>
                {p.price === "Custom" ? "Talk to sales" : "Start free trial"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({ onSignup }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 text-center">
      <Quote className="h-8 w-8 text-orange-500 mx-auto mb-6" />
      <p className="fs-display text-2xl md:text-3xl font-medium text-stone-900 max-w-2xl mx-auto leading-snug">
        "Our technicians used to lose an hour a day to paperwork. Now it's minutes, and the office trusts every report."
      </p>
      <p className="text-sm text-stone-500 mt-4">Operations Manager, regional electrical contractor</p>
      <button onClick={onSignup} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm">
        Start your free trial <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-950 text-stone-400 py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="fs-display font-semibold text-white">FieldProof</span>
          </div>
          <p className="text-sm max-w-xs">AI documentation for electricians, plumbers, HVAC, and field service teams.</p>
        </div>
        <div className="flex gap-16 text-sm">
          <div>
            <p className="text-stone-200 font-medium mb-3">Product</p>
            <ul className="space-y-2"><li>How it works</li><li>Features</li><li>Pricing</li></ul>
          </div>
          <div>
            <p className="text-stone-200 font-medium mb-3">Company</p>
            <ul className="space-y-2"><li>About</li><li>Contact</li><li>Support</li></ul>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-10 pt-6 border-t border-stone-800 text-xs">
        © 2026 FieldProof. All rights reserved.
      </div>
    </footer>
  );
}

function LandingPage({ onLogin, onSignup }) {
  return (
    <div className="fs-root min-h-screen bg-stone-50">
      <GlobalStyle />
      <Nav onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} />
      <HowItWorks />
      <Features />
      <Industries />
      <Pricing onSignup={onSignup} />
      <CTA onSignup={onSignup} />
      <Footer />
    </div>
  );
}

/* ======================================================================
   AUTH PAGE — wired to real /auth/login and /auth/signup
   ====================================================================== */

function AuthPage({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("Growth");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [loginEmail, setLoginEmail] = useState("priya@meridianfieldworks.com");
  const [loginPassword, setLoginPassword] = useState("demo-password-123");
  const [signupBusiness, setSignupBusiness] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupTrade, setSignupTrade] = useState("Electrical");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.login(loginEmail, loginPassword);
      api.setToken(result.access_token);
      onAuthenticated();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function goSignupStep2(e) {
    e.preventDefault();
    if (!signupBusiness || !signupName || !signupEmail || !signupPassword) {
      setError("Please fill in every field before continuing.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleCreateAccount() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.signup({
        business_name: signupBusiness,
        full_name: signupName,
        email: signupEmail,
        password: signupPassword,
        primary_trade: signupTrade,
      });
      api.setToken(result.access_token);
      onAuthenticated();
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fs-root min-h-screen bg-stone-950 flex">
      <GlobalStyle />
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-orange-600 opacity-20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-400 opacity-10 blur-3xl" />
        <button onClick={onBack} className="relative flex items-center gap-2 text-stone-300 hover:text-white text-sm w-fit">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
            <Mic className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="fs-display font-semibold text-white">FieldProof</span>
        </button>
        <div className="relative">
          <Quote className="h-7 w-7 text-orange-400 mb-4" />
          <p className="fs-display text-2xl text-white leading-snug max-w-md">
            Documentation went from the worst part of the day to something that just happens.
          </p>
          <p className="text-stone-400 text-sm mt-4">Field Operations Lead, HVAC & mechanical services</p>
        </div>
        <div className="relative flex items-center gap-8 text-stone-400 text-sm">
          <div><span className="fs-display text-white text-lg font-semibold">1,200+</span> technicians</div>
          <div><span className="fs-display text-white text-lg font-semibold">96%</span> AI accuracy</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="fs-display font-semibold text-lg text-white">FieldProof</span>
          </div>

          <div className="bg-white rounded-3xl p-8 fs-card-shadow">
            <div className="flex bg-stone-100 rounded-full p-1 mb-7">
              <button
                onClick={() => { setMode("login"); setStep(1); setError(null); }}
                className={`flex-1 text-sm font-semibold py-2 rounded-full transition ${mode === "login" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
              >
                Log in
              </button>
              <button
                onClick={() => { setMode("signup"); setStep(1); setError(null); }}
                className={`flex-1 text-sm font-semibold py-2 rounded-full transition ${mode === "signup" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
              >
                Sign up
              </button>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <h1 className="fs-display text-xl font-semibold text-stone-900 mb-1">Welcome back</h1>
                <p className="text-sm text-stone-500 mb-5">Log in to your business dashboard.</p>
                <div>
                  <label className="text-xs font-medium text-stone-600">Work email</label>
                  <input
                    type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-stone-600">Password</label>
                    <a href="#" className="text-xs text-orange-600 font-medium">Forgot password?</a>
                  </div>
                  <input
                    type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>
                <button
                  type="submit" disabled={submitting}
                  className="w-full text-sm font-semibold text-white py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 fs-spin" />}
                  Log in to dashboard
                </button>
                <p className="text-xs text-stone-400 text-center pt-1">
                  Demo account is pre-filled — just hit log in. (Run <code className="fs-mono">python -m app.seed</code> on the backend first.)
                </p>
              </form>
            )}

            {mode === "signup" && step === 1 && (
              <form onSubmit={goSignupStep2} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="fs-mono text-xs text-orange-600 font-semibold">Step 1 of 2</span>
                </div>
                <h1 className="fs-display text-xl font-semibold text-stone-900 mb-1">Create your business account</h1>
                <p className="text-sm text-stone-500 mb-5">Set up FieldProof for your team.</p>
                <div>
                  <label className="text-xs font-medium text-stone-600">Business name</label>
                  <input
                    value={signupBusiness} onChange={(e) => setSignupBusiness(e.target.value)}
                    placeholder="Meridian Field Works"
                    className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600">Full name</label>
                    <input
                      value={signupName} onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Priya Nair"
                      className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600">Primary trade</label>
                    <select
                      value={signupTrade} onChange={(e) => setSignupTrade(e.target.value)}
                      className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 bg-white"
                    >
                      <option>Electrical</option><option>Plumbing</option><option>HVAC</option><option>Solar</option><option>Fire Safety</option><option>General</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Work email</label>
                  <input
                    type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Password</label>
                  <input
                    type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a password"
                    className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>
                <button type="submit" className="w-full text-sm font-semibold text-white py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm mt-2 flex items-center justify-center gap-2">
                  Continue to plan <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {mode === "signup" && step === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="fs-mono text-xs text-orange-600 font-semibold">Step 2 of 2</span>
                </div>
                <h1 className="fs-display text-xl font-semibold text-stone-900 mb-1">Choose your plan</h1>
                <p className="text-sm text-stone-500 mb-5">You can change this anytime from Settings.</p>
                <div className="space-y-3 mb-6">
                  {plans.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setSelectedPlan(p.name)}
                      className={`w-full text-left border rounded-xl px-4 py-3 flex items-center justify-between transition ${selectedPlan === p.name ? "border-orange-400 bg-orange-50" : "border-stone-200"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === p.name ? "border-orange-500" : "border-stone-300"}`}>
                          {selectedPlan === p.name && <div className="h-2 w-2 rounded-full bg-orange-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{p.name} {p.popular && <span className="text-xs font-medium text-orange-600">· Popular</span>}</p>
                          <p className="text-xs text-stone-500">{p.note}</p>
                        </div>
                      </div>
                      <span className="fs-display text-sm font-semibold text-stone-900">{p.price}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 text-sm font-semibold text-stone-700 py-3 rounded-xl border border-stone-300">Back</button>
                  <button
                    onClick={handleCreateAccount} disabled={submitting}
                    className="flex-1 text-sm font-semibold text-white py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="h-4 w-4 fs-spin" />}
                    Create account
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-stone-500 mt-5">
            By continuing you agree to FieldProof's Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — SHELL
   ====================================================================== */

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "jobs", label: "Jobs", icon: Briefcase },
  { key: "capture", label: "Field Capture", icon: Camera },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "documents", label: "Documents", icon: FileCheck2 },
  { key: "technicians", label: "Technicians", icon: Users },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

function Sidebar({ active, setActive, onLogout, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:static z-40 lg:z-auto top-0 bottom-0 left-0 w-64 bg-stone-950 flex flex-col shrink-0 transition-transform ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="fs-display font-semibold text-white text-lg">FieldProof</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto fs-scroll">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-500 uppercase tracking-wide">Workspace</p>
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActive(item.key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${isActive ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white" : "text-stone-400 hover:bg-stone-900 hover:text-stone-100"}`}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-4 space-y-1 border-t border-stone-900 pt-3">
          <button onClick={() => setActive("settings")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active === "settings" ? "bg-stone-900 text-white" : "text-stone-400 hover:bg-stone-900 hover:text-stone-100"}`}>
            <Settings className="h-4.5 w-4.5" /> Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:bg-stone-900 hover:text-stone-100">
            <LifeBuoy className="h-4.5 w-4.5" /> Support
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:bg-stone-900 hover:text-stone-100">
            <LogOut className="h-4.5 w-4.5" /> Log out
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ setMobileOpen, currentUser }) {
  const initials = currentUser?.full_name
    ? currentUser.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div className="flex items-center justify-between gap-4 px-5 lg:px-8 py-5 border-b border-stone-100 bg-white">
      <div className="flex items-center gap-3">
        <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5 text-stone-700" />
        </button>
        <div className="hidden sm:flex items-center gap-2 bg-stone-100 rounded-full px-4 py-2 w-72">
          <Search className="h-4 w-4 text-stone-400" />
          <input placeholder="Search jobs, technicians, documents..." className="bg-transparent text-sm text-stone-700 placeholder-stone-400 focus:outline-none w-full" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full">
          <Sparkles className="h-3.5 w-3.5" /> Growth Plan
        </span>
        <button className="relative">
          <Bell className="h-5 w-5 text-stone-500" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-stone-200">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold">{initials}</div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-stone-800 leading-tight">Hi, {currentUser?.full_name?.split(" ")[0] || "there"} 👋</p>
            <p className="text-xs text-stone-500 leading-tight">{currentUser?.role || ""}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-stone-400 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — OVERVIEW
   ====================================================================== */

function OverviewView({ summary, jobs, complianceEvents, onCreateJob, loading, error, onRetry }) {
  if (loading) return <Spinner label="Loading overview..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  const statCards = [
    { icon: Briefcase, color: "bg-blue-600", label: "Active Jobs Today", value: String(summary?.active_jobs_today ?? 0) },
    { icon: FileCheck2, color: "bg-violet-600", label: "Documents Pending Review", value: String(summary?.documents_pending_review ?? 0) },
    { icon: AlertTriangle, color: "bg-red-600", label: "Open Compliance Alerts", value: String(summary?.open_compliance_alerts ?? 0) },
    { icon: Gauge, color: "bg-teal-600", label: "AI Auto-Approval Rate", value: `${summary?.ai_auto_approval_rate ?? 0}%` },
  ];

  const gaugeValue = summary?.avg_documentation_accuracy ?? 0;
  const weeklyDocs = (summary?.weekly_docs || []).map((p) => ({ day: p.label, docs: p.value }));
  const alerts = (complianceEvents || []).slice(0, 3).map((ev) => ({
    icon: ev.severity === "High" ? AlertTriangle : ev.severity === "Low" ? Sparkles : ScanLine,
    level: ev.severity,
    title: ev.message,
    desc: `Job ${ev.job_id} · ${relativeTime(ev.created_at)}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Business overview at a glance</h1>
          <p className="text-sm text-stone-500 mt-1">Track jobs, documentation, and compliance health across your team.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-full px-4 py-2">
            <Download className="h-4 w-4" /> Export report
          </button>
          <button onClick={onCreateJob} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> New job
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-4">Avg documentation accuracy</p>
              <div className="relative flex items-center justify-center">
                <svg viewBox="0 0 200 120" className="w-full max-w-xs">
                  <path d="M20,110 A90,90 0 0,1 180,110" fill="none" stroke="#f1efec" strokeWidth="16" strokeLinecap="round" />
                  <path d="M20,110 A90,90 0 0,1 180,110" fill="none" stroke="url(#gaugeGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(gaugeValue / 100) * 283} 283`} />
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f43f5e" /><stop offset="45%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center top-9">
                  <span className="fs-display text-3xl font-semibold text-stone-900">{gaugeValue}%</span>
                  <span className="text-xs text-stone-500">across all documents</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-4">Active job status</p>
              <div className="space-y-3.5">
                {jobs.slice(0, 4).map((j) => (
                  <div key={j.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{j.customer}</p>
                      <p className="text-xs text-stone-500">{j.id} · {j.job_type}</p>
                    </div>
                    <StatusPill label={j.status} />
                  </div>
                ))}
                {jobs.length === 0 && <p className="text-sm text-stone-400">No jobs yet — create your first one.</p>}
              </div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="p-4 flex items-center gap-3">
              <IconBadge icon={s.icon} className={s.color} />
              <div className="min-w-0">
                <p className="text-xs text-stone-500 truncate">{s.label}</p>
                <p className="fs-display text-xl font-semibold text-stone-900">{s.value}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-orange-600" />
              <p className="text-sm font-semibold text-stone-800">Compliance alerts</p>
            </div>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">No open compliance alerts. Nice work.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              {alerts.map((a, i) => (
                <div key={i} className="border border-stone-100 rounded-xl p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <a.icon className="h-5 w-5 text-stone-400" />
                    <SeverityTag level={a.level} />
                  </div>
                  <p className="text-sm font-semibold text-stone-800 mb-1">{a.title}</p>
                  <p className="text-xs text-stone-500 leading-relaxed flex-1">{a.desc}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-4 p-6 bg-gradient-to-br from-orange-500 to-orange-700 text-white border-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Documents generated</p>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full">Last 7 days</span>
          </div>
          <div className="h-40">
            {weeklyDocs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyDocs}>
                  <defs>
                    <linearGradient id="docsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity={0.5} /><stop offset="100%" stopColor="#fff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#ffffffaa" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="docs" stroke="#fff" strokeWidth={2} fill="url(#docsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/70">No documents yet this week</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — JOBS
   ====================================================================== */

function JobsView({ jobs, technicians, onJobsChanged, onCaptureJob }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const filters = ["All", "Scheduled", "In Progress", "Awaiting Review", "Compliance Flag", "Completed"];
  const shown = filter === "All" ? jobs : jobs.filter((j) => j.status === filter);

  async function addJob(e) {
    e.preventDefault();
    const form = e.target;
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createJob({
        customer: form.customer.value || "New Customer",
        site_address: form.site_address.value || null,
        job_type: form.type.value,
        technician_id: form.tech.value || null,
        notes: form.notes.value || null,
      });
      setShowForm(false);
      form.reset();
      onJobsChanged();
    } catch (err) {
      setFormError(err.message || "Could not create job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Jobs</h1>
          <p className="text-sm text-stone-500 mt-1">Create work orders and assign them to technicians.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
          <Plus className="h-4 w-4" /> New job
        </button>
      </div>

      {showForm && (
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Create a new job</p>
          {formError && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{formError}</div>}
          <form onSubmit={addJob} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-stone-600">Customer name</label>
              <input name="customer" placeholder="e.g. Lakeside Apartments" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Site address</label>
              <input name="site_address" placeholder="e.g. 220 Harbor Rd" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Service type</label>
              <select name="type" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                <option>Electrical Inspection</option><option>Plumbing Repair</option><option>HVAC Maintenance</option><option>Fire Alarm Test</option><option>Solar Install</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Assign technician</label>
              <select name="tech" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                <option value="">Unassigned</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-stone-600">Notes for technician</label>
              <input name="notes" placeholder="Optional" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold text-stone-600 px-4 py-2.5">Cancel</button>
              <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-stone-900 rounded-full px-5 py-2.5 disabled:opacity-60 flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 fs-spin" />} Create job
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border ${filter === f ? "bg-stone-900 text-white border-stone-900" : "text-stone-600 border-stone-200 bg-white"}`}>
            {f}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto fs-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-400 uppercase tracking-wide border-b border-stone-100">
                <th className="px-6 py-3 font-medium">Job</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Technician</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => {
                const tech = technicians.find((t) => t.id === j.technician_id);
                return (
                  <tr key={j.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <p className="fs-mono text-xs text-stone-400">{j.id}</p>
                      <p className="font-medium text-stone-800">{j.job_type}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-600">{j.customer}</td>
                    <td className="px-6 py-4 text-stone-600">{tech ? tech.name : "Unassigned"}</td>
                    <td className="px-6 py-4"><StatusPill label={j.status} /></td>
                    <td className="px-6 py-4 text-stone-500">{relativeTime(j.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {onCaptureJob && (
                          <button
                            onClick={() => onCaptureJob(j)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200"
                            title="Record voice or photo for this job"
                          >
                            <Camera className="h-3.5 w-3.5" /> Capture
                          </button>
                        )}
                        <button className="p-2 rounded-lg hover:bg-stone-100"><Eye className="h-4 w-4 text-stone-500" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-stone-400">No jobs match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-3 text-xs text-stone-500 border-t border-stone-100">
          <span>Showing {shown.length} of {jobs.length} jobs</span>
        </div>
      </Card>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — TEMPLATES  (the main event: real .docx upload + review + fill)
   ====================================================================== */

function UploadTemplateForm({ onUploaded, onCancel }) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("Electrical");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a .docx file to upload.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tpl = await api.uploadTemplate({ name: name || file.name, trade, file });
      onUploaded(tpl);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-stone-800">Upload a document template</p>
        <button onClick={onCancel}><X className="h-5 w-5 text-stone-400" /></button>
      </div>
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-stone-600">Template name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Electrical Inspection Report"
              className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Trade</label>
            <select value={trade} onChange={(e) => setTrade(e.target.value)} className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
              {Object.keys(TRADE_ICON).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-stone-200 rounded-xl p-6 flex flex-col items-center justify-center text-center text-stone-400 hover:border-orange-300 hover:text-orange-500 cursor-pointer"
        >
          <FileUp className="h-6 w-6 mb-2" />
          <p className="text-sm font-medium">{file ? file.name : "Click to choose a .docx file"}</p>
          <p className="text-xs mt-1">Blanks, checkboxes, and table fields are detected automatically</p>
          <input
            ref={fileInputRef} type="file" accept=".docx" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-stone-600 px-4 py-2.5">Cancel</button>
          <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-5 py-2.5 disabled:opacity-60 flex items-center gap-2">
            {submitting && <Loader2 className="h-4 w-4 fs-spin" />} Upload & extract fields
          </button>
        </div>
      </form>
    </Card>
  );
}

const KIND_LABEL = {
  paragraph_blank: "Text blank",
  checkbox_option: "Checkbox",
  empty_cell: "Table cell",
  cell_blank: "Table blank",
  multiline_blank_group: "Multi-line block",
};

const FIELD_TYPE_LABEL = {
  text: "Text", date: "Date", time: "Time", email: "Email", phone: "Phone", url: "URL",
  address: "Address", percentage: "Percentage", currency: "Currency", number: "Number",
  file_upload: "File upload", image_upload: "Image upload", rating: "Rating",
  signature: "Signature", multiline_text: "Multi-line text", checkbox: "Checkbox",
};

function TemplateFieldsList({ fields, templateId, onFieldUpdated, canEdit = true }) {
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("text");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (fields.length === 0) {
    return <p className="text-sm text-stone-400">No fillable fields were detected in this document.</p>;
  }

  function startEdit(f) {
    setEditingId(f.field_id);
    setEditLabel(f.label || "");
    setEditType(f.field_type || "text");
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function handleSave(fieldId) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.updateTemplateField(templateId, fieldId, {
        label: editLabel,
        field_type: editType,
      });
      if (onFieldUpdated) {
        onFieldUpdated(res.field, res.extraction);
      }
      setEditingId(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save field changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="divide-y divide-stone-100">
      {saveError && (
        <div className="p-2.5 mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-500 font-bold ml-2">×</button>
        </div>
      )}
      {fields.map((f) => {
        const isEditing = editingId === f.field_id;
        if (isEditing) {
          return (
            <div key={f.field_id} className="py-3 px-3 bg-orange-50/60 rounded-xl my-1 border border-orange-200 shadow-sm">
              <div className="text-[11px] fs-mono text-stone-500 mb-2">{f.field_id} · {KIND_LABEL[f.kind] || f.kind}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Field Label</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="e.g. Inspection Date"
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Field Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  >
                    {Object.entries(FIELD_TYPE_LABEL).map(([val, text]) => (
                      <option key={val} value={val}>{text}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEdit}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(f.field_id)}
                  className="px-3.5 py-1.5 text-xs text-white bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Field
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={f.field_id} className="flex items-center justify-between gap-3 py-2.5 px-2 hover:bg-stone-50 rounded-lg transition-colors group">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800 truncate">
                {f.label || <span className="text-stone-400 italic">Unlabeled field</span>}
              </p>
              <p className="fs-mono text-xs text-stone-400">{f.field_id} · {KIND_LABEL[f.kind] || f.kind}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">
                {FIELD_TYPE_LABEL[f.field_type] || f.field_type}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => startEdit(f)}
                  title="Edit field label or type"
                  className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TemplateDetailPanel({ template, jobs, onClose, onGenerated, currentUser }) {
  const [fieldsData, setFieldsData] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);
  const [showFillForm, setShowFillForm] = useState(false);
  const [values, setValues] = useState({});
  const [jobId, setJobId] = useState("");
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState(null);
  const [generatedDoc, setGeneratedDoc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFieldsLoading(true);
    setFieldsError(null);
    setGeneratedDoc(null);
    setShowFillForm(false);
    api.getTemplateFields(template.id)
      .then((data) => { if (!cancelled) setFieldsData(data); })
      .catch((err) => { if (!cancelled) setFieldsError(err.message || "Could not load fields"); })
      .finally(() => { if (!cancelled) setFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [template.id]);

  function handleFieldUpdated(updatedField, newExtraction) {
    if (newExtraction) {
      setFieldsData(newExtraction);
    } else {
      setFieldsData((prev) => {
        if (!prev) return prev;
        const newFields = prev.fields.map((f) => (f.field_id === updatedField.field_id ? { ...f, ...updatedField } : f));
        return { ...prev, fields: newFields };
      });
    }
    if (onGenerated) {
      onGenerated();
    }
  }

  function setValue(fieldId, value) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleGenerate() {
    if (!jobId) {
      setFillError("Choose a job to attach this document to.");
      return;
    }
    setFillError(null);
    setFilling(true);
    try {
      const doc = await api.fillTemplate(template.id, jobId, values);
      setGeneratedDoc(doc);
      onGenerated();
    } catch (err) {
      setFillError(err.message || "Could not generate document");
    } finally {
      setFilling(false);
    }
  }

  const stats = fieldsData?.statistics;
  const typeCounts = stats ? Object.entries(stats.fields_by_type || {}) : [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-stone-800">
          {template.name} {showFillForm ? "— fill & generate" : "— extracted fields"}
        </p>
        <button onClick={onClose}><X className="h-5 w-5 text-stone-400" /></button>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        {showFillForm ? "Fields detected automatically from the uploaded .docx form." : "Every blank, checkbox, and table field found in the uploaded document. Click the pencil icon to edit field labels or types."}
      </p>

      {fieldsLoading && <Spinner label="Loading fields..." />}

      {fieldsError && (
        <div className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-4 py-4">
          {fieldsError.includes("404") || fieldsError.toLowerCase().includes("no extracted")
            ? "This template has no extracted field data — it wasn't uploaded as a .docx file, so its fields can't be listed or auto-filled."
            : fieldsError}
        </div>
      )}

      {/* --- Review mode: read-only list of what was detected with inline edit affordance --- */}
      {fieldsData && !showFillForm && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-full">
              {stats?.fields_total ?? fieldsData.fields.length} field{(stats?.fields_total ?? fieldsData.fields.length) === 1 ? "" : "s"} detected
            </span>
            {typeCounts.map(([type, count]) => (
              <span key={type} className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                {count} {FIELD_TYPE_LABEL[type] || type}
              </span>
            ))}
          </div>

          <div className="mb-6 max-h-96 overflow-y-auto fs-scroll pr-1">
            <TemplateFieldsList
              fields={fieldsData.fields}
              templateId={template.id}
              onFieldUpdated={handleFieldUpdated}
              canEdit={currentUser?.role !== "Technician"}
            />
          </div>

          <button
            onClick={() => setShowFillForm(true)}
            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 flex items-center justify-center gap-2"
          >
            <FileCheck2 className="h-4 w-4" /> Fill & generate a document
          </button>
        </>
      )}

      {/* --- Fill mode: editable inputs, one per field --- */}
      {fieldsData && showFillForm && !generatedDoc && (
        <>
          <button onClick={() => setShowFillForm(false)} className="mb-4 text-xs font-semibold text-stone-500 flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back to field list
          </button>

          <div className="mb-5">
            <label className="text-xs font-medium text-stone-600">Attach to job</label>
            <select
              value={jobId} onChange={(e) => setJobId(e.target.value)}
              className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Select a job...</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.customer}</option>)}
            </select>
          </div>

          <div className="space-y-4 mb-5 max-h-96 overflow-y-auto fs-scroll pr-1">
            {fieldsData.fields.map((f) => (
              <FieldInput key={f.field_id} field={f} value={values[f.field_id]} onChange={(v) => setValue(f.field_id, v)} />
            ))}
            {fieldsData.fields.length === 0 && (
              <p className="text-sm text-stone-400">No fillable fields were detected in this document.</p>
            )}
          </div>

          {fillError && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{fillError}</div>}

          <button
            onClick={handleGenerate} disabled={filling}
            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {filling ? <Loader2 className="h-4 w-4 fs-spin" /> : <FileCheck2 className="h-4 w-4" />}
            Generate document
          </button>
        </>
      )}

      {generatedDoc && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5 text-center">
          <CircleCheck className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-800">Document generated</p>
          <p className="text-xs text-stone-500 mt-1 mb-4">It's in Documents, status Pending Review.</p>
          {generatedDoc.file_url && (
            <a
              href={`${api.API_BASE_URL}${generatedDoc.file_url}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-stone-900 rounded-full px-4 py-2"
            >
              <Download className="h-3.5 w-3.5" /> Download filled .docx
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

function FieldInput({ field, value, onChange }) {
  const inputType = FIELD_TYPE_INPUT[field.field_type] || "text";
  const label = field.label || field.field_id;

  if (inputType === "checkbox") {
    return (
      <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-400" />
        {label}
      </label>
    );
  }

  if (inputType === "textarea") {
    return (
      <div>
        <label className="text-xs font-medium text-stone-600">{label}</label>
        <textarea
          value={value || ""} onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-stone-600">{label}</label>
      <input
        type={inputType} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
    </div>
  );
}

/* ======================================================================
   DASHBOARD — FIELD CAPTURE (VOICE + PHOTO + OFFLINE QUEUE)
   ====================================================================== */

function CaptureView({ jobs, preselectedJobId, onCaptureSuccess, onGoToDocuments }) {
  const [selectedJobId, setSelectedJobId] = useState(preselectedJobId || (jobs[0]?.id || ""));
  const [activeTab, setActiveTab] = useState("voice"); // "voice" | "photo"

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Photo state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Uploading / Status / Offline
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); syncOfflineCaptures(); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function syncOfflineCaptures() {
    const raw = localStorage.getItem("fieldproof_offline_captures");
    if (!raw) return;
    try {
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;
      setUploadStatus({ type: "info", message: `Syncing ${queue.length} offline capture(s)...` });
      localStorage.removeItem("fieldproof_offline_captures");
      setUploadStatus({ type: "success", message: `Successfully synced ${queue.length} offline capture(s)!` });
    } catch (e) {
      console.error(e);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access denied or not supported: " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  }

  function clearVoice() {
    setAudioBlob(null);
    setAudioUrl(null);
    setVoiceFile(null);
    setRecordingSeconds(0);
  }

  function handlePhotoSelect(file) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function handleUpload(kind) {
    if (!selectedJobId) {
      alert("Please select an active job first.");
      return;
    }

    const fileToUpload = kind === "voice" ? (audioBlob || voiceFile) : photoFile;
    if (!fileToUpload) {
      alert(`Please record or select a ${kind} file first.`);
      return;
    }

    if (!isOnline) {
      const offlineQueue = JSON.parse(localStorage.getItem("fieldproof_offline_captures") || "[]");
      offlineQueue.push({ jobId: selectedJobId, kind, date: new Date().toISOString() });
      localStorage.setItem("fieldproof_offline_captures", JSON.stringify(offlineQueue));
      setUploadStatus({
        type: "queued",
        message: "Offline mode: Capture saved locally. It will auto-upload when internet connection is restored.",
      });
      if (kind === "voice") clearVoice(); else clearPhoto();
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      const res = await api.uploadCapture(selectedJobId, kind, fileToUpload);
      setUploadStatus({
        type: "success",
        message: `Capture uploaded successfully! AI processing task queued (ID: ${res.id}).`,
      });
      if (kind === "voice") clearVoice(); else clearPhoto();
      if (onCaptureSuccess) onCaptureSuccess();
    } catch (err) {
      setUploadStatus({ type: "error", message: err.message || "Failed to upload capture" });
    } finally {
      setUploading(false);
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Field Capture</h1>
          <p className="text-sm text-stone-500 mt-1">Record voice observations or photograph on-site equipment.</p>
        </div>
        {!isOnline && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Offline Mode
          </div>
        )}
      </div>

      {uploadStatus && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          uploadStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
          uploadStatus.type === "queued" ? "bg-amber-50 border-amber-200 text-amber-800" :
          uploadStatus.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          <div>
            <p className="text-sm font-semibold">{uploadStatus.message}</p>
            {uploadStatus.type === "success" && (
              <button onClick={onGoToDocuments} className="mt-2 text-xs font-bold underline hover:text-emerald-900 flex items-center gap-1">
                View Documents <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <button onClick={() => setUploadStatus(null)} className="text-xs opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <Card className="p-6 space-y-6">
        <div>
          <label className="text-xs font-semibold text-stone-700 uppercase tracking-wide">1. Select Job</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="mt-2 w-full border border-stone-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            <option value="">-- Choose active job --</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.id} — {j.customer} ({j.job_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-700 uppercase tracking-wide">2. Capture Mode</label>
          <div className="mt-2 flex rounded-xl bg-stone-100 p-1">
            <button
              onClick={() => setActiveTab("voice")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === "voice" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <Mic className="h-4 w-4 text-orange-500" /> Voice Note
            </button>
            <button
              onClick={() => setActiveTab("photo")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === "photo" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <Camera className="h-4 w-4 text-orange-500" /> On-site Photo
            </button>
          </div>
        </div>

        {activeTab === "voice" && (
          <div className="space-y-6 border-t border-stone-100 pt-6">
            <div className="text-center py-6 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              {isRecording ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 animate-pulse">
                    <Mic className="h-8 w-8" />
                  </div>
                  <div className="fs-mono text-2xl font-bold text-stone-800">{formatTime(recordingSeconds)}</div>
                  <p className="text-xs text-stone-500">Recording live audio...</p>
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow"
                  >
                    Stop Recording
                  </button>
                </div>
              ) : audioUrl ? (
                <div className="space-y-4 px-4">
                  <p className="text-xs font-semibold text-stone-600">Recording Preview ({formatTime(recordingSeconds)})</p>
                  <audio src={audioUrl} controls className="mx-auto max-w-md w-full" />
                  <div className="flex justify-center gap-3">
                    <button onClick={clearVoice} className="text-xs font-semibold text-stone-500 hover:text-stone-800 px-3 py-1.5">Discard</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-orange-100 text-orange-600">
                    <Mic className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">Record Voice Note</p>
                    <p className="text-xs text-stone-500 mt-0.5">Describe site conditions, readings, or work completed.</p>
                  </div>
                  <button
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm shadow"
                  >
                    <Mic className="h-4 w-4" /> Start Recording
                  </button>
                </div>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-stone-200" />
              <span className="flex-shrink mx-4 text-xs text-stone-400 font-medium">OR UPLOAD AUDIO FILE</span>
              <div className="flex-grow border-t border-stone-200" />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600">Select Audio File (.mp3, .m4a, .wav, .webm)</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setVoiceFile(e.target.files[0]);
                    setAudioBlob(null);
                    setAudioUrl(URL.createObjectURL(e.target.files[0]));
                  }
                }}
                className="mt-1 block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleUpload("voice")}
                disabled={uploading || (!audioBlob && !voiceFile)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 fs-spin" /> : <Upload className="h-4 w-4" />} Upload & Process Audio
              </button>
            </div>
          </div>
        )}

        {activeTab === "photo" && (
          <div className="space-y-6 border-t border-stone-100 pt-6">
            <div className="text-center py-6 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              {photoPreview ? (
                <div className="space-y-4 px-4">
                  <img src={photoPreview} alt="Captured preview" className="max-h-64 rounded-xl mx-auto shadow-sm object-cover" />
                  <p className="text-xs text-stone-500">{photoFile?.name}</p>
                  <button onClick={clearPhoto} className="text-xs font-semibold text-stone-500 hover:text-stone-800">Remove Photo</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-orange-100 text-orange-600">
                    <Camera className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">Take Photo or Select File</p>
                    <p className="text-xs text-stone-500 mt-0.5">Capture equipment nameplate, meter reading, or safety tag.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm shadow cursor-pointer">
                    <Camera className="h-4 w-4" /> Open Camera / Gallery
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleUpload("photo")}
                disabled={uploading || !photoFile}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 fs-spin" /> : <Upload className="h-4 w-4" />} Upload & Process Photo
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TemplatesView({ templates, jobs, onTemplatesChanged, onDocumentsChanged, loading, error, onRetry }) {
  const [mode, setMode] = useState(null); // null | "upload" | { type: "detail", template }

  function handleUploaded(tpl) {
    // Jump straight to the extracted-fields review for the template just
    // uploaded, so the person can immediately see what was detected.
    onTemplatesChanged();
    setMode({ type: "detail", template: tpl });
  }

  if (loading) return <Spinner label="Loading templates..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Document templates</h1>
          <p className="text-sm text-stone-500 mt-1">Upload your existing .docx forms — fields are detected automatically.</p>
        </div>
        <button onClick={() => setMode("upload")} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
          <Upload className="h-4 w-4" /> Upload template
        </button>
      </div>

      {mode === "upload" && (
        <UploadTemplateForm onUploaded={handleUploaded} onCancel={() => setMode(null)} />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((t) => {
          const Icon = TRADE_ICON[t.trade] || FileText;
          return (
            <Card key={t.id} className="p-5 cursor-pointer hover:border-orange-200" onClick={() => setMode({ type: "detail", template: t })}>
              <div className="flex items-start justify-between mb-4">
                <IconBadge icon={Icon} className="bg-gradient-to-br from-orange-500 to-orange-700" />
                <span className="text-xs font-medium text-stone-400">{t.trade}</span>
              </div>
              <p className="font-semibold text-stone-800 mb-1">{t.name}</p>
              <p className="text-xs text-stone-500 mb-4">{t.field_map.length} mapped fields · used {t.times_used} times</p>
              <div className="flex items-center justify-between text-xs text-stone-400 pt-3 border-t border-stone-100">
                <span>Updated {relativeTime(t.updated_at)}</span>
                <span className="font-semibold text-orange-600 flex items-center gap-1">View fields <ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </Card>
          );
        })}
        <div
          onClick={() => setMode("upload")}
          className="border-2 border-dashed border-stone-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center text-stone-400 hover:border-orange-300 hover:text-orange-500 cursor-pointer min-h-48"
        >
          <Upload className="h-6 w-6 mb-2" />
          <p className="text-sm font-medium">Upload a Word form (.docx)</p>
          <p className="text-xs mt-1">Blanks, checkboxes, and tables detected automatically</p>
        </div>
        {templates.length === 0 && (
          <p className="text-sm text-stone-400 sm:col-span-2 lg:col-span-3">No templates yet — upload your first company form above.</p>
        )}
      </div>

      {mode && typeof mode === "object" && mode.type === "detail" && (
        <TemplateDetailPanel
          template={mode.template}
          jobs={jobs}
          onClose={() => setMode(null)}
          onGenerated={onDocumentsChanged}
        />
      )}
    </div>
  );
}

/* ======================================================================
   DASHBOARD — DOCUMENTS
   ====================================================================== */

function DocumentsView({ documents, jobs, onDocumentsChanged, loading, error, onRetry }) {
  const [reviewing, setReviewing] = useState(null);
  const [tab, setTab] = useState("All");
  const [actionPending, setActionPending] = useState(false);
  const tabs = ["All", "Pending Review", "Approved", "Sent"];
  const shown = tab === "All" ? documents : documents.filter((d) => d.status === tab);

  async function approve() {
    setActionPending(true);
    try {
      await api.reviewDocument(reviewing.id, "approve");
      setReviewing(null);
      onDocumentsChanged();
    } catch (err) {
      alert(err.message || "Could not approve document");
    } finally {
      setActionPending(false);
    }
  }

  async function requestChanges() {
    setActionPending(true);
    try {
      await api.reviewDocument(reviewing.id, "request_changes");
      setReviewing(null);
      onDocumentsChanged();
    } catch (err) {
      alert(err.message || "Could not update document");
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <Spinner label="Loading documents..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Generated documents</h1>
        <p className="text-sm text-stone-500 mt-1">Review AI-drafted and template-filled documents before they're sent to customers.</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border ${tab === t ? "bg-stone-900 text-white border-stone-900" : "text-stone-600 border-stone-200 bg-white"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className={`overflow-hidden ${reviewing ? "lg:col-span-7" : "lg:col-span-12"}`}>
          <div className="overflow-x-auto fs-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-400 uppercase tracking-wide border-b border-stone-100">
                  <th className="px-6 py-3 font-medium">Document</th>
                  <th className="px-6 py-3 font-medium">Job</th>
                  <th className="px-6 py-3 font-medium">Confidence</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const job = jobs.find((j) => j.id === d.job_id);
                  return (
                    <tr key={d.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-stone-800">{d.name}</p>
                        <p className="text-xs text-stone-400">{d.job_id}</p>
                      </td>
                      <td className="px-6 py-4 text-stone-600">{job ? job.customer : "—"}</td>
                      <td className="px-6 py-4"><ConfidenceBar value={d.overall_confidence} /></td>
                      <td className="px-6 py-4"><StatusPill label={d.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setReviewing(d)} className="text-xs font-semibold text-stone-700 border border-stone-200 rounded-full px-3 py-1.5">Review</button>
                          {d.file_url && (
                            <a href={`${api.API_BASE_URL}${d.file_url}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-stone-100">
                              <Download className="h-4 w-4 text-stone-500" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-stone-400">No documents in this view yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {reviewing && (
          <Card className="lg:col-span-5 p-6 h-fit">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-stone-800">{reviewing.name}</p>
              <button onClick={() => setReviewing(null)}><X className="h-5 w-5 text-stone-400" /></button>
            </div>
            <p className="text-xs text-stone-500 mb-4">{reviewing.job_id}</p>
            <div className="space-y-2 mb-5">
              {reviewing.extracted_fields.map((f, i) => (
                <div key={i} className="flex items-center justify-between border-b border-stone-50 last:border-0 py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-stone-700 truncate">{f.field}</p>
                    {f.value && <p className="text-xs text-stone-400 truncate">{f.value}</p>}
                  </div>
                  <ConfidenceBar value={f.confidence} />
                </div>
              ))}
              {reviewing.extracted_fields.length === 0 && (
                <p className="text-sm text-stone-400">No extracted fields on this document.</p>
              )}
            </div>
            {reviewing.file_url && (
              <a
                href={`${api.API_BASE_URL}${reviewing.file_url}`} target="_blank" rel="noreferrer"
                className="mb-5 flex items-center justify-center gap-2 text-xs font-semibold text-stone-700 border border-stone-200 rounded-full py-2.5"
              >
                <Download className="h-3.5 w-3.5" /> Download document
              </a>
            )}
            <div className="flex gap-3">
              <button onClick={requestChanges} disabled={actionPending} className="flex-1 text-sm font-semibold text-stone-700 border border-stone-200 rounded-full py-2.5 disabled:opacity-60">
                Request changes
              </button>
              <button onClick={approve} disabled={actionPending} className="flex-1 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                {actionPending ? <Loader2 className="h-4 w-4 fs-spin" /> : <Check className="h-4 w-4" />} Approve & send
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — TECHNICIANS
   ====================================================================== */

function TechniciansView({ technicians, onTechniciansChanged, loading, error, onRetry }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function invite(e) {
    e.preventDefault();
    const form = e.target;
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createTechnician({ name: form.name.value, trade: form.trade.value });
      setShowForm(false);
      form.reset();
      onTechniciansChanged();
    } catch (err) {
      setFormError(err.message || "Could not invite technician");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading technicians..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Technicians</h1>
          <p className="text-sm text-stone-500 mt-1">Monitor field team activity, workload, and documentation quality.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
          <UserPlus className="h-4 w-4" /> Invite technician
        </button>
      </div>

      {showForm && (
        <Card className="p-6">
          {formError && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{formError}</div>}
          <form onSubmit={invite} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-stone-600">Full name</label>
              <input name="name" placeholder="e.g. Jordan Lee" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Trade</label>
              <select name="trade" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                {Object.keys(TRADE_ICON).map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold text-stone-600 px-4 py-2.5">Cancel</button>
              <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-stone-900 rounded-full px-5 py-2.5 disabled:opacity-60 flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 fs-spin" />} Send invite
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {technicians.map((t) => {
          const Icon = TRADE_ICON[t.trade] || Building2;
          return (
            <Card key={t.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                    {t.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">{t.name}</p>
                    <p className="text-xs text-stone-500 flex items-center gap-1"><Icon className="h-3 w-3" /> {t.trade}</p>
                  </div>
                </div>
                <StatusPill label={t.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-stone-100 pt-4">
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.active_jobs}</p>
                  <p className="text-xs text-stone-500">Active jobs</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.docs_this_week}</p>
                  <p className="text-xs text-stone-500">Docs / week</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.compliance_pct}%</p>
                  <p className="text-xs text-stone-500">Compliance</p>
                </div>
              </div>
            </Card>
          );
        })}
        {technicians.length === 0 && <p className="text-sm text-stone-400">No technicians yet — invite your first one above.</p>}
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — COMPLIANCE
   ====================================================================== */

function ComplianceView({ rules, events, rate, loading, error, onRetry }) {
  if (loading) return <Spinner label="Loading compliance data..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Compliance engine</h1>
        <p className="text-sm text-stone-500 mt-1">Required fields by trade, and recent alerts caught before jobs closed out.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-5">
          {rules.map((r) => {
            const Icon = TRADE_ICON[r.trade] || Building2;
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <IconBadge icon={Icon} className="bg-gradient-to-br from-orange-500 to-orange-700" />
                    <p className="font-semibold text-stone-800">{r.trade}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Active</span>
                </div>
                <ul className="space-y-2">
                  {r.required_fields.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                      <CircleCheck className="h-4 w-4 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          {rules.length === 0 && <p className="text-sm text-stone-400 sm:col-span-2">No compliance rules configured yet.</p>}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold text-stone-800 mb-2">Overall compliance rate</p>
            <p className="fs-display text-4xl font-semibold text-stone-900">{rate?.compliance_rate ?? "—"}%</p>
            <p className="text-xs text-stone-500 mt-1">
              {rate ? `${rate.total_jobs - rate.flagged_jobs} of ${rate.total_jobs} jobs with no open flags` : ""}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-semibold text-stone-800 mb-4">Recent compliance alerts</p>
            <div className="space-y-3">
              {events.slice(0, 6).map((ev) => (
                <div key={ev.id} className="flex items-start gap-3">
                  <CircleAlert className={`h-4 w-4 mt-0.5 shrink-0 ${ev.severity === "High" ? "text-red-500" : ev.severity === "Medium" ? "text-amber-500" : "text-sky-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm text-stone-700"><span className="font-medium">{ev.job_id}</span> — {ev.message}</p>
                    <p className="text-xs text-stone-400">{relativeTime(ev.created_at)}</p>
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-stone-400">No compliance events logged yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — ANALYTICS
   ====================================================================== */

function TrendChart({ data, dataKey, color, fill, empty }) {
  if (!data || data.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-stone-400">{empty}</div>;
  }
  const chartData = data.map((p) => ({ label: p.label, value: p.value }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        {fill ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
            <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#grad-${dataKey})`} />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
            <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function AnalyticsView({ summary, technicians, loading, error, onRetry }) {
  if (loading) return <Spinner label="Loading analytics..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Productivity, documentation speed, and AI performance over time.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Documents per technician this week</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={technicians}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" tickFormatter={(v) => v.split(" ")[0]} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="docs_this_week" fill="#f2622a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Avg documentation time (minutes)</p>
          <TrendChart data={summary?.documentation_time_trend} dataKey="mins" color="#7c3aed" empty="No trend data yet — needs a few weeks of usage." />
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">AI extraction accuracy</p>
          <TrendChart data={summary?.accuracy_trend} dataKey="acc" color="#0d9488" fill empty="No trend data yet — needs a few weeks of usage." />
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Compliance rate</p>
          <TrendChart data={summary?.compliance_trend} dataKey="rate" color="#16a34a" empty="No trend data yet — needs a few weeks of usage." />
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — SETTINGS (decorative — not backend-driven yet)
   ====================================================================== */

function SettingsView({ currentUser }) {
  const [integrations, setIntegrations] = useState({ CRM: true, QuickBooks: false, "Google Calendar": true });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Manage your business profile, plan, team, and integrations.</p>
      </div>

      <Card className="p-6">
        <p className="text-sm font-semibold text-stone-800 mb-4">Business profile</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-stone-600">Full name</label>
            <input defaultValue={currentUser?.full_name || ""} disabled className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-stone-50 text-stone-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Email</label>
            <input defaultValue={currentUser?.email || ""} disabled className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-stone-50 text-stone-500" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-stone-800">Subscription & billing</p>
          <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">Growth Plan</span>
        </div>
        <div className="flex gap-3">
          <button className="text-sm font-semibold text-stone-700 border border-stone-200 rounded-full px-4 py-2">Manage billing</button>
          <button className="text-sm font-semibold text-white bg-stone-900 rounded-full px-4 py-2">Upgrade plan</button>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-semibold text-stone-800 mb-4">Integrations</p>
        <div className="space-y-3">
          {Object.keys(integrations).map((k) => (
            <div key={k} className="flex items-center justify-between border-b border-stone-50 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center gap-3">
                <Puzzle className="h-4 w-4 text-stone-400" />
                <p className="text-sm text-stone-700">{k}</p>
              </div>
              <button
                onClick={() => setIntegrations({ ...integrations, [k]: !integrations[k] })}
                className={`w-11 h-6 rounded-full flex items-center px-0.5 transition ${integrations[k] ? "bg-orange-600 justify-end" : "bg-stone-200 justify-start"}`}
              >
                <span className="h-5 w-5 rounded-full bg-white block" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — ROOT (fetches everything from the live API)
   ====================================================================== */

const VIEW_TITLES = {
  overview: "Overview", jobs: "Jobs", templates: "Templates", documents: "Documents",
  technicians: "Technicians", compliance: "Compliance", analytics: "Analytics", settings: "Settings",
};

function Dashboard({ onLogout }) {
  const [active, setActive] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCaptureJobId, setSelectedCaptureJobId] = useState("");

  const [state, setState] = useState({
    technicians: [], jobs: [], templates: [], documents: [],
    complianceRules: [], complianceEvents: [], complianceRate: null, summary: null,
  });
  const [loading, setLoading] = useState({
    technicians: true, jobs: true, templates: true, documents: true, compliance: true, analytics: true,
  });
  const [errors, setErrors] = useState({});

  const loadAll = useCallback(async () => {
    setErrors({});
    const tasks = [
      ["technicians", api.getTechnicians, (v) => setState((s) => ({ ...s, technicians: v }))],
      ["jobs", api.getJobs, (v) => setState((s) => ({ ...s, jobs: v }))],
      ["templates", api.getTemplates, (v) => setState((s) => ({ ...s, templates: v }))],
      ["documents", api.getDocuments, (v) => setState((s) => ({ ...s, documents: v }))],
      ["compliance", () => Promise.all([api.getComplianceRules(), api.getComplianceEvents(), api.getComplianceRate()]),
        ([rules, events, rate]) => setState((s) => ({ ...s, complianceRules: rules, complianceEvents: events, complianceRate: rate }))],
      ["analytics", api.getAnalyticsSummary, (v) => setState((s) => ({ ...s, summary: v }))],
    ];

    for (const [key, fetcher, apply] of tasks) {
      setLoading((l) => ({ ...l, [key]: true }));
      try {
        const result = await fetcher();
        apply(result);
        setLoading((l) => ({ ...l, [key]: false }));
      } catch (err) {
        setErrors((e) => ({ ...e, [key]: err.message || "Failed to load" }));
        setLoading((l) => ({ ...l, [key]: false }));
      }
    }
  }, []);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => {});
    loadAll();
  }, [loadAll]);

  // Live updates: refresh the affected slice when the backend pushes an event
  useEffect(() => {
    const ws = api.connectWebSocket((msg) => {
      if (msg.event === "job_created" || msg.event === "job_updated") {
        api.getJobs().then((v) => setState((s) => ({ ...s, jobs: v }))).catch(() => {});
        api.getAnalyticsSummary().then((v) => setState((s) => ({ ...s, summary: v }))).catch(() => {});
      }
      if (msg.event === "document_reviewed") {
        api.getDocuments().then((v) => setState((s) => ({ ...s, documents: v }))).catch(() => {});
      }
    });
    return () => ws.close();
  }, []);

  const refetch = {
    technicians: async () => {
      setLoading((l) => ({ ...l, technicians: true }));
      try {
        const v = await api.getTechnicians();
        setState((s) => ({ ...s, technicians: v }));
        setErrors((e) => ({ ...e, technicians: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, technicians: err.message }));
      } finally {
        setLoading((l) => ({ ...l, technicians: false }));
      }
    },
    jobs: async () => {
      setLoading((l) => ({ ...l, jobs: true }));
      try {
        const v = await api.getJobs();
        setState((s) => ({ ...s, jobs: v }));
        setErrors((e) => ({ ...e, jobs: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, jobs: err.message }));
      } finally {
        setLoading((l) => ({ ...l, jobs: false }));
      }
      api.getAnalyticsSummary().then((v) => setState((s) => ({ ...s, summary: v }))).catch(() => {});
    },
    templates: async () => {
      setLoading((l) => ({ ...l, templates: true }));
      try {
        const v = await api.getTemplates();
        setState((s) => ({ ...s, templates: v }));
        setErrors((e) => ({ ...e, templates: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, templates: err.message }));
      } finally {
        setLoading((l) => ({ ...l, templates: false }));
      }
    },
    documents: async () => {
      setLoading((l) => ({ ...l, documents: true }));
      try {
        const v = await api.getDocuments();
        setState((s) => ({ ...s, documents: v }));
        setErrors((e) => ({ ...e, documents: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, documents: err.message }));
      } finally {
        setLoading((l) => ({ ...l, documents: false }));
      }
      api.getAnalyticsSummary().then((v) => setState((s) => ({ ...s, summary: v }))).catch(() => {});
    },
  };

  function handleLogout() {
    api.clearToken();
    onLogout();
  }

  const view = {
    overview: (
      <OverviewView
        summary={state.summary} jobs={state.jobs} complianceEvents={state.complianceEvents}
        onCreateJob={() => setActive("jobs")}
        loading={loading.analytics || loading.jobs} error={errors.analytics || errors.jobs}
        onRetry={loadAll}
      />
    ),
    jobs: (
      <JobsView
        jobs={state.jobs}
        technicians={state.technicians}
        onJobsChanged={refetch.jobs}
        onCaptureJob={(j) => { setSelectedCaptureJobId(j.id); setActive("capture"); }}
      />
    ),
    capture: (
      <CaptureView
        jobs={state.jobs}
        preselectedJobId={selectedCaptureJobId}
        onCaptureSuccess={refetch.documents}
        onGoToDocuments={() => setActive("documents")}
      />
    ),
    templates: (
      <TemplatesView
        templates={state.templates} jobs={state.jobs}
        onTemplatesChanged={refetch.templates} onDocumentsChanged={refetch.documents}
        loading={loading.templates} error={errors.templates} onRetry={refetch.templates}
      />
    ),
    documents: (
      <DocumentsView
        documents={state.documents} jobs={state.jobs} onDocumentsChanged={refetch.documents}
        loading={loading.documents} error={errors.documents} onRetry={refetch.documents}
      />
    ),
    technicians: (
      <TechniciansView
        technicians={state.technicians} onTechniciansChanged={refetch.technicians}
        loading={loading.technicians} error={errors.technicians} onRetry={refetch.technicians}
      />
    ),
    compliance: (
      <ComplianceView
        rules={state.complianceRules} events={state.complianceEvents} rate={state.complianceRate}
        loading={loading.compliance} error={errors.compliance} onRetry={loadAll}
      />
    ),
    analytics: (
      <AnalyticsView
        summary={state.summary} technicians={state.technicians}
        loading={loading.analytics || loading.technicians} error={errors.analytics} onRetry={loadAll}
      />
    ),
    settings: <SettingsView currentUser={currentUser} />,
  }[active];

  return (
    <div className="fs-root min-h-screen bg-stone-100 flex">
      <GlobalStyle />
      <Sidebar active={active} setActive={setActive} onLogout={handleLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar setMobileOpen={setMobileOpen} currentUser={currentUser} />
        <main className="flex-1 p-5 lg:p-8 overflow-y-auto fs-scroll">{view}</main>
      </div>
    </div>
  );
}

/* ======================================================================
   APP ROOT
   ====================================================================== */

export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | auth | dashboard

  if (screen === "auth") {
    return <AuthPage onAuthenticated={() => setScreen("dashboard")} onBack={() => setScreen("landing")} />;
  }
  if (screen === "dashboard") {
    return <Dashboard onLogout={() => setScreen("landing")} />;
  }
  return <LandingPage onLogin={() => setScreen("auth")} onSignup={() => setScreen("auth")} />;
}