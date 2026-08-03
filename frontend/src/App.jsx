import React, { useState } from "react";
import {
  LayoutGrid, Briefcase, FileText, FileCheck2, Users, ShieldCheck, BarChart3, Settings, LifeBuoy,
  Search, Bell, ChevronDown, ChevronRight, Mic, Camera, ScanLine, Plus, Upload, Download, Send,
  Check, AlertTriangle, TrendingUp, TrendingDown, X, ArrowRight, Play, Star, LogOut, Menu,
  MoreHorizontal, MapPin, Clock, Zap, Building2, Flame, Wrench, Sun, Radio, ClipboardCheck,
  CircleCheck, CircleAlert, Eye, UserPlus, CreditCard, Puzzle, ToggleLeft, Sparkles, Gauge,
  ListChecks, CalendarDays, Filter, ArrowUpRight, ArrowDownRight, HardHat, Droplets, Thermometer,
  PhoneCall, Quote,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  `}</style>
);

/* ======================================================================
   MOCK DATA
   ====================================================================== */

const TRADE_ICON = {
  Electrical: Zap,
  Plumbing: Droplets,
  HVAC: Thermometer,
  "Fire Safety": Flame,
  Solar: Sun,
  General: Building2,
};

const technicians = [
  { name: "Marcus Reed", trade: "Electrical", status: "On Site", activeJobs: 3, docsWeek: 11, compliance: 98, initials: "MR", color: "bg-blue-600" },
  { name: "Priya Nair", trade: "HVAC", status: "Available", activeJobs: 1, docsWeek: 8, compliance: 95, initials: "PN", color: "bg-violet-600" },
  { name: "Diego Alvarez", trade: "Plumbing", status: "On Site", activeJobs: 2, docsWeek: 9, compliance: 91, initials: "DA", color: "bg-teal-600" },
  { name: "Sarah Kim", trade: "Solar", status: "Off Duty", activeJobs: 0, docsWeek: 6, compliance: 99, initials: "SK", color: "bg-amber-600" },
  { name: "Tom Whitfield", trade: "Fire Safety", status: "On Site", activeJobs: 4, docsWeek: 14, compliance: 88, initials: "TW", color: "bg-red-600" },
  { name: "Aisha Bello", trade: "Electrical", status: "Available", activeJobs: 2, docsWeek: 10, compliance: 96, initials: "AB", color: "bg-blue-600" },
];

const initialJobs = [
  { id: "JOB-1042", customer: "ABC Industries", type: "Electrical Panel Inspection", tech: "Marcus Reed", status: "Awaiting Review", when: "Today, 9:40 AM" },
  { id: "JOB-1041", customer: "Meridian Apartments", type: "HVAC Maintenance", tech: "Priya Nair", status: "In Progress", when: "Today, 11:15 AM" },
  { id: "JOB-1040", customer: "Coastal Diner", type: "Plumbing Repair", tech: "Diego Alvarez", status: "Compliance Flag", when: "Today, 8:05 AM" },
  { id: "JOB-1039", customer: "Whitfield Residence", type: "Fire Alarm Test", tech: "Tom Whitfield", status: "Completed", when: "Yesterday" },
  { id: "JOB-1038", customer: "Sunridge Solar Farm", type: "Panel Install", tech: "Sarah Kim", status: "Completed", when: "Yesterday" },
  { id: "JOB-1037", customer: "Northgate Mall", type: "Electrical Rewiring", tech: "Aisha Bello", status: "Scheduled", when: "Tomorrow, 8:00 AM" },
  { id: "JOB-1036", customer: "Oakview School", type: "HVAC Inspection", tech: "Priya Nair", status: "Completed", when: "2 days ago" },
  { id: "JOB-1035", customer: "Riverside Clinic", type: "Plumbing Inspection", tech: "Diego Alvarez", status: "Awaiting Review", when: "2 days ago" },
];

const templates = [
  { name: "Electrical Inspection Report", trade: "Electrical", fields: 18, used: 142, edited: "3 days ago" },
  { name: "HVAC Service Report", trade: "HVAC", fields: 14, used: 98, edited: "1 week ago" },
  { name: "Plumbing Job Sheet", trade: "Plumbing", fields: 12, used: 76, edited: "2 weeks ago" },
  { name: "Fire Safety Certificate", trade: "Fire Safety", fields: 22, used: 41, edited: "5 days ago" },
  { name: "Standard Invoice", trade: "General", fields: 9, used: 210, edited: "1 day ago" },
  { name: "Warranty Registration", trade: "General", fields: 7, used: 33, edited: "3 weeks ago" },
];

const templateFieldMap = [
  { field: "Customer Name", source: "Job record", confidence: 99 },
  { field: "Equipment Type", source: "Image", confidence: 96 },
  { field: "Voltage Reading", source: "OCR (meter)", confidence: 98 },
  { field: "Earth Resistance", source: "Voice note", confidence: 82 },
  { field: "Serial Number", source: "OCR (label)", confidence: 65 },
  { field: "Technician Signature", source: "Image", confidence: 100 },
  { field: "Customer Signature", source: "Image", confidence: 100 },
];

const documents = [
  { name: "Electrical Inspection Report", job: "JOB-1042 · ABC Industries", tech: "Marcus Reed", confidence: 94, status: "Pending Review" },
  { name: "HVAC Service Report", job: "JOB-1041 · Meridian Apartments", tech: "Priya Nair", confidence: 88, status: "Pending Review" },
  { name: "Plumbing Job Sheet", job: "JOB-1040 · Coastal Diner", tech: "Diego Alvarez", confidence: 71, status: "Pending Review" },
  { name: "Fire Safety Certificate", job: "JOB-1039 · Whitfield Residence", tech: "Tom Whitfield", confidence: 99, status: "Approved" },
  { name: "Standard Invoice", job: "JOB-1038 · Sunridge Solar Farm", tech: "Sarah Kim", confidence: 97, status: "Sent" },
  { name: "HVAC Inspection Report", job: "JOB-1036 · Oakview School", tech: "Priya Nair", confidence: 96, status: "Sent" },
];

const alerts = [
  { level: "High", icon: AlertTriangle, title: "Earth resistance reading missing", desc: "Job #1042 was flagged before the technician left site. Required for electrical sign-off.", action: "Review job" },
  { level: "Medium", icon: ScanLine, title: "Low-confidence field detected", desc: "Serial number on Job #1040 was extracted at 65% confidence and needs a manual check.", action: "Open document" },
  { level: "Low", icon: Sparkles, title: "Template usage suggestion", desc: "3 recent HVAC jobs used a manual template. Switch to the AI-mapped version to save review time.", action: "Update template" },
];

const weeklyDocs = [
  { day: "Mon", docs: 12 }, { day: "Tue", docs: 18 }, { day: "Wed", docs: 15 },
  { day: "Thu", docs: 22 }, { day: "Fri", docs: 19 }, { day: "Sat", docs: 9 }, { day: "Sun", docs: 4 },
];

const complianceRules = [
  { trade: "Electrical", fields: ["Voltage reading", "Current reading", "Earth resistance", "PPE confirmation", "Technician signature", "Customer signature"] },
  { trade: "Plumbing", fields: ["Pressure test reading", "Leak check confirmation", "Material certification", "Customer signature"] },
  { trade: "HVAC", fields: ["Refrigerant level", "Filter status", "Thermostat calibration", "Safety interlock check", "Technician signature"] },
];

const complianceLog = [
  { job: "JOB-1042", msg: "Earth resistance reading missing", level: "High", time: "12 min ago" },
  { job: "JOB-1040", msg: "Serial number below confidence threshold", level: "Medium", time: "1 hr ago" },
  { job: "JOB-1029", msg: "Customer signature missing, auto-blocked send", level: "High", time: "Yesterday" },
  { job: "JOB-1017", msg: "PPE confirmation added after review", level: "Low", time: "2 days ago" },
];

const complianceTrend = [
  { week: "W1", rate: 90 }, { week: "W2", rate: 92 }, { week: "W3", rate: 91 },
  { week: "W4", rate: 94 }, { week: "W5", rate: 96 }, { week: "W6", rate: 97 },
];

const docTimeTrend = [
  { week: "W1", mins: 42 }, { week: "W2", mins: 37 }, { week: "W3", mins: 33 },
  { week: "W4", mins: 29 }, { week: "W5", mins: 24 }, { week: "W6", mins: 19 },
];

const accuracyTrend = [
  { week: "W1", pct: 89 }, { week: "W2", pct: 91 }, { week: "W3", pct: 92 },
  { week: "W4", pct: 94 }, { week: "W5", pct: 95 }, { week: "W6", pct: 96 },
];

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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${SEVERITY_TONE[level]}`}>
      {level}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const tone = value >= 90 ? "bg-emerald-500" : value >= 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="h-1.5 flex-1 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="fs-mono text-xs text-stone-500 w-8">{value}%</span>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-stone-100 fs-card-shadow ${className}`}>{children}</div>;
}

function IconBadge({ icon: Icon, className }) {
  return (
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

/* ======================================================================
   LANDING PAGE
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
   AUTH PAGE
   ====================================================================== */

function AuthPage({ onEnter, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("Growth");

  const goSignupStep2 = (e) => { e.preventDefault(); setStep(2); };

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
                onClick={() => { setMode("login"); setStep(1); }}
                className={`flex-1 text-sm font-semibold py-2 rounded-full transition ${mode === "login" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
              >
                Log in
              </button>
              <button
                onClick={() => { setMode("signup"); setStep(1); }}
                className={`flex-1 text-sm font-semibold py-2 rounded-full transition ${mode === "signup" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
              >
                Sign up
              </button>
            </div>

            {mode === "login" && (
              <form onSubmit={(e) => { e.preventDefault(); onEnter(); }} className="space-y-4">
                <h1 className="fs-display text-xl font-semibold text-stone-900 mb-1">Welcome back</h1>
                <p className="text-sm text-stone-500 mb-5">Log in to your business dashboard.</p>
                <div>
                  <label className="text-xs font-medium text-stone-600">Work email</label>
                  <input type="email" defaultValue="priya@meridianfieldworks.com" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-stone-600">Password</label>
                    <a href="#" className="text-xs text-orange-600 font-medium">Forgot password?</a>
                  </div>
                  <input type="password" defaultValue="••••••••••" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                </div>
                <button type="submit" className="w-full text-sm font-semibold text-white py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm mt-2">
                  Log in to dashboard
                </button>
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
                  <input placeholder="Meridian Field Works" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600">Full name</label>
                    <input placeholder="Priya Nair" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600">Primary trade</label>
                    <select className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 bg-white">
                      <option>Electrical</option><option>Plumbing</option><option>HVAC</option><option>Solar</option><option>Fire Safety</option><option>General</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Work email</label>
                  <input type="email" placeholder="you@company.com" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Password</label>
                  <input type="password" placeholder="Create a password" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
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
                  <button onClick={onEnter} className="flex-1 text-sm font-semibold text-white py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm">Create account</button>
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

function Topbar({ title, setMobileOpen }) {
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
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold">PN</div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-stone-800 leading-tight">Hi, Priya 👋</p>
            <p className="text-xs text-stone-500 leading-tight">Owner</p>
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

function OverviewView({ onCreateJob }) {
  const statCards = [
    { icon: Briefcase, color: "bg-blue-600", label: "Active Jobs Today", value: "16", trend: "+3 vs yesterday", up: true },
    { icon: FileCheck2, color: "bg-violet-600", label: "Documents Pending Review", value: "7", trend: "-2 vs yesterday", up: false },
    { icon: AlertTriangle, color: "bg-red-600", label: "Open Compliance Alerts", value: "2", trend: "-1 vs yesterday", up: false },
    { icon: Gauge, color: "bg-teal-600", label: "AI Auto-Approval Rate", value: "82%", trend: "+4% vs last week", up: true },
  ];

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

      <div className="flex flex-wrap items-center gap-3">
        {[["CalendarDays", "Today"], ["Filter", "All technicians"], ["Building2", "All job types"]].map(([, label]) => (
          <button key={label} className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-full px-4 py-2">
            {label} <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-4">Avg documentation accuracy</p>
              <div className="relative flex items-center justify-center">
                <svg viewBox="0 0 200 120" className="w-full max-w-xs">
                  <path d="M20,110 A90,90 0 0,1 180,110" fill="none" stroke="#f1efec" strokeWidth="16" strokeLinecap="round" />
                  <path d="M20,110 A90,90 0 0,1 180,110" fill="none" stroke="url(#gaugeGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray="220 283" />
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f43f5e" /><stop offset="45%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center top-9">
                  <span className="fs-display text-3xl font-semibold text-stone-900">96.2%</span>
                  <span className="text-xs text-stone-500">last 30 days</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-4">Active job status</p>
              <div className="space-y-3.5">
                {initialJobs.slice(0, 4).map((j) => (
                  <div key={j.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{j.tech}</p>
                      <p className="text-xs text-stone-500">{j.id} · {j.type}</p>
                    </div>
                    <StatusPill label={j.status} />
                  </div>
                ))}
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
                <p className={`text-xs flex items-center gap-1 ${s.up ? "text-emerald-600" : "text-red-500"}`}>
                  {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {s.trend}
                </p>
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
              <p className="text-sm font-semibold text-stone-800">AI insights & alerts</p>
            </div>
            <span className="text-xs text-stone-400">Updated 2 min ago</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {alerts.map((a) => (
              <div key={a.title} className="border border-stone-100 rounded-xl p-4 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <a.icon className="h-5 w-5 text-stone-400" />
                  <SeverityTag level={a.level} />
                </div>
                <p className="text-sm font-semibold text-stone-800 mb-1">{a.title}</p>
                <p className="text-xs text-stone-500 leading-relaxed flex-1">{a.desc}</p>
                <button className="mt-4 text-xs font-semibold text-white bg-stone-900 rounded-full py-2">{a.action}</button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-100 text-xs">
            <span className="flex items-center gap-1.5 text-stone-500"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> AI engine analyzed 147 data points today</span>
            <button className="font-semibold text-stone-700 flex items-center gap-1">View all alerts <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </Card>

        <Card className="lg:col-span-4 p-6 bg-gradient-to-br from-orange-500 to-orange-700 text-white border-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Documents generated</p>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full">Weekly</span>
          </div>
          <div className="h-40">
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
          </div>
          <p className="text-xs text-white/80 mt-2">99 documents generated this week, 18% above target.</p>
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — JOBS
   ====================================================================== */

function JobsView() {
  const [jobs, setJobs] = useState(initialJobs);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");

  const filters = ["All", "Scheduled", "In Progress", "Awaiting Review", "Compliance Flag", "Completed"];
  const shown = filter === "All" ? jobs : jobs.filter((j) => j.status === filter);

  const addJob = (e) => {
    e.preventDefault();
    const form = e.target;
    const newJob = {
      id: `JOB-${1043 + jobs.length}`,
      customer: form.customer.value || "New Customer",
      type: form.type.value,
      tech: form.tech.value,
      status: "Scheduled",
      when: "Newly created",
    };
    setJobs([newJob, ...jobs]);
    setShowForm(false);
  };

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
          <form onSubmit={addJob} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-stone-600">Customer name</label>
              <input name="customer" placeholder="e.g. Lakeside Apartments" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Site address</label>
              <input placeholder="e.g. 220 Harbor Rd" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
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
                {technicians.map((t) => <option key={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Scheduled date & time</label>
              <input type="datetime-local" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Notes for technician</label>
              <input placeholder="Optional" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold text-stone-600 px-4 py-2.5">Cancel</button>
              <button type="submit" className="text-sm font-semibold text-white bg-stone-900 rounded-full px-5 py-2.5">Create job</button>
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
                <th className="px-6 py-3 font-medium">Scheduled</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => (
                <tr key={j.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <p className="fs-mono text-xs text-stone-400">{j.id}</p>
                    <p className="font-medium text-stone-800">{j.type}</p>
                  </td>
                  <td className="px-6 py-4 text-stone-600">{j.customer}</td>
                  <td className="px-6 py-4 text-stone-600">{j.tech}</td>
                  <td className="px-6 py-4"><StatusPill label={j.status} /></td>
                  <td className="px-6 py-4 text-stone-500">{j.when}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 rounded-lg hover:bg-stone-100"><Eye className="h-4 w-4 text-stone-500" /></button>
                      <button className="p-2 rounded-lg hover:bg-stone-100"><MoreHorizontal className="h-4 w-4 text-stone-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-3 text-xs text-stone-500 border-t border-stone-100">
          <span>Showing {shown.length} of {jobs.length} jobs</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-stone-200">Previous</button>
            <button className="px-3 py-1.5 rounded-lg border border-stone-200">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — TEMPLATES
   ====================================================================== */

function TemplatesView() {
  const [selected, setSelected] = useState(null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Document templates</h1>
          <p className="text-sm text-stone-500 mt-1">Upload your existing forms — AI maps job data onto them automatically.</p>
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
          <Upload className="h-4 w-4" /> Upload template
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((t) => {
          const Icon = TRADE_ICON[t.trade] || FileText;
          return (
            <Card key={t.name} className="p-5 cursor-pointer hover:border-orange-200" onClick={() => setSelected(t)}>
              <div className="flex items-start justify-between mb-4">
                <IconBadge icon={Icon} className="bg-gradient-to-br from-orange-500 to-orange-700" />
                <span className="text-xs font-medium text-stone-400">{t.trade}</span>
              </div>
              <p className="font-semibold text-stone-800 mb-1">{t.name}</p>
              <p className="text-xs text-stone-500 mb-4">{t.fields} mapped fields · used {t.used} times</p>
              <div className="flex items-center justify-between text-xs text-stone-400 pt-3 border-t border-stone-100">
                <span>Edited {t.edited}</span>
                <span className="font-semibold text-orange-600 flex items-center gap-1">Edit <ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </Card>
          );
        })}
        <div className="border-2 border-dashed border-stone-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center text-stone-400 hover:border-orange-300 hover:text-orange-500 cursor-pointer min-h-48">
          <Upload className="h-6 w-6 mb-2" />
          <p className="text-sm font-medium">Upload a PDF or Word form</p>
          <p className="text-xs mt-1">AI will detect fields and layout automatically</p>
        </div>
      </div>

      {selected && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-stone-800">{selected.name} — AI field mapping</p>
              <p className="text-xs text-stone-500 mt-0.5">Shows where each field's data comes from and how confident the AI is.</p>
            </div>
            <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-stone-400" /></button>
          </div>
          <div className="space-y-2">
            {templateFieldMap.map((f) => (
              <div key={f.field} className="flex items-center justify-between border-b border-stone-50 last:border-0 py-2.5">
                <div>
                  <p className="text-sm font-medium text-stone-800">{f.field}</p>
                  <p className="text-xs text-stone-400">Source: {f.source}</p>
                </div>
                <ConfidenceBar value={f.confidence} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ======================================================================
   DASHBOARD — DOCUMENTS
   ====================================================================== */

function DocumentsView() {
  const [docs, setDocs] = useState(documents);
  const [reviewing, setReviewing] = useState(null);
  const [tab, setTab] = useState("All");
  const tabs = ["All", "Pending Review", "Approved", "Sent"];
  const shown = tab === "All" ? docs : docs.filter((d) => d.status === tab);

  const approve = () => {
    setDocs(docs.map((d) => (d.name === reviewing.name && d.job === reviewing.job ? { ...d, status: "Approved" } : d)));
    setReviewing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Generated documents</h1>
        <p className="text-sm text-stone-500 mt-1">Review AI-drafted documents before they're sent to customers.</p>
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
                  <th className="px-6 py-3 font-medium">Technician</th>
                  <th className="px-6 py-3 font-medium">Confidence</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.name + d.job} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-stone-800">{d.name}</p>
                      <p className="text-xs text-stone-400">{d.job}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-600">{d.tech}</td>
                    <td className="px-6 py-4"><ConfidenceBar value={d.confidence} /></td>
                    <td className="px-6 py-4"><StatusPill label={d.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setReviewing(d)} className="text-xs font-semibold text-stone-700 border border-stone-200 rounded-full px-3 py-1.5">Review</button>
                        <button className="p-2 rounded-lg hover:bg-stone-100"><Download className="h-4 w-4 text-stone-500" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            <p className="text-xs text-stone-500 mb-4">{reviewing.job} · {reviewing.tech}</p>
            <div className="space-y-2 mb-5">
              {templateFieldMap.map((f) => (
                <div key={f.field} className="flex items-center justify-between border-b border-stone-50 last:border-0 py-2">
                  <p className="text-sm text-stone-700">{f.field}</p>
                  <ConfidenceBar value={f.confidence} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {["Before photo", "After photo", "Meter reading"].map((label) => (
                <div key={label} className="aspect-square rounded-xl bg-stone-100 flex items-center justify-center text-stone-400">
                  <Camera className="h-5 w-5" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="flex-1 text-sm font-semibold text-stone-700 border border-stone-200 rounded-full py-2.5">Request changes</button>
              <button onClick={approve} className="flex-1 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full py-2.5 flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> Approve & send
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

function TechniciansView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="fs-display text-2xl font-semibold text-stone-900">Technicians</h1>
          <p className="text-sm text-stone-500 mt-1">Monitor field team activity, workload, and documentation quality.</p>
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-full px-4 py-2 shadow-sm">
          <UserPlus className="h-4 w-4" /> Invite technician
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {technicians.map((t) => {
          const Icon = TRADE_ICON[t.trade] || Building2;
          return (
            <Card key={t.name} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-semibold`}>{t.initials}</div>
                  <div>
                    <p className="font-semibold text-stone-800">{t.name}</p>
                    <p className="text-xs text-stone-500 flex items-center gap-1"><Icon className="h-3 w-3" /> {t.trade}</p>
                  </div>
                </div>
                <StatusPill label={t.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-stone-100 pt-4">
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.activeJobs}</p>
                  <p className="text-xs text-stone-500">Active jobs</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.docsWeek}</p>
                  <p className="text-xs text-stone-500">Docs / week</p>
                </div>
                <div>
                  <p className="fs-display font-semibold text-stone-900">{t.compliance}%</p>
                  <p className="text-xs text-stone-500">Compliance</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — COMPLIANCE
   ====================================================================== */

function ComplianceView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-display text-2xl font-semibold text-stone-900">Compliance engine</h1>
        <p className="text-sm text-stone-500 mt-1">Required fields by trade, and recent alerts caught before jobs closed out.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-5">
          {complianceRules.map((r) => {
            const Icon = TRADE_ICON[r.trade] || Building2;
            return (
              <Card key={r.trade} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <IconBadge icon={Icon} className="bg-gradient-to-br from-orange-500 to-orange-700" />
                    <p className="font-semibold text-stone-800">{r.trade}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Active</span>
                </div>
                <ul className="space-y-2">
                  {r.fields.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                      <CircleCheck className="h-4 w-4 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          <Card className="p-5 flex flex-col items-center justify-center text-center border-2 border-dashed border-stone-200 text-stone-400 min-h-40">
            <Plus className="h-5 w-5 mb-2" />
            <p className="text-sm font-medium">Add a custom rule set</p>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold text-stone-800 mb-4">Compliance rate — last 6 weeks</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={complianceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
                  <XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" domain={[80, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-semibold text-stone-800 mb-4">Recent compliance alerts</p>
            <div className="space-y-3">
              {complianceLog.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CircleAlert className={`h-4 w-4 mt-0.5 shrink-0 ${l.level === "High" ? "text-red-500" : l.level === "Medium" ? "text-amber-500" : "text-sky-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm text-stone-700"><span className="font-medium">{l.job}</span> — {l.msg}</p>
                    <p className="text-xs text-stone-400">{l.time}</p>
                  </div>
                </div>
              ))}
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

function AnalyticsView() {
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
                <XAxis dataKey="initials" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v, p) => (p && p[0] ? p[0].payload.name : v)} />
                <Bar dataKey="docsWeek" fill="#f2622a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Avg documentation time (minutes)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={docTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="mins" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">AI extraction accuracy</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accuracyTrend}>
                <defs>
                  <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} /><stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" domain={[80, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="pct" stroke="#0d9488" strokeWidth={2.5} fill="url(#accFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold text-stone-800 mb-4">Compliance rate</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1efec" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" domain={[80, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================
   DASHBOARD — SETTINGS
   ====================================================================== */

function SettingsView() {
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
            <label className="text-xs font-medium text-stone-600">Business name</label>
            <input defaultValue="Meridian Field Works" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600">Primary trade</label>
            <select className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
              <option>Electrical</option><option>Plumbing</option><option>HVAC</option><option>Multi-trade</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-stone-600">Business address</label>
            <input defaultValue="220 Harbor Road, Suite 4, Portland, OR" className="mt-1 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-stone-800">Subscription & billing</p>
          <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">Growth Plan</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-4 w-4 text-stone-400" />
          <p className="text-sm text-stone-600">8 of 15 technician seats used</p>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600" style={{ width: "53%" }} />
        </div>
        <div className="flex gap-3">
          <button className="text-sm font-semibold text-stone-700 border border-stone-200 rounded-full px-4 py-2">Manage billing</button>
          <button className="text-sm font-semibold text-white bg-stone-900 rounded-full px-4 py-2">Upgrade plan</button>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-semibold text-stone-800 mb-4">Team & permissions</p>
        <div className="space-y-3">
          {[
            { name: "Priya Nair", role: "Owner" }, { name: "Marcus Reed", role: "Admin" }, { name: "Diego Alvarez", role: "Technician" },
          ].map((m) => (
            <div key={m.name} className="flex items-center justify-between border-b border-stone-50 last:border-0 pb-3 last:pb-0">
              <p className="text-sm text-stone-700">{m.name}</p>
              <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">{m.role}</span>
            </div>
          ))}
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
   DASHBOARD — ROOT
   ====================================================================== */

const VIEW_TITLES = {
  overview: "Overview", jobs: "Jobs", templates: "Templates", documents: "Documents",
  technicians: "Technicians", compliance: "Compliance", analytics: "Analytics", settings: "Settings",
};

function Dashboard({ onLogout }) {
  const [active, setActive] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const view = {
    overview: <OverviewView onCreateJob={() => setActive("jobs")} />,
    jobs: <JobsView />,
    templates: <TemplatesView />,
    documents: <DocumentsView />,
    technicians: <TechniciansView />,
    compliance: <ComplianceView />,
    analytics: <AnalyticsView />,
    settings: <SettingsView />,
  }[active];

  return (
    <div className="fs-root min-h-screen bg-stone-100 flex">
      <GlobalStyle />
      <Sidebar active={active} setActive={setActive} onLogout={onLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={VIEW_TITLES[active]} setMobileOpen={setMobileOpen} />
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
    return <AuthPage onEnter={() => setScreen("dashboard")} onBack={() => setScreen("landing")} />;
  }
  if (screen === "dashboard") {
    return <Dashboard onLogout={() => setScreen("landing")} />;
  }
  return <LandingPage onLogin={() => setScreen("auth")} onSignup={() => setScreen("auth")} />;
}