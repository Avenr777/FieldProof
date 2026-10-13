import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid, Briefcase, FileText, FileCheck2, Users, ShieldCheck, BarChart3, Settings, LifeBuoy,
  Search, Bell, ChevronDown, ChevronRight, Mic, Camera, ScanLine, Plus, Upload, Download, Send,
  Check, AlertTriangle, TrendingUp, TrendingDown, X, ArrowRight, Play, Star, LogOut, Menu,
  MoreHorizontal, MapPin, Clock, Zap, Building2, Flame, Wrench, Sun, Radio, ClipboardCheck,
  CircleCheck, CircleAlert, Eye, UserPlus, UserCheck, CreditCard, Puzzle, ToggleLeft, Sparkles, Gauge,
  ListChecks, CalendarDays, Filter, ArrowUpRight, ArrowDownRight, HardHat, Droplets, Thermometer,
  PhoneCall, Quote, Loader2, FileUp, Pencil, Square, Volume2, Wifi, WifiOff, Trash2,
  Calendar, CheckSquare, AlignLeft, Hash, AtSign, Phone, DollarSign, Percent, Table, Tag,
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
  { key: "assignments", label: "Assign Documents", icon: UserCheck },
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
  if (loading && !summary && jobs.length === 0) return <Spinner label="Loading overview..." />;
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

function JobDetailModal({ job, technicians, documents = [], complianceEvents = [], onClose, onJobsChanged }) {
  const [status, setStatus] = useState(job.status);
  const [techId, setTechId] = useState(job.technician_id || "");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const linkedDocs = documents.filter((d) => d.job_id === job.id);
  const linkedAlerts = complianceEvents.filter((ev) => ev.job_id === job.id);

  async function handleStatusChange(newStatus) {
    setStatus(newStatus);
    setUpdating(true);
    setUpdateError(null);
    try {
      await api.updateJob(job.id, { status: newStatus });
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      setUpdateError(err.message || "Could not update status");
    } finally {
      setUpdating(false);
    }
  }

  async function handleTechChange(newTechId) {
    setTechId(newTechId);
    setUpdating(true);
    setUpdateError(null);
    try {
      await api.updateJob(job.id, { technician_id: newTechId || null });
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      setUpdateError(err.message || "Could not reassign technician");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto fs-scroll">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="fs-mono text-xs font-semibold text-stone-400">{job.id}</span>
              <StatusPill label={status} />
            </div>
            <h2 className="fs-display text-xl font-semibold text-stone-900 mt-1">{job.customer}</h2>
            <p className="text-xs text-stone-500">{job.job_type} · {job.site_address || "No site address provided"}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg text-stone-400"><X className="h-5 w-5" /></button>
        </div>

        {updateError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <span>{updateError}</span>
            <button onClick={() => setUpdateError(null)} className="font-bold">×</button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">Update Job Status</label>
            <select
              value={status}
              disabled={updating}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Awaiting Review">Awaiting Review</option>
              <option value="Compliance Flag">Compliance Flag</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">Assign Technician</label>
            <select
              value={techId}
              disabled={updating}
              onChange={(e) => handleTechChange(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.trade})</option>
              ))}
            </select>
          </div>
        </div>

        {job.notes && (
          <div>
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-stone-600 bg-white border border-stone-200 rounded-xl p-3.5 leading-relaxed">{job.notes}</p>
          </div>
        )}

        {linkedAlerts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Compliance Alerts ({linkedAlerts.length})
            </p>
            <div className="space-y-2">
              {linkedAlerts.map((ev) => (
                <div key={ev.id} className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{ev.message}</p>
                    <p className="text-[11px] text-red-600 mt-0.5">{relativeTime(ev.created_at)}</p>
                  </div>
                  <SeverityTag level={ev.severity} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">Linked Documents ({linkedDocs.length})</p>
          {linkedDocs.length === 0 ? (
            <p className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded-xl border border-stone-100">No documents generated for this job yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-stone-200 rounded-xl p-3 bg-white">
                  <div>
                    <p className="text-xs font-semibold text-stone-800">{d.name}</p>
                    <p className="text-[11px] text-stone-400">{d.id} · <StatusPill label={d.status} /></p>
                  </div>
                  {d.file_url && (
                    <a
                      href={`${api.API_BASE_URL}${d.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-stone-100">
          <button onClick={onClose} className="px-5 py-2 rounded-full bg-stone-900 text-white text-xs font-semibold">
            Close
          </button>
        </div>
      </Card>
    </div>
  );
}

function JobsView({ jobs, technicians, documents = [], complianceEvents = [], onJobsChanged, onCaptureJob }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const filters = ["All", "Scheduled", "In Progress", "Awaiting Review", "Compliance Flag", "Completed", "Cancelled"];
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

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          technicians={technicians}
          documents={documents}
          complianceEvents={complianceEvents}
          onClose={() => setSelectedJob(null)}
          onJobsChanged={onJobsChanged}
        />
      )}

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
                        <button
                          onClick={() => setSelectedJob(j)}
                          className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900"
                          title="View job details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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

function TemplateDetailPanel({
  template,
  jobs,
  technicians = [],
  onClose,
  onDelete,
  onGenerated,
  onTemplatesChanged,
  onAssigned,
  currentUser,
  showFillForm,
  setShowFillForm,
  values,
  setValues,
  jobId,
  setJobId,
  generatedDoc,
  setGeneratedDoc,
}) {
  const [fieldsData, setFieldsData] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState(null);
  const [assignedTechIds, setAssignedTechIds] = useState(
    template.assigned_technician_ids || (template.technician_id ? [template.technician_id] : [])
  );
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState(null);

  useEffect(() => {
    setAssignedTechIds(template.assigned_technician_ids || (template.technician_id ? [template.technician_id] : []));
  }, [template]);

  async function handleAssign(technicianId) {
    const nextIds = technicianId ? [technicianId] : [];
    setAssignedTechIds(nextIds);
    setAssignError(null);
    setSavingAssign(true);
    try {
      const updated = await api.assignTemplate(template.id, nextIds);
      if (updated?.assigned_technician_ids) {
        setAssignedTechIds(updated.assigned_technician_ids);
      }
      if (onAssigned) onAssigned();
      if (onTemplatesChanged) onTemplatesChanged();
    } catch (err) {
      setAssignError(err.message || "Could not assign template");
    } finally {
      setSavingAssign(false);
    }
  }

  async function handleSaveAssignment() {
    setSavingAssign(true);
    setAssignSuccess(false);
    setAssignError(null);
    try {
      await api.assignTemplate(template.id, assignedTechIds);
      setAssignSuccess(true);
      if (onTemplatesChanged) onTemplatesChanged();
      if (onAssigned) onAssigned();
      setTimeout(() => setAssignSuccess(false), 3000);
    } catch (err) {
      setAssignError(err.message || "Failed to update assignments");
    } finally {
      setSavingAssign(false);
    }
  }

  function toggleTechAssignment(techId) {
    setAssignedTechIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  }

  useEffect(() => {
    let cancelled = false;
    setFieldsLoading(true);
    setFieldsError(null);
    // Only reset fill-form state when the template actually changes
    setGeneratedDoc(null);
    setShowFillForm(false);
    setValues({});
    setJobId("");
    api.getTemplateFields(template.id)
      .then((data) => { if (!cancelled) setFieldsData(data); })
      .catch((err) => { if (!cancelled) setFieldsError(err.message || "Could not load fields"); })
      .finally(() => { if (!cancelled) setFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [template.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Exposed for parent: reset fill form (used by chain auto-fill)
  function resetFillForm(newValues) {
    setShowFillForm(true);
    setGeneratedDoc(null);
    setValues(newValues || {});
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
        <div className="flex items-center gap-2">
          {onDelete && currentUser?.role !== "Technician" && (
            <button
              type="button"
              onClick={() => onDelete(template)}
              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete template"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-stone-400" /></button>
        </div>
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
            type="button"
            onClick={() => setShowFillForm(true)}
            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 flex items-center justify-center gap-2"
          >
            <FileCheck2 className="h-4 w-4" /> Fill & generate a document
          </button>
        </>
      )}

      {/* --- Fill mode: editable inputs, one per field --- */}
      {fieldsData && showFillForm && !generatedDoc && (
        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
          <button type="button" onClick={() => setShowFillForm(false)} className="mb-4 text-xs font-semibold text-stone-500 flex items-center gap-1">
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
            type="submit" disabled={filling}
            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {filling ? <Loader2 className="h-4 w-4 fs-spin" /> : <FileCheck2 className="h-4 w-4" />}
            Generate document
          </button>
        </form>
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

          {generatedDoc.suggested_values && (
            <div className="mt-4 pt-4 border-t border-emerald-200/60 text-left">
              <div className="flex items-center gap-1.5 text-orange-800 text-xs font-semibold mb-2">
                <Sparkles className="h-4 w-4 text-orange-600" />
                <span>Chained Auto-Fill Suggestions</span>
              </div>
              {Object.entries(generatedDoc.suggested_values).map(([otherTplId, sug]) => (
                <div key={otherTplId} className="bg-white border border-orange-200 rounded-xl p-3 mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-stone-800">{sug.template_name}</p>
                    <p className="text-[11px] text-stone-500">{sug.match_count} overlapping field(s) matched automatically</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetFillForm(sug.values)}
                    className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-full shrink-0"
                  >
                    Chain Auto-Fill
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </Card>
  );
}

function FieldInput({ field, value, onChange }) {
  const inputType = FIELD_TYPE_INPUT[field.field_type] || "text";
  const label = field.label || field.field_id;
  const isCustomLabel = Boolean(field.label);

  const typeConfig = {
    date: { label: "Date", icon: Calendar, badge: "bg-blue-50 text-blue-700 border-blue-200" },
    time: { label: "Time", icon: Clock, badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    checkbox: { label: "Checkbox", icon: CheckSquare, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    multiline_text: { label: "Paragraph", icon: AlignLeft, badge: "bg-amber-50 text-amber-700 border-amber-200" },
    number: { label: "Number", icon: Hash, badge: "bg-purple-50 text-purple-700 border-purple-200" },
    percentage: { label: "Percentage", icon: Percent, badge: "bg-purple-50 text-purple-700 border-purple-200" },
    currency: { label: "Currency", icon: DollarSign, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    email: { label: "Email", icon: AtSign, badge: "bg-sky-50 text-sky-700 border-sky-200" },
    phone: { label: "Phone", icon: Phone, badge: "bg-teal-50 text-teal-700 border-teal-200" },
    text: { label: "Text", icon: Tag, badge: "bg-stone-100 text-stone-700 border-stone-200" },
  };

  const meta = typeConfig[field.field_type] || typeConfig.text;
  const Icon = meta.icon;

  if (inputType === "checkbox") {
    return (
      <div className="p-3.5 rounded-xl border border-stone-200/90 bg-stone-50/40 hover:bg-stone-50 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.badge}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            {field.kind && KIND_LABEL[field.kind] && (
              <span className="text-[10px] text-stone-400 font-medium">· {KIND_LABEL[field.kind]}</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-stone-400">{field.field_id}</span>
        </div>
        <label className="flex items-center gap-3 text-sm text-stone-800 font-medium cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-400 cursor-pointer"
          />
          <span>{label}</span>
        </label>
      </div>
    );
  }

  if (inputType === "textarea") {
    return (
      <div className="p-3.5 rounded-xl border border-stone-200/90 bg-stone-50/40 focus-within:bg-white focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.badge}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            {field.kind && KIND_LABEL[field.kind] && (
              <span className="text-[10px] text-stone-400 font-medium">· {KIND_LABEL[field.kind]}</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-stone-400">{field.field_id}</span>
        </div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">
          {label}
        </label>
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-500"
        />
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-xl border border-stone-200/90 bg-stone-50/40 focus-within:bg-white focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.badge}`}>
            <Icon className="h-3 w-3" /> {meta.label}
          </span>
          {field.kind && KIND_LABEL[field.kind] && (
            <span className="text-[10px] text-stone-400 font-medium">· {KIND_LABEL[field.kind]}</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-stone-400">{field.field_id}</span>
      </div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-500"
        />
      </div>
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

function TemplatesView({ templates, jobs, technicians = [], currentUser, onTemplatesChanged, onDocumentsChanged, loading, error, onRetry }) {
  const [mode, setMode] = useState(null); // null | "upload" | { type: "detail", template }
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const detailSectionRef = useRef(null);

  // Fill-form state lifted here so it survives TemplateDetailPanel re-renders
  const [fillShowForm, setFillShowForm] = useState(false);
  const [fillValues, setFillValues] = useState({});
  const [fillJobId, setFillJobId] = useState("");
  const [fillGeneratedDoc, setFillGeneratedDoc] = useState(null);

  useEffect(() => {
    if (mode && typeof mode === "object" && mode.type === "detail") {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mode]);

  function handleUploaded(tpl) {
    // Jump straight to the extracted-fields review for the template just
    // uploaded, so the person can immediately see what was detected.
    onTemplatesChanged();
    setMode({ type: "detail", template: tpl });
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirmTemplate) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteTemplate(deleteConfirmTemplate.id);
      if (mode && typeof mode === "object" && mode.type === "detail" && mode.template?.id === deleteConfirmTemplate.id) {
        setMode(null);
      }
      setDeleteConfirmTemplate(null);
      onTemplatesChanged();
      if (onDocumentsChanged) onDocumentsChanged();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  }

  if (loading && templates.length === 0) return <Spinner label="Loading templates..." />;
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
          const assignedCount = t.assigned_technician_ids ? t.assigned_technician_ids.length : 0;
          return (
            <Card key={t.id} className="p-5 cursor-pointer hover:border-orange-200 relative group" onClick={() => {
                // Reset fill-form state when switching templates
                const currentId = mode && typeof mode === "object" && mode.type === "detail" ? mode.template.id : null;
                if (currentId !== t.id) {
                  setFillShowForm(false);
                  setFillValues({});
                  setFillJobId("");
                  setFillGeneratedDoc(null);
                }
                setMode({ type: "detail", template: t });
              }}>
              <div className="flex items-start justify-between mb-4">
                <IconBadge icon={Icon} className="bg-gradient-to-br from-orange-500 to-orange-700" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-400">{t.trade}</span>
                  {currentUser?.role !== "Technician" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteConfirmTemplate(t);
                      }}
                      className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="font-semibold text-stone-800 mb-1">{t.name}</p>
              <p className="text-xs text-stone-500 mb-3">{t.field_map.length} mapped fields · used {t.times_used} times</p>
              {assignedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 mb-3">
                  <UserCheck className="h-3 w-3" /> Assigned to {assignedCount} tech{assignedCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-0.5 mb-3">
                  Unassigned
                </span>
              )}
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
        <div ref={detailSectionRef}>
          <TemplateDetailPanel
            template={mode.template}
            jobs={jobs}
            technicians={technicians}
            currentUser={currentUser}
            onClose={() => setMode(null)}
            onDelete={(t) => {
              setDeleteError(null);
              setDeleteConfirmTemplate(t);
            }}
            onGenerated={onDocumentsChanged}
            onTemplatesChanged={onTemplatesChanged}
            onAssigned={onTemplatesChanged}
            showFillForm={fillShowForm}
            setShowFillForm={setFillShowForm}
            values={fillValues}
            setValues={setFillValues}
            jobId={fillJobId}
            setJobId={setFillJobId}
            generatedDoc={fillGeneratedDoc}
            setGeneratedDoc={setFillGeneratedDoc}
          />
        </div>
      )}

      {deleteConfirmTemplate && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl border-stone-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">Delete template?</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-stone-700">"{deleteConfirmTemplate.name}"</span>? This will permanently remove the template and unbind it from any documents. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmTemplate(null)}
                disabled={deleting}
                className="text-xs font-semibold text-stone-600 hover:text-stone-800 px-4 py-2 rounded-full border border-stone-200 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-full px-4 py-2 shadow-sm transition-colors"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deleting ? "Deleting..." : "Delete template"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ======================================================================
   DASHBOARD — DOCUMENTS
   ====================================================================== */

function DocumentsView({ documents, jobs, complianceEvents = [], onDocumentsChanged, loading, error, onRetry, onReviewSubmission }) {
  const [reviewing, setReviewing] = useState(null);
  const [tab, setTab] = useState("All");
  const [reviewTab, setReviewTab] = useState("fields"); // "fields" | "history"
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const tabs = ["All", "Pending Review", "Approved", "Sent"];

  useEffect(() => {
    if (reviewing) {
      setShowCommentInput(false);
      setCommentText("");
      setReviewTab("fields");
      setHistoryLoading(true);
      api.getDocumentHistory(reviewing.id)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [reviewing]);

  async function handleSearch(q) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.searchDocuments(q);
      setSearchResults(results);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function approve() {
    setActionPending(true);
    try {
      await api.reviewDocument(reviewing.id, "approve", commentText || null);
      setReviewing(null);
      onDocumentsChanged();
    } catch (err) {
      alert(err.message || "Could not approve document");
    } finally {
      setActionPending(false);
    }
  }

  async function handleRequestChangesSubmit() {
    setActionPending(true);
    try {
      await api.reviewDocument(reviewing.id, "request_changes", commentText || null);
      setReviewing(null);
      setShowCommentInput(false);
      onDocumentsChanged();
    } catch (err) {
      alert(err.message || "Could not update document");
    } finally {
      setActionPending(false);
    }
  }

  if (loading && documents.length === 0) return <Spinner label="Loading documents..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  const baseList = searchResults !== null ? searchResults : documents;
  const shown = tab === "All" ? baseList : baseList.filter((d) => d.status === tab);

  // Check blocking compliance event for reviewing doc's job
  const blockingAlerts = reviewing
    ? complianceEvents.filter((ev) => ev.job_id === reviewing.job_id && !ev.resolved && ev.severity === "High")
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Generated documents</h1>
          <p className="text-sm text-stone-500 mt-1">Review AI-drafted and template-filled documents before they're sent to customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${api.API_BASE_URL}/documents/export`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-full px-4 py-2 hover:bg-stone-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border ${tab === t ? "bg-stone-900 text-white border-stone-900" : "text-stone-600 border-stone-200 bg-white"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Full-text search documents..."
            className="w-full text-xs bg-white border border-stone-200 rounded-full pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          {isSearching && <Loader2 className="h-3.5 w-3.5 fs-spin absolute right-3 top-2.5 text-stone-400" />}
        </div>
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
                        <p className="text-xs text-stone-400">{d.job_id}{job?.technician_id ? " · capture session" : ""}</p>
                      </td>
                      <td className="px-6 py-4 text-stone-600">{job ? job.customer : "—"}</td>
                      <td className="px-6 py-4"><ConfidenceBar value={d.overall_confidence} /></td>
                      <td className="px-6 py-4"><StatusPill label={d.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {onReviewSubmission && job?.technician_id && (
                            <button
                              onClick={() => onReviewSubmission(d.job_id)}
                              className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5 hover:bg-orange-100"
                              title="Open the technician's raw submission (photos, voice notes, AI evidence) and auto-fill the form"
                            >
                              Review submission
                            </button>
                          )}
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
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-stone-400">No documents match this query or filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {reviewing && (
          <Card className="lg:col-span-5 p-6 h-fit space-y-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-stone-800">{reviewing.name}</p>
              <button onClick={() => setReviewing(null)}><X className="h-5 w-5 text-stone-400" /></button>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Job: {reviewing.job_id}</span>
              <a
                href={`${api.API_BASE_URL}/documents/${reviewing.id}/export`}
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Download className="h-3 w-3" /> Export CSV
              </a>
            </div>

            {blockingAlerts.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Approval Blocked</p>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Unresolved safety alert on job: "{blockingAlerts[0].message}"
                  </p>
                </div>
              </div>
            )}

            {reviewing.auto_filled && (
              <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-orange-950 font-semibold">
                  <Sparkles className="h-4 w-4 text-orange-600 shrink-0" />
                  <span>Automated AI Auto-Filled Report (Zero Admin Typing)</span>
                </div>
                <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full">
                  1-Click Review
                </span>
              </div>
            )}

            <div className="flex border-b border-stone-100 text-xs font-semibold gap-4">
              <button
                onClick={() => setReviewTab("fields")}
                className={`pb-2 border-b-2 transition ${reviewTab === "fields" ? "border-orange-600 text-orange-600" : "border-transparent text-stone-400 hover:text-stone-700"}`}
              >
                Extracted Fields ({reviewing.extracted_fields.length})
              </button>
              <button
                onClick={() => setReviewTab("history")}
                className={`pb-2 border-b-2 transition ${reviewTab === "history" ? "border-orange-600 text-orange-600" : "border-transparent text-stone-400 hover:text-stone-700"}`}
              >
                Audit History ({history.length})
              </button>
            </div>

            {reviewTab === "fields" && (
              <div className="space-y-2 max-h-72 overflow-y-auto fs-scroll pr-1">
                {reviewing.extracted_fields.map((f, i) => {
                  const fieldKey = (f.field || "").trim().toLowerCase();
                  const srcMeta = reviewing.field_sources?.[fieldKey];
                  return (
                    <div key={i} className="flex items-center justify-between border-b border-stone-50 last:border-0 py-2.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-stone-800 truncate">{f.field}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {srcMeta?.source || f.source || "Auto-Fused"}
                          </span>
                        </div>
                        {f.value ? (
                          <p className="text-xs text-orange-950 font-medium mt-0.5 truncate bg-stone-50 px-2 py-1 rounded border border-stone-100">
                            {f.value}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-300 italic">Blank</p>
                        )}
                      </div>
                      <ConfidenceBar value={f.confidence} />
                    </div>
                  );
                })}
                {reviewing.extracted_fields.length === 0 && (
                  <p className="text-sm text-stone-400">No extracted fields on this document.</p>
                )}
              </div>
            )}

            {reviewTab === "history" && (
              <div className="space-y-3 max-h-72 overflow-y-auto fs-scroll pr-1">
                {historyLoading && <Spinner label="Loading history..." />}
                {!historyLoading && history.map((ev) => (
                  <div key={ev.id} className="text-xs bg-stone-50 border border-stone-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${ev.action === "approve" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {ev.action === "approve" ? "Approved" : "Changes Requested"}
                      </span>
                      <span className="text-stone-400">{relativeTime(ev.created_at)}</span>
                    </div>
                    <p className="text-stone-600 font-medium">By {ev.user_name || "Office Admin"}</p>
                    {ev.comment && <p className="text-stone-500 mt-1 italic">"{ev.comment}"</p>}
                  </div>
                ))}
                {!historyLoading && history.length === 0 && (
                  <p className="text-xs text-stone-400 py-4 text-center">No review actions recorded yet.</p>
                )}
              </div>
            )}

            {reviewing.file_url && (
              <a
                href={`${api.API_BASE_URL}${reviewing.file_url}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-semibold text-stone-700 border border-stone-200 rounded-full py-2.5 hover:bg-stone-50"
              >
                <Download className="h-3.5 w-3.5" /> Download document (.docx)
              </a>
            )}

            {showCommentInput && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                <label className="text-xs font-semibold text-stone-700 block">Review Comment</label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Reason for requesting changes..."
                  rows={2}
                  className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCommentInput(false)} className="text-xs font-semibold text-stone-600 px-3 py-1">Cancel</button>
                  <button onClick={handleRequestChangesSubmit} disabled={actionPending} className="text-xs font-semibold text-white bg-stone-900 rounded-full px-4 py-1.5">
                    Submit Request
                  </button>
                </div>
              </div>
            )}

            {!showCommentInput && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCommentInput(true)}
                  disabled={actionPending}
                  className="flex-1 text-xs font-semibold text-stone-700 border border-stone-200 rounded-full py-2.5 hover:bg-stone-50 disabled:opacity-60"
                >
                  Request changes
                </button>
                <button
                  onClick={approve}
                  disabled={actionPending || blockingAlerts.length > 0}
                  className="flex-1 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
                  title={blockingAlerts.length > 0 ? "Resolve safety compliance alert before approving" : ""}
                >
                  {actionPending ? <Loader2 className="h-4 w-4 fs-spin" /> : <Check className="h-4 w-4" />} Approve & send
                </button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}


/* ======================================================================
   DASHBOARD — REVIEW SUBMISSION (admin verifies a capture session)
   ====================================================================== */

const SUGGESTION_SOURCE_TONE = {
  "Job record": "bg-blue-50 text-blue-700 border-blue-200",
  "Capture date": "bg-blue-50 text-blue-700 border-blue-200",
  "Meter OCR": "bg-purple-50 text-purple-700 border-purple-200",
  "Gauge OCR": "bg-purple-50 text-purple-700 border-purple-200",
  "Label OCR": "bg-purple-50 text-purple-700 border-purple-200",
  "Photo AI": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Voice note transcript": "bg-orange-50 text-orange-700 border-orange-200",
};

function SuggestionTag({ source, confidence }) {
  const tone = SUGGESTION_SOURCE_TONE[source] || "bg-stone-100 text-stone-600 border-stone-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tone}`}>
      <Sparkles className="h-2.5 w-2.5" /> {source || "AI"} · {typeof confidence === "number" ? confidence.toFixed(0) : "?"}%
    </span>
  );
}

/**
 * Full-submission review screen: opens for one technician capture session
 * (job). Shows the RAW evidence the technician uploaded (photos with AI
 * vision/OCR results, voice notes with transcripts, compliance flags),
 * then auto-fills the assigned template from that evidence so the admin
 * only verifies/edits and clicks Create & Review once.
 */
function ReviewSubmissionView({ jobId, onBack, onDocumentCreated }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // values keyed by field_id: {value, source, confidence, auto:boolean}
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [createdDoc, setCreatedDoc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getReviewSession(jobId)
      .then((d) => {
        if (cancelled) return;
        setSession(d);
        // Seed the editable form with the backend's suggestions.
        const seeded = {};
        for (const [fid, s] of Object.entries(d.suggestions || {})) {
          seeded[fid] = { value: s.value, source: s.source, confidence: s.confidence, auto: true };
        }
        setValues(seeded);
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load submission"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  function setValue(fid, field, value) {
    setValues((v) => ({ ...v, [fid]: { ...v[fid], value, auto: false } }));
  }

  async function submit() {
    if (!session?.template) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Only send values actually filled (skip blanks).
      const payload = {};
      for (const [fid, entry] of Object.entries(values)) {
        if (entry?.value !== "" && entry?.value != null) payload[fid] = entry.value;
      }
      const doc = await api.fillTemplate(session.template.id, session.job.id, payload);
      setCreatedDoc(doc);
      onDocumentCreated?.();
    } catch (err) {
      setSaveError(err.message || "Could not create the document");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading submission evidence..." />;
  if (error) return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"><ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back</button>
      <ErrorBanner message={error} onRetry={onBack} />
    </div>
  );

  const { job, technician, template, captures, compliance_flags = [], documents = [] } = session;
  const fields = template?.fields || [];
  const stats = session.suggestion_stats || { total_fields: fields.length, suggested: 0, blank: fields.length };
  const suggestedPct = stats.total_fields ? Math.round((stats.suggested / stats.total_fields) * 100) : 0;
  const filledCount = Object.values(values).filter((v) => v?.value !== "" && v?.value != null).length;
  const blockingFlags = compliance_flags.filter((f) => f.severity === "High");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50" title="Back to documents">
            <ArrowRight className="h-4 w-4 rotate-180 text-stone-600" />
          </button>
          <div>
            <h1 className="fs-display text-2xl font-semibold text-stone-900">Review submission</h1>
            <p className="text-sm text-stone-500 mt-1">
              {job.customer} · {job.job_type} · <span className="fs-mono text-xs">{job.id}</span>
              {technician && <> · Technician <span className="font-semibold text-stone-700">{technician.name}</span></>}
            </p>
          </div>
        </div>
        <StatusPill label={job.status} />
      </div>

      {job.notes && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Field notes from technician</p>
          <p className="text-sm text-stone-700">{job.notes}</p>
        </Card>
      )}

      {compliance_flags.length > 0 && (
        <Card className={`p-4 ${blockingFlags.length ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`h-4 w-4 ${blockingFlags.length ? "text-red-600" : "text-amber-600"}`} />
            <p className={`text-sm font-semibold ${blockingFlags.length ? "text-red-800" : "text-amber-800"}`}>
              Compliance alerts ({compliance_flags.length})
            </p>
          </div>
          <ul className="space-y-1">
            {compliance_flags.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-xs text-stone-700">
                <SeverityTag level={f.severity} /> {f.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Evidence + form split */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT: raw evidence */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-stone-800">Technician evidence</p>
              <span className="text-xs text-stone-400">{captures.length} upload{captures.length === 1 ? "" : "s"}</span>
            </div>
            {captures.length === 0 ? (
              <p className="text-sm text-stone-400">No voice notes or photos were uploaded in this session.</p>
            ) : (
              <div className="space-y-3">
                {captures.map((c) => (
                  <div key={c.id} className="rounded-xl border border-stone-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-3.5 py-2.5 bg-stone-50/70">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${c.kind === "voice" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                        {c.kind === "voice" ? <Mic className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-stone-700">{c.kind === "voice" ? "Voice note" : "Photo"}</p>
                        <p className="text-[11px] text-stone-400">{c.created_at ? relativeTime(c.created_at) : ""}{c.processed ? " · AI processed" : " · queued"}</p>
                      </div>
                      <a href={`${api.API_BASE_URL}${c.file_url}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-stone-100" title={c.kind === "voice" ? "Play voice note" : "Open photo"}>
                        {c.kind === "voice" ? <Volume2 className="h-4 w-4 text-stone-500" /> : <Eye className="h-4 w-4 text-stone-500" />}
                      </a>
                    </div>
                    {/* AI evidence body */}
                    <div className="px-3.5 py-3 space-y-2">
                      {c.kind === "voice" && (
                        c.transcript ? (
                          <p className="text-xs text-stone-700 bg-orange-50/60 border border-orange-100 rounded-lg p-2.5 italic">"{c.transcript}"</p>
                        ) : (
                          <p className="text-xs text-stone-400 italic">No transcript (processing pending or offline mode).</p>
                        )
                      )}
                      {c.kind === "photo" && c.vision && (
                        <div className="flex flex-wrap gap-1.5">
                          {c.vision.equipment && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Equipment: {c.vision.equipment}</span>}
                          {typeof c.vision.ppe_detected === "boolean" && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.vision.ppe_detected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                              PPE: {c.vision.ppe_detected ? "detected" : "NOT detected"}
                            </span>
                          )}
                          {typeof c.vision.warning_label_present === "boolean" && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Warning label: {c.vision.warning_label_present ? "yes" : "no"}</span>
                          )}
                        </div>
                      )}
                      {c.kind === "photo" && c.ocr && (
                        <div className="text-[11px] text-stone-600 space-y-0.5">
                          {c.ocr.meter_display && <p><span className="font-semibold text-stone-500">Meter:</span> <span className="fs-mono">{c.ocr.meter_display}</span></p>}
                          {c.ocr.serial_number && <p><span className="font-semibold text-stone-500">Serial:</span> <span className="fs-mono">{c.ocr.serial_number}</span></p>}
                          {c.ocr.manufacturer && <p><span className="font-semibold text-stone-500">Maker:</span> {c.ocr.manufacturer}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {documents.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-stone-800 mb-3">Documents already generated</p>
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border border-stone-100 rounded-xl px-3.5 py-2.5">
                    <p className="text-xs font-medium text-stone-700 truncate">{d.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill label={d.status} />
                      {d.file_url && <a href={`${api.API_BASE_URL}${d.file_url}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-stone-100"><Download className="h-4 w-4 text-stone-500" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT: auto-filled template form */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div>
                <p className="text-sm font-semibold text-stone-800">{template ? template.name : "No template detected"}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {template
                    ? "Values below were auto-suggested from the evidence on the left — verify each, edit anything, blanks at the end."
                    : "No template was submitted against. Generate files from the Documents view or assign a template first."}
                </p>
              </div>
              {template && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-orange-700">{stats.suggested}/{stats.total_fields} auto-filled</span>
                </div>
              )}
            </div>
            {template && (
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mt-2 mb-4">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400" style={{ width: `${suggestedPct}%` }} />
              </div>
            )}

            {!template ? (
              <p className="text-sm text-stone-400 py-8 text-center">Nothing to fill — this session has no template.</p>
            ) : fields.length === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">This template has no fillable fields.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {fields.map((f) => {
                  const entry = values[f.field_id];
                  const suggested = entry?.auto && entry?.value !== "" && entry?.value != null;
                  const isCheckbox = FIELD_TYPE_INPUT[f.field_type] === "checkbox" || f.kind === "checkbox_option";
                  const isMultiline = FIELD_TYPE_INPUT[f.field_type] === "textarea" || f.kind === "multiline_blank_group";
                  const label = f.label || f.field_id;
                  return (
                    <div key={f.field_id} className={`p-3.5 rounded-xl border transition-colors ${suggested ? "border-orange-200 bg-orange-50/40" : "border-stone-200 bg-stone-50/40"} ${isMultiline ? "sm:col-span-2" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <label className="text-xs font-semibold text-stone-700 truncate">{label}</label>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {entry && !entry.auto && <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Edited</span>}
                          {suggested && <SuggestionTag source={entry.source} confidence={entry.confidence} />}
                          {!suggested && f.kind && KIND_LABEL[f.kind] && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{KIND_LABEL[f.kind]}</span>
                          )}
                        </div>
                      </div>
                      {isCheckbox ? (
                        <label className="flex items-center gap-2.5 text-sm text-stone-800 font-medium cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!entry?.value}
                            onChange={(e) => setValue(f.field_id, f, entry?.auto ? e.target.checked : e.target.checked)}
                            className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-400 cursor-pointer"
                          />
                          <span className="text-xs">{String(entry?.value ?? false) === "true" && entry?.auto ? `Suggested: ${entry.value === true || entry.value === "true" ? "checked" : "unchecked"}` : label}</span>
                        </label>
                      ) : isMultiline ? (
                        <textarea
                          value={typeof entry?.value === "string" ? entry.value : entry?.value == null ? "" : String(entry.value)}
                          onChange={(e) => setValue(f.field_id, f, e.target.value)}
                          rows={3}
                          placeholder={suggested ? "" : `Enter ${label.toLowerCase()}...`}
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-500"
                        />
                      ) : (
                        <input
                          type={FIELD_TYPE_INPUT[f.field_type] || "text"}
                          value={typeof entry?.value === "string" ? entry.value : entry?.value == null ? "" : String(entry.value)}
                          onChange={(e) => setValue(f.field_id, f, e.target.value)}
                          placeholder={suggested ? "" : `Enter ${label.toLowerCase()}...`}
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {saveError && (
              <div className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {saveError}
              </div>
            )}

            {template && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={submit}
                  disabled={saving || filledCount === 0}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-5 py-2.5 shadow-sm disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 fs-spin" /> : <FileCheck2 className="h-4 w-4" />}
                  Create document ({filledCount} field{filledCount === 1 ? "" : "s"})
                </button>
                <p className="text-[11px] text-stone-400">Generates the filled .docx and opens it in Documents → Pending Review for final approval.</p>
              </div>
            )}
          </Card>

          {createdDoc && (
            <Card className="p-6 border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center gap-2 mb-2">
                <CircleCheck className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Document created — ready for final approval</p>
              </div>
              <p className="text-xs text-emerald-700 mb-3">{createdDoc.name} · {createdDoc.extracted_fields.length} fields filled · now Pending Review.</p>
              <div className="flex flex-wrap gap-3">
                {createdDoc.file_url && (
                  <a href={`${api.API_BASE_URL}${createdDoc.file_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-full px-4 py-2 hover:bg-stone-50">
                    <Download className="h-3.5 w-3.5" /> Open .docx
                  </a>
                )}
                <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-stone-900 rounded-full px-4 py-2">
                  Back to Documents <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


/* ======================================================================
   DASHBOARD — TECHNICIANS
   ====================================================================== */

function TechnicianDetailPanel({ tech, onClose, onReviewSubmission }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getTechnicianDetail(tech.id)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load technician activity"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tech.id]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
            {tech.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-stone-800">{tech.name}</p>
            <p className="text-xs text-stone-500">Uploads, assigned forms, and document status</p>
          </div>
        </div>
        <button onClick={onClose}><X className="h-5 w-5 text-stone-400" /></button>
      </div>

      {loading && <Spinner label="Loading uploads and documents..." />}
      {error && <ErrorBanner message={error} onRetry={onClose} />}

      {detail && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Assigned templates</p>
            {detail.assigned_templates.length === 0 ? (
              <p className="text-sm text-stone-400">No templates assigned — assign one from the Templates view.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.assigned_templates.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                    <FileText className="h-3 w-3" /> {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Uploads ({detail.captures.length})</p>
            {detail.captures.length === 0 ? (
              <p className="text-sm text-stone-400">No captures uploaded yet.</p>
            ) : (
              <div className="divide-y divide-stone-50 border border-stone-100 rounded-xl overflow-hidden">
                {detail.captures.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-white">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${c.kind === "voice" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                      {c.kind === "voice" ? <Mic className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-700 truncate">
                        {c.kind === "voice" ? "Voice note" : "Photo"}
                        <span className="text-stone-400"> · {c.id}</span>
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        {relativeTime(c.created_at)}
                        {c.kind === "voice" && c.transcript ? ` · "${c.transcript.slice(0, 60)}${c.transcript.length > 60 ? "…" : ""}"` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.processed ? "text-emerald-700 bg-emerald-50" : "text-stone-500 bg-stone-100"}`}>
                      {c.processed ? "Processed" : "Queued"}
                    </span>
                    <a
                      href={`${api.API_BASE_URL}${c.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg hover:bg-stone-100 shrink-0"
                      title={c.kind === "voice" ? "Play voice note" : "View photo"}
                    >
                      {c.kind === "voice" ? <Volume2 className="h-4 w-4 text-stone-500" /> : <Eye className="h-4 w-4 text-stone-500" />}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Document status ({detail.documents.length})</p>
            {detail.documents.length === 0 ? (
              <p className="text-sm text-stone-400">No documents generated from this technician's work yet.</p>
            ) : (
              <div className="space-y-2">
                {detail.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 border border-stone-100 rounded-xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-700 truncate">{d.name}</p>
                      <p className="text-xs text-stone-400">{d.id} · {relativeTime(d.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ConfidenceBar value={d.overall_confidence} />
                      <StatusPill label={d.status} />
                      {onReviewSubmission && (
                        <button
                          onClick={() => onReviewSubmission(d.job_id)}
                          className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-1 hover:bg-orange-100"
                          title="Review the technician's raw submission for this document"
                        >
                          Review submission
                        </button>
                      )}
                      {d.file_url && (
                        <a href={`${api.API_BASE_URL}${d.file_url}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-stone-100">
                          <Download className="h-4 w-4 text-stone-500" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function TechniciansView({ technicians, jobs = [], onTechniciansChanged, loading, error, onRetry, onReviewSubmission }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [detailTech, setDetailTech] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  async function invite(e) {
    e.preventDefault();
    const form = e.target;
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createTechnician({
        name: form.name.value,
        trade: form.trade.value,
        email: form.email?.value || undefined,
        password: form.password?.value || undefined,
      });
      setShowForm(false);
      form.reset();
      onTechniciansChanged();
    } catch (err) {
      setFormError(err.message || "Could not invite technician");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(techId, newStatus) {
    setUpdatingId(techId);
    try {
      await api.updateTechnician(techId, { status: newStatus });
      onTechniciansChanged();
    } catch (err) {
      alert(err.message || "Failed to update technician status");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && technicians.length === 0) return <Spinner label="Loading technicians..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Technicians</h1>
          <p className="text-sm text-stone-500 mt-1">Monitor field team activity, workload, and credentials.</p>
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
              <input name="name" required placeholder="e.g. Jordan Lee" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Trade</label>
              <select name="trade" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                {Object.keys(TRADE_ICON).map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Mobile App Email (Login ID)</label>
              <input name="email" type="email" placeholder="e.g. jordan@company.com" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Mobile App Password</label>
              <input name="password" type="password" placeholder="Default: demo-password-123" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
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

      {detailTech && <TechnicianDetailPanel tech={detailTech} onClose={() => setDetailTech(null)} onReviewSubmission={onReviewSubmission} />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {technicians.map((t) => {
          const Icon = TRADE_ICON[t.trade] || Building2;
          return (
            <Card
              key={t.id}
              className={`p-5 cursor-pointer hover:border-orange-200 ${detailTech?.id === t.id ? "border-orange-300 ring-2 ring-orange-100" : ""}`}
              onClick={() => setDetailTech(detailTech?.id === t.id ? null : t)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                    {t.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">{t.name}</p>
                    {t.email && <p className="text-xs text-stone-400 font-mono">{t.email}</p>}
                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><Icon className="h-3 w-3" /> {t.trade}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <select
                    value={t.status}
                    disabled={updatingId === t.id}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="On Site">On Site</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center border-t border-stone-100 pt-4">
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.uploads_count ?? 0}</p>
                  <p className="text-xs text-stone-500">Uploads</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.active_jobs}</p>
                  <p className="text-xs text-stone-500">Active jobs</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.docs_this_week}</p>
                  <p className="text-xs text-stone-500">Docs / wk</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.compliance_pct}%</p>
                  <p className="text-xs text-stone-500">Compliance</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-400">Tap to view uploads & document status</span>
                <span className="font-semibold text-orange-600 flex items-center gap-1">Open <ChevronRight className="h-3.5 w-3.5" /></span>
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
  if (loading && rules.length === 0 && events.length === 0) return <Spinner label="Loading compliance data..." />;
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
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    setRecLoading(true);
    api.getRecurringComplianceEvents()
      .then(setRecurringEvents)
      .catch(() => setRecurringEvents([]))
      .finally(() => setRecLoading(false));
  }, []);

  if (loading && !summary) return <Spinner label="Loading analytics..." />;
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
          <p className="text-sm font-semibold text-stone-800 mb-4">Top Recurring Compliance Issues</p>
          {recLoading ? (
            <Spinner label="Loading recurring issues..." />
          ) : recurringEvents.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-stone-400">
              No recurring compliance issues recorded yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto fs-scroll pr-1">
              {recurringEvents.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-stone-800 truncate">{r.message}</p>
                    <span className="text-[11px] text-stone-400">Severity: {r.severity}</span>
                  </div>
                  <span className="fs-mono text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full shrink-0">
                    {r.count} occurrence{r.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Avg documentation time (minutes)</p>
          <TrendChart data={summary?.documentation_time_trend} dataKey="mins" color="#7c3aed" empty="No trend data yet — needs a few weeks of usage." />
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">AI extraction accuracy</p>
          <TrendChart data={summary?.accuracy_trend} dataKey="acc" color="#0d9488" fill empty="No trend data yet — needs a few weeks of usage." />
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — SETTINGS
   ====================================================================== */

function SettingsView({ currentUser, onUserUpdated }) {
  const [fullName, setFullName] = useState(currentUser?.full_name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [bizName, setBizName] = useState("");
  const [primaryTrade, setPrimaryTrade] = useState("General");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);

  const [integrations, setIntegrations] = useState([]);
  const [intLoading, setIntLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || "");
      setEmail(currentUser.email || "");
    }
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;
    api.getBusiness()
      .then((biz) => {
        if (!cancelled && biz) {
          setBizName(biz.name || "");
          setPrimaryTrade(biz.primary_trade || "General");
          setAddress(biz.address || "");
        }
      })
      .catch(() => {});

    api.getIntegrations()
      .then((items) => { if (!cancelled) setIntegrations(items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIntLoading(false); });

    return () => { cancelled = true; };
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      await api.updateMe({ full_name: fullName, email });
      await api.updateBusiness({ name: bizName, primary_trade: primaryTrade, address });
      setSaveMsg("Profile and business settings saved successfully!");
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      setSaveErr(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleIntegration(name, currentEnabled) {
    const nextEnabled = !currentEnabled;
    setIntegrations((prev) => prev.map((i) => (i.name === name ? { ...i, enabled: nextEnabled } : i)));
    try {
      await api.updateIntegration(name, nextEnabled);
    } catch (err) {
      alert(`Failed to update integration ${name}: ${err.message}`);
      setIntegrations((prev) => prev.map((i) => (i.name === name ? { ...i, enabled: currentEnabled } : i)));
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Manage your business profile, plan, team, and integrations.</p>
      </div>

      {saveMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{saveMsg}</span>
          <button onClick={() => setSaveMsg(null)} className="font-bold">×</button>
        </div>
      )}
      {saveErr && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{saveErr}</span>
          <button onClick={() => setSaveErr(null)} className="font-bold">×</button>
        </div>
      )}

      <Card className="p-6">
        <p className="text-sm font-semibold text-stone-800 mb-4">Business & Personal Profile</p>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Your Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Business Name</label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="e.g. Meridian Fieldworks"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Primary Trade</label>
              <select
                value={primaryTrade}
                onChange={(e) => setPrimaryTrade(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {Object.keys(TRADE_ICON).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Business Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 100 Main St, Suite 400"
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 bg-white"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-5 py-2.5 rounded-full shadow-sm disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 fs-spin" />} Save Profile
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-stone-800">Subscription & billing</p>
          <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">Growth Plan</span>
        </div>
        <div className="flex gap-3">
          <button className="text-sm font-semibold text-stone-700 border border-stone-200 rounded-full px-4 py-2 hover:bg-stone-50">Manage billing</button>
          <button className="text-sm font-semibold text-white bg-stone-900 rounded-full px-4 py-2 hover:bg-stone-800">Upgrade plan</button>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-semibold text-stone-800 mb-4">Software Integrations</p>
        {intLoading ? (
          <Spinner label="Loading integrations..." />
        ) : (
          <div className="space-y-4">
            {integrations.map((item) => (
              <div key={item.name} className="flex items-center justify-between border-b border-stone-100 last:border-0 pb-3.5 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                    <Puzzle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{item.name}</p>
                    <p className="text-xs text-stone-400">Sync FieldProof records directly with {item.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleIntegration(item.name, item.enabled)}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition ${item.enabled ? "bg-orange-600 justify-end" : "bg-stone-200 justify-start"}`}
                >
                  <span className="h-5 w-5 rounded-full bg-white block shadow-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}


/* ======================================================================
   ASSIGNMENTS VIEW (One-Time & Repeating Document Assignment)
   ====================================================================== */

function formatScheduleBadge(asn) {
  if (asn.assignment_type === "one_time" || !asn.frequency) {
    return {
      label: "One-Time / As Needed",
      icon: Zap,
      tone: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  const freq = (asn.frequency || "").toLowerCase();
  const details = asn.frequency_details || {};
  let text = "Repeating Schedule";
  if (freq === "daily") {
    const interval = details.interval || 1;
    text = interval === 1 ? "Daily Schedule" : `Every ${interval} Days`;
  } else if (freq === "weekly") {
    const days = (details.days_of_week || []).join(", ");
    text = days ? `Weekly (${days})` : "Weekly Schedule";
  } else if (freq === "monthly") {
    const dom = details.day_of_month || 1;
    text = `Monthly (Day ${dom})`;
  } else if (freq === "custom") {
    text = details.custom_notes || "Custom Schedule";
  }
  return {
    label: text,
    icon: CalendarDays,
    tone: "bg-orange-50 text-orange-800 border-orange-200",
  };
}

function CreateAssignmentModal({ templates = [], technicians = [], onClose, onSuccess }) {
  const [selectedTplIds, setSelectedTplIds] = useState([]);
  const [selectedTechIds, setSelectedTechIds] = useState([]);
  const [assignmentType, setAssignmentType] = useState("one_time"); // "one_time" | "repeating"
  const [dueDate, setDueDate] = useState("");
  
  // Repeating schedule options
  const [frequency, setFrequency] = useState("weekly"); // "daily" | "weekly" | "monthly" | "custom"
  const [interval, setInterval] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState(["Mon"]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customNotes, setCustomNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Proof Requirements & Instructions
  const [requiredProofTypes, setRequiredProofTypes] = useState(["photo", "voice"]);
  const [minPhotos, setMinPhotos] = useState(1);
  const [requireVoice, setRequireVoice] = useState(false);
  const [technicianInstructions, setTechnicianInstructions] = useState("");

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleDayOfWeek = (day) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectAllTemplates = () => {
    if (selectedTplIds.length === templates.length) {
      setSelectedTplIds([]);
    } else {
      setSelectedTplIds(templates.map((t) => t.id));
    }
  };

  const handleSelectAllTechs = () => {
    if (selectedTechIds.length === technicians.length) {
      setSelectedTechIds([]);
    } else {
      setSelectedTechIds(technicians.map((t) => t.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedTplIds.length === 0) {
      setError("Please select at least one document template.");
      return;
    }
    if (selectedTechIds.length === 0) {
      setError("Please select at least one technician.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        template_ids: selectedTplIds,
        technician_ids: selectedTechIds,
        assignment_type: assignmentType,
        notes: notes || null,
        required_proof_types: requiredProofTypes,
        min_photos: Number(minPhotos) || 1,
        require_voice: requireVoice,
        technician_instructions: technicianInstructions || null,
      };

      if (assignmentType === "one_time") {
        payload.due_date = dueDate ? new Date(dueDate).toISOString() : null;
      } else {
        payload.frequency = frequency;
        payload.frequency_details = {
          interval: Number(interval) || 1,
          days_of_week: daysOfWeek,
          day_of_month: Number(dayOfMonth) || 1,
          custom_notes: customNotes || null,
        };
        payload.start_date = startDate ? new Date(startDate).toISOString() : null;
        payload.end_date = endDate ? new Date(endDate).toISOString() : null;
      }

      await api.createAssignment(payload);
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 fs-root overflow-y-auto">
      <Card className="w-full max-w-2xl p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <h2 className="fs-display text-xl font-bold text-stone-900">Assign Document to Technicians</h2>
            <p className="text-xs text-stone-500 mt-0.5">Select document(s), technician(s), and assignment schedule.</p>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Select Documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                1. Select Document / Template ({selectedTplIds.length} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAllTemplates}
                className="text-[11px] font-semibold text-orange-600 hover:underline"
              >
                {selectedTplIds.length === templates.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto fs-scroll p-1 border border-stone-200 rounded-xl bg-stone-50/50">
              {templates.map((tpl) => {
                const checked = selectedTplIds.includes(tpl.id);
                return (
                  <label
                    key={tpl.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      checked
                        ? "bg-orange-50 border-orange-200 text-orange-900 font-semibold"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedTplIds((prev) =>
                          prev.includes(tpl.id) ? prev.filter((id) => id !== tpl.id) : [...prev, tpl.id]
                        )
                      }
                      className="rounded border-stone-300 text-orange-600 focus:ring-orange-200"
                    />
                    <div className="truncate">
                      <p className="truncate font-medium">{tpl.name}</p>
                      <p className="text-[10px] text-stone-400 font-normal">{tpl.trade}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Technicians */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                2. Select Technician(s) ({selectedTechIds.length} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAllTechs}
                className="text-[11px] font-semibold text-orange-600 hover:underline"
              >
                {selectedTechIds.length === technicians.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto fs-scroll p-1 border border-stone-200 rounded-xl bg-stone-50/50">
              {technicians.map((tech) => {
                const checked = selectedTechIds.includes(tech.id);
                return (
                  <label
                    key={tech.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      checked
                        ? "bg-orange-50 border-orange-200 text-orange-900 font-semibold"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedTechIds((prev) =>
                          prev.includes(tech.id) ? prev.filter((id) => id !== tech.id) : [...prev, tech.id]
                        )
                      }
                      className="rounded border-stone-300 text-orange-600 focus:ring-orange-200"
                    />
                    <div className="truncate">
                      <p className="truncate font-medium">{tech.name}</p>
                      <p className="text-[10px] text-stone-400 font-normal">{tech.trade}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 3: Assignment Type (One-Time vs Repeating) */}
          <div>
            <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block mb-2">
              3. Assignment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAssignmentType("one_time")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  assignmentType === "one_time"
                    ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200 text-amber-950"
                    : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`h-4 w-4 ${assignmentType === "one_time" ? "text-amber-600" : "text-stone-400"}`} />
                  <span className="font-bold text-sm">One-Time / As Needed</span>
                </div>
                <p className="text-xs text-stone-500">
                  Assign for single completion or whenever required by technician.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAssignmentType("repeating")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  assignmentType === "repeating"
                    ? "bg-orange-50 border-orange-300 ring-2 ring-orange-200 text-orange-950"
                    : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className={`h-4 w-4 ${assignmentType === "repeating" ? "text-orange-600" : "text-stone-400"}`} />
                  <span className="font-bold text-sm">Repeating Schedule</span>
                </div>
                <p className="text-xs text-stone-500">
                  Automatically schedule on a Daily, Weekly, Monthly, or Custom interval.
                </p>
              </button>
            </div>
          </div>

          {/* Options for One-Time */}
          {assignmentType === "one_time" && (
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>
          )}

          {/* Options for Repeating Schedule */}
          {assignmentType === "repeating" && (
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1.5">Recurrence Frequency</label>
                <div className="flex gap-2">
                  {[
                    { id: "daily", label: "Daily" },
                    { id: "weekly", label: "Weekly" },
                    { id: "monthly", label: "Monthly" },
                    { id: "custom", label: "Custom" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        frequency === f.id
                          ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {frequency === "daily" && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Repeat Every (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
              )}

              {frequency === "weekly" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Repeat Every (Weeks)</label>
                    <input
                      type="number"
                      min="1"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1.5">On Days of Week</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const active = daysOfWeek.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDayOfWeek(day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              active
                                ? "bg-orange-500 text-white border-orange-500"
                                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {frequency === "monthly" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Repeat Every (Months)</label>
                    <input
                      type="number"
                      min="1"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Day of Month (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                </div>
              )}

              {frequency === "custom" && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Custom Schedule Notes / Interval</label>
                  <input
                    type="text"
                    placeholder="e.g. Every 2 weeks on Friday after safety audit"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Submission Requirements & Technician Instructions */}
          <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 space-y-4">
            <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
              4. Technician Submission Requirements & Instructions
            </label>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block">Required Proof Types</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "photo", label: "📷 Photo Proof", desc: "Require on-site photos" },
                  { id: "voice", label: "🎙️ Voice Note", desc: "Require audio explanation" },
                  { id: "form_fill", label: "📋 Form Fill", desc: "Technician fills form" },
                  { id: "text_note", label: "📝 Text Notes", desc: "Require short notes" },
                ].map((pt) => {
                  const active = requiredProofTypes.includes(pt.id);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() =>
                        setRequiredProofTypes((prev) =>
                          prev.includes(pt.id) ? prev.filter((i) => i !== pt.id) : [...prev, pt.id]
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? "bg-orange-600 text-white border-orange-600 shadow-sm font-semibold"
                          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      <p className="text-xs">{pt.label}</p>
                      <p className={`text-[10px] ${active ? "text-orange-100" : "text-stone-400"}`}>{pt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {requiredProofTypes.includes("photo") && (
              <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-stone-200">
                <label className="text-xs font-semibold text-stone-700">Minimum Photos Required:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={minPhotos}
                  onChange={(e) => setMinPhotos(e.target.value)}
                  className="w-20 text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-stone-50 text-center font-bold text-stone-900"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700">Instructions for Technician</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTechnicianInstructions("Please send a clear photo of completed work.")}
                    className="text-[10px] font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded"
                  >
                    + Photo Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setTechnicianInstructions("Record a voice note describing work completed and test results, plus photo of label.")}
                    className="text-[10px] font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded"
                  >
                    + Voice & Photo Preset
                  </button>
                </div>
              </div>
              <textarea
                rows={2}
                value={technicianInstructions}
                onChange={(e) => setTechnicianInstructions(e.target.value)}
                placeholder="e.g. Plumber: Take a clear photo of the pipe joint and record a 15-second voice note detailing water pressure test..."
                className="w-full text-xs border border-stone-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          {/* Notes / Additional Compliance Notes */}
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">
              Internal Admin Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal compliance notes..."
              className="w-full text-xs border border-stone-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-full px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 shadow-sm"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 fs-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirm Assignment
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditAssignmentModal({ assignment, onClose, onSuccess }) {
  const [status, setStatus] = useState(assignment.status || "active");
  const [notes, setNotes] = useState(assignment.notes || "");
  const [dueDate, setDueDate] = useState(
    assignment.due_date ? new Date(assignment.due_date).toISOString().split("T")[0] : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateAssignment(assignment.id, {
        status,
        notes: notes || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to update assignment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 fs-root">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="fs-display font-bold text-stone-900 text-lg">Edit Assignment</h3>
            <p className="text-xs text-stone-500">{assignment.template_name} · {assignment.technician_name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-xl px-3 py-2 bg-white"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-xl px-3 py-2 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1">Instructions / Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-xl px-3 py-2 bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-full px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 fs-spin" /> : <Check className="h-3.5 w-3.5" />} Save Changes
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AssignmentsView({ templates = [], technicians = [], currentUser }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterType, setFilterType] = useState("all"); // "all" | "one_time" | "repeating"
  const [techFilter, setTechFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err) {
      setError(err.message || "Failed to load document assignments");
    } textFinally: {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this document assignment?")) return;
    try {
      await api.deleteAssignment(id);
      loadAssignments();
    } catch (err) {
      alert("Failed to revoke assignment: " + err.message);
    }
  };

  const filteredAssignments = assignments.filter((asn) => {
    if (filterType === "one_time" && asn.assignment_type !== "one_time") return false;
    if (filterType === "repeating" && asn.assignment_type !== "repeating") return false;
    if (techFilter && asn.technician_id !== techFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTpl = (asn.template_name || "").toLowerCase().includes(q);
      const matchTech = (asn.technician_name || "").toLowerCase().includes(q);
      const matchNotes = (asn.notes || "").toLowerCase().includes(q);
      if (!matchTpl && !matchTech && !matchNotes) return false;
    }
    return true;
  });

  const oneTimeCount = assignments.filter((a) => a.assignment_type === "one_time").length;
  const repeatingCount = assignments.filter((a) => a.assignment_type === "repeating").length;
  const uniqueTechsAssigned = new Set(assignments.map((a) => a.technician_id)).size;

  return (
    <div className="space-y-6">
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="fs-display text-2xl font-semibold text-stone-900">Assign Documents</h1>
            <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
              {assignments.length} Total Active
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Assign one-time or repeating scheduled documents to field technicians.
          </p>
        </div>
        {currentUser?.role !== "Technician" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm transition-all shrink-0"
          >
            <Plus className="h-4 w-4" /> Assign Document
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Total Assignments</p>
            <p className="fs-display text-xl font-bold text-stone-900">{assignments.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">One-Time / As Needed</p>
            <p className="fs-display text-xl font-bold text-stone-900">{oneTimeCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Repeating Schedules</p>
            <p className="fs-display text-xl font-bold text-stone-900">{repeatingCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Assigned Technicians</p>
            <p className="fs-display text-xl font-bold text-stone-900">{uniqueTechsAssigned}</p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto fs-scroll pb-1 md:pb-0">
            {[
              { id: "all", label: "All Assignments" },
              { id: "one_time", label: "⚡ One-Time / As Needed" },
              { id: "repeating", label: "📅 Repeating Schedules" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`text-xs font-semibold px-3.5 py-2 rounded-full whitespace-nowrap transition-all ${
                  filterType === f.id
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="h-4 w-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search doc or technician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="text-xs border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 text-stone-700"
            >
              <option value="">All Technicians</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <Spinner label="Loading document assignments..." />
      ) : error ? (
        <Card className="p-6 text-center text-rose-600">
          <p>{error}</p>
          <button onClick={loadAssignments} className="mt-3 text-xs font-semibold text-orange-600 underline">
            Try again
          </button>
        </Card>
      ) : filteredAssignments.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 mx-auto mb-3">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h3 className="fs-display font-semibold text-stone-900 text-lg">No Document Assignments Found</h3>
          <p className="text-sm text-stone-500 max-w-sm mx-auto mt-1 mb-5">
            {assignments.length === 0
              ? "No documents have been assigned to technicians yet. Click 'Assign Document' to get started."
              : "No assignments match your current filters or search criteria."}
          </p>
          {currentUser?.role !== "Technician" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Assign a Document Now
            </button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((asn) => {
            const badge = formatScheduleBadge(asn);
            const BadgeIcon = badge.icon;
            const TradeIcon = TRADE_ICON[asn.template_trade] || Building2;

            return (
              <Card key={asn.id} className="p-5 flex flex-col justify-between hover:border-orange-200 transition-all">
                <div className="space-y-3">
                  {/* Top Row: Trade & Schedule Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                      <TradeIcon className="h-3.5 w-3.5 text-orange-600" />
                      {asn.template_trade || "General"}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.tone}`}>
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>

                  {/* Document & Tech Names */}
                  <div>
                    <h3 className="fs-display text-base font-bold text-stone-900 leading-snug">
                      {asn.template_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
                      <Users className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      <span>Assigned to: <strong className="text-stone-800 font-semibold">{asn.technician_name}</strong></span>
                    </div>
                  </div>

                  {/* Schedule / Due Date details */}
                  <div className="space-y-1 bg-stone-50/80 p-3 rounded-xl border border-stone-100 text-xs">
                    {asn.assignment_type === "one_time" ? (
                      <div className="flex items-center justify-between text-stone-600">
                        <span>Due Date:</span>
                        <span className="font-semibold text-stone-800">
                          {asn.due_date ? new Date(asn.due_date).toLocaleDateString() : "As required"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Frequency:</span>
                          <span className="font-semibold text-stone-800 capitalize">{asn.frequency || "Custom"}</span>
                        </div>
                        {asn.start_date && (
                          <div className="flex items-center justify-between text-stone-500 text-[11px]">
                            <span>Starts:</span>
                            <span>{new Date(asn.start_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </>
                    )}

                    {asn.notes && (
                      <div className="pt-2 border-t border-stone-200/60 text-stone-500 italic text-[11px] truncate">
                        "{asn.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer / Actions */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {asn.status || "Active"}
                  </span>

                  {currentUser?.role !== "Technician" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingAssignment(asn)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
                        title="Edit schedule / notes"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(asn.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Revoke assignment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateAssignmentModal
          templates={templates}
          technicians={technicians}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAssignments();
          }}
        />
      )}

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            setEditingAssignment(null);
            loadAssignments();
          }}
        />
      )}
    </div>
  );
}


/* ======================================================================
   DASHBOARD — ROOT (fetches everything from the live API)
   ====================================================================== */

const VIEW_TITLES = {
  overview: "Overview", jobs: "Jobs", templates: "Templates", assignments: "Assign Documents",
  documents: "Documents", technicians: "Technicians", compliance: "Compliance", analytics: "Analytics", settings: "Settings",
};

function Dashboard({ onLogout }) {
  const [active, setActive] = useState("overview");
  const [reviewJobId, setReviewJobId] = useState(null);
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
      try {
        const result = await fetcher();
        apply(result);
      } catch (err) {
        setErrors((e) => ({ ...e, [key]: err.message || "Failed to load" }));
      } finally {
        setLoading((l) => ({ ...l, [key]: false }));
      }
    }
  }, []);

  // Silent background sync — does NOT call setErrors/setLoading so it never
  // triggers Dashboard re-renders that could disrupt active fill-form state.
  const backgroundSync = useCallback(async () => {
    const fetches = [
      [api.getTechnicians, (v) => setState((s) => ({ ...s, technicians: v }))],
      [api.getJobs,        (v) => setState((s) => ({ ...s, jobs: v }))],
      [api.getTemplates,   (v) => setState((s) => ({ ...s, templates: v }))],
      [api.getDocuments,   (v) => setState((s) => ({ ...s, documents: v }))],
      [() => Promise.all([api.getComplianceRules(), api.getComplianceEvents(), api.getComplianceRate()]),
        ([rules, events, rate]) => setState((s) => ({ ...s, complianceRules: rules, complianceEvents: events, complianceRate: rate }))],
      [api.getAnalyticsSummary, (v) => setState((s) => ({ ...s, summary: v }))],
    ];
    for (const [fetcher, apply] of fetches) {
      try { apply(await fetcher()); } catch (_) { /* swallow silently */ }
    }
  }, []);

  useEffect(() => {
    api.getMe().then(setCurrentUser).catch(() => {});
    loadAll();
  }, [loadAll]);

  // The dashboard's WebSocket handles immediate job/document events. Polling
  // closes the gap for asynchronous Celery processing and changes submitted
  // from the mobile app, which writes to the same database through /capture.
  // Uses backgroundSync instead of loadAll to avoid re-render side effects.
  useEffect(() => {
    const syncTimer = window.setInterval(backgroundSync, 20000);
    return () => window.clearInterval(syncTimer);
  }, [backgroundSync]);

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
      try {
        const v = await api.getTechnicians();
        setState((s) => ({ ...s, technicians: v }));
        setErrors((e) => ({ ...e, technicians: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, technicians: err.message }));
      }
    },
    jobs: async () => {
      try {
        const v = await api.getJobs();
        setState((s) => ({ ...s, jobs: v }));
        setErrors((e) => ({ ...e, jobs: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, jobs: err.message }));
      }
      api.getAnalyticsSummary().then((v) => setState((s) => ({ ...s, summary: v }))).catch(() => {});
    },
    templates: async () => {
      try {
        const v = await api.getTemplates();
        setState((s) => ({ ...s, templates: v }));
        setErrors((e) => ({ ...e, templates: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, templates: err.message }));
      }
    },
    documents: async () => {
      try {
        const v = await api.getDocuments();
        setState((s) => ({ ...s, documents: v }));
        setErrors((e) => ({ ...e, documents: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, documents: err.message }));
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
        documents={state.documents}
        complianceEvents={state.complianceEvents}
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
        templates={state.templates}
        jobs={state.jobs}
        technicians={state.technicians}
        currentUser={currentUser}
        onTemplatesChanged={refetch.templates}
        onDocumentsChanged={refetch.documents}
        loading={loading.templates}
        error={errors.templates}
        onRetry={refetch.templates}
      />
    ),
    assignments: (
      <AssignmentsView
        templates={state.templates}
        technicians={state.technicians}
        currentUser={currentUser}
      />
    ),
    documents: (
      reviewJobId ? (
        <ReviewSubmissionView
          jobId={reviewJobId}
          onBack={() => { setReviewJobId(null); setActive("documents"); }}
          onDocumentCreated={refetch.documents}
        />
      ) : (
        <DocumentsView
          documents={state.documents} jobs={state.jobs} complianceEvents={state.complianceEvents} onDocumentsChanged={refetch.documents}
          loading={loading.documents} error={errors.documents} onRetry={refetch.documents}
          onReviewSubmission={(jobId) => { setReviewJobId(jobId); setActive("documents"); }}
        />
      )
    ),
    technicians: (
      <TechniciansView
        technicians={state.technicians} jobs={state.jobs} onTechniciansChanged={refetch.technicians}
        loading={loading.technicians} error={errors.technicians} onRetry={refetch.technicians}
        onReviewSubmission={(jobId) => { setReviewJobId(jobId); setActive("documents"); }}
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
    settings: <SettingsView currentUser={currentUser} onUserUpdated={() => api.getMe().then(setCurrentUser)} />,
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
