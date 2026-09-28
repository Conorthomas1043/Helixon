// Everything the role input needs to work for any kind of job - warehouse,
// kitchen, care home, building site or boardroom: job types, starting-point
// templates, must-have suggestions, the "build it" form that writes a spec
// for hirers who don't have one, and a checklist of what a spec covers.

export const JOB_TYPES = [
  { id: "warehouse", label: "Warehouse & logistics", icon: "box", titles: ["Warehouse Operative", "Picker Packer", "Forklift Driver", "Goods In Operative", "Warehouse Team Leader"] },
  { id: "driving", label: "Driving & delivery", icon: "truck", titles: ["Delivery Driver", "HGV Class 1 Driver", "Van Driver", "Courier", "Bus Driver"] },
  { id: "hospitality", label: "Hospitality & food", icon: "cup", titles: ["Kitchen Porter", "Chef de Partie", "Waiter / Waitress", "Barista", "Bar Staff", "Hotel Housekeeper"] },
  { id: "retail", label: "Retail", icon: "bag", titles: ["Sales Assistant", "Store Supervisor", "Store Manager", "Stock Replenishment Assistant", "Cashier"] },
  { id: "care", label: "Care & health", icon: "heart", titles: ["Care Assistant", "Senior Carer", "Support Worker", "Healthcare Assistant", "Registered Nurse"] },
  { id: "cleaning", label: "Cleaning & facilities", icon: "sparkle", titles: ["Cleaner", "Commercial Cleaner", "Caretaker", "Maintenance Operative", "Facilities Assistant"] },
  { id: "construction", label: "Construction & trades", icon: "hardhat", titles: ["General Labourer", "Electrician", "Plumber", "Carpenter / Joiner", "Site Manager", "Groundworker"] },
  { id: "manufacturing", label: "Manufacturing", icon: "cog", titles: ["Production Operative", "Machine Operator", "Assembly Operative", "Quality Inspector", "Production Supervisor"] },
  { id: "security", label: "Security", icon: "shield", titles: ["Security Officer", "Door Supervisor", "CCTV Operator", "Mobile Patrol Officer"] },
  { id: "customer", label: "Customer service & sales", icon: "headset", titles: ["Customer Service Advisor", "Call Centre Agent", "Sales Executive", "Account Manager", "Business Development Manager"] },
  { id: "office", label: "Office & admin", icon: "clipboard", titles: ["Administrator", "Receptionist", "Office Manager", "Bookkeeper", "HR Assistant"] },
  { id: "professional", label: "Professional & tech", icon: "briefcase", titles: ["Software Engineer", "Accountant", "Project Manager", "Marketing Manager", "Operations Manager"] },
];

export const JOB_TYPE_BY_ID = Object.fromEntries(JOB_TYPES.map((t) => [t.id, t]));

// One-click suggestions for the must-haves field. Deliberately no physical
// or health requirements ("able to lift 25kg") - those aren't something to
// screen a CV on (see config.js PROTECTED_ATTRIBUTE_PATTERNS).
const COMMON_MUST_HAVES = ["Right to work in the UK"];

export const MUST_HAVE_SUGGESTIONS = {
  warehouse: ["Counterbalance forklift licence", "Reach truck licence", "Available for night shifts", "Available weekends", "Own transport", "Experience using RF scanners"],
  driving: ["Full UK driving licence", "HGV Class 1 (C+E) licence", "Driver CPC", "Digital tachograph card", "No more than 6 points on licence", "Multi-drop experience"],
  hospitality: ["Food Hygiene Level 2", "Available evenings and weekends", "Experience in a busy kitchen", "Barista experience", "Personal licence holder"],
  retail: ["Available weekends", "Cash handling experience", "Experience in a retail role", "Key holder experience"],
  care: ["Enhanced DBS check", "Care Certificate", "NVQ Level 2 in Health and Social Care", "Full UK driving licence", "Medication administration training", "NMC registration"],
  cleaning: ["Enhanced DBS check", "COSHH trained", "Available early mornings", "Own transport"],
  construction: ["CSCS card", "18th Edition wiring regulations", "Gas Safe registered", "IPAF licence", "Own tools", "Full UK driving licence"],
  manufacturing: ["Available for rotating shifts", "Forklift licence", "Experience on a production line", "Experience with quality checks"],
  security: ["SIA licence", "SIA Door Supervisor licence", "Available nights and weekends", "First aid certificate"],
  customer: ["Experience in a customer-facing role", "B2B sales experience", "CRM experience (e.g. Salesforce)", "Full UK driving licence"],
  office: ["Microsoft Office / Excel", "Experience in an office role", "Minute taking", "Xero or Sage experience"],
  professional: ["Degree or equivalent experience", "Relevant professional qualification", "Experience managing a team"],
};

export function mustHaveSuggestions(jobType) {
  return [...COMMON_MUST_HAVES, ...(MUST_HAVE_SUGGESTIONS[jobType] || [])];
}

// Rough keyword guess of the job type from free text, to offer relevant
// must-have suggestions for a pasted advert. Only drives suggestions -
// scoring does its own, far better classification server-side.
const TYPE_KEYWORDS = {
  warehouse: /\b(warehouse|picker|packer|picking|forklift|reach truck|goods in|distribution centre|logistics)\b/i,
  driving: /\b(driver|driving|hgv|lgv|courier|multi-?drop|van)\b/i,
  hospitality: /\b(chef|kitchen|waiter|waitress|barista|bar staff|restaurant|hotel|housekeep|front of house|catering)\b/i,
  retail: /\b(retail|sales assistant|store|shop|cashier|merchandis|stock replenishment)\b/i,
  care: /\b(care assistant|carer|support worker|care home|domiciliary|healthcare assistant|nurse|nursing|residents|patients)\b/i,
  cleaning: /\b(cleaner|cleaning|housekeeping|caretaker|janitor|facilities)\b/i,
  construction: /\b(labourer|electrician|plumber|carpenter|joiner|bricklayer|site manager|groundwork|construction|cscs|plasterer|scaffold)\b/i,
  manufacturing: /\b(production|manufacturing|machine operator|assembly|factory|quality inspector)\b/i,
  security: /\b(security officer|door supervisor|sia|cctv|patrol)\b/i,
  customer: /\b(customer service|call centre|contact centre|sales executive|account manager|business development|telesales)\b/i,
  office: /\b(administrator|admin assistant|receptionist|office manager|bookkeeper|secretary|pa to)\b/i,
};

export function guessJobType(text = "") {
  if (!text.trim()) return "";
  const head = text.slice(0, 3000);
  for (const [type, re] of Object.entries(TYPE_KEYWORDS)) {
    if (re.test(head)) return type;
  }
  return "professional";
}

// ── Build it ────────────────────────────────────────────────────────────

export const WORK_PATTERNS = ["Full-time", "Part-time", "Day shifts", "Night shifts", "Weekends", "Rotating shifts", "Temporary", "Permanent", "Zero hours", "Remote", "Hybrid"];

export const EXPERIENCE_OPTIONS = [
  { value: "none", label: "No experience needed", text: "No previous experience needed - full training given." },
  { value: "some", label: "Some experience", text: "Some experience in similar work is preferred." },
  { value: "1", label: "1+ years", text: "At least 1 year of experience in a similar role." },
  { value: "2", label: "2+ years", text: "At least 2 years of experience in a similar role." },
  { value: "5", label: "5+ years", text: "At least 5 years of experience in a similar role." },
];

export const EMPTY_ROLE_DRAFT = {
  jobType: "",
  title: "",
  location: "",
  payMin: "",
  payMax: "",
  payPeriod: "hour",
  patterns: [],
  experience: "",
  duties: "",
  mustHaves: [],
  niceToHaves: [],
};

function fmtPay(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!n) return "";
  return n % 1 ? `£${n.toFixed(2)}` : `£${n.toLocaleString("en-GB")}`;
}

// Turns the form into a plain-English spec - the same kind of text a
// pasted advert would be, so scoring reads it exactly the same way.
export function composeRoleText(draft) {
  const lines = [];
  const type = JOB_TYPE_BY_ID[draft.jobType];

  if (draft.title.trim()) lines.push(`Job title: ${draft.title.trim()}`);
  if (type) lines.push(`Type of work: ${type.label}`);
  if (draft.location.trim()) lines.push(`Location: ${draft.location.trim()}`);

  const min = fmtPay(draft.payMin);
  const max = fmtPay(draft.payMax);
  if (min || max) {
    const range = min && max && min !== max ? `${min}-${max}` : min || max;
    lines.push(`Pay: ${range} ${draft.payPeriod === "year" ? "per year" : "per hour"}`);
  }
  if (draft.patterns.length) lines.push(`Hours: ${draft.patterns.join(", ")}`);

  const exp = EXPERIENCE_OPTIONS.find((o) => o.value === draft.experience);
  if (exp) lines.push(`Experience: ${exp.text}`);

  const duties = draft.duties
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (duties.length) {
    lines.push("", "What the job involves:", ...duties.map((d) => `- ${d}`));
  }
  if (draft.mustHaves.length) {
    lines.push("", "Essential requirements:", ...draft.mustHaves.map((m) => `- ${m}`));
  }
  if (draft.niceToHaves.length) {
    lines.push("", "Desirable:", ...draft.niceToHaves.map((m) => `- ${m}`));
  }
  return lines.join("\n");
}

// ── Spec checklist ──────────────────────────────────────────────────────

// What a spec covers, so the hirer can see at a glance what would make the
// score sharper. Heuristic and forgiving - it only guides, never blocks.
const CHECKS = [
  { key: "title", label: "Job title", tip: "Start with the job title.", test: (t, lines) => lines[0]?.length > 2 && lines[0].length <= 90 },
  { key: "duties", label: "What they'll do", tip: "A few lines on the day-to-day work help the match.", test: (t) => /\b(responsibilit|duties|you will|you'll|day[- ]to[- ]day|the role|involves|what you.ll be doing|tasks)\b/i.test(t) },
  { key: "requirements", label: "Requirements", tip: "List what's essential - skills, licences, experience.", test: (t) => /\b(essential|required|requirements|must have|must be|you.ll need|you will need|what we.re looking for|experience|licen[cs]e|qualification)\b/i.test(t) },
  { key: "pay", label: "Pay", tip: "Adding the pay rate makes the salary guide more accurate.", test: (t) => /([£$€]\s?\d|\bper (hour|annum|year|day)\b|\bp\/?h\b|\/hr\b|\bsalary\b|\bdoe\b|\bcompetitive\b)/i.test(t) },
  { key: "location", label: "Location", tip: "Say where the job is, or that it's remote.", test: (t) => /\b(location|based in|based at|remote|hybrid|on-?site|site in|office in|near|postcode|[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i.test(t) },
  { key: "hours", label: "Hours", tip: "Mention the hours - full-time, part-time, shifts, nights or weekends.", test: (t) => /\b(full[- ]time|part[- ]time|shifts?|hours|nights?|weekends?|rota|monday|mon-fri|days per week|temporary|permanent|contract)\b/i.test(t) },
];

export function specChecklist(text = "") {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  return CHECKS.map((c) => ({ key: c.key, label: c.label, tip: c.tip, done: trimmed.length > 0 && c.test(trimmed, lines) }));
}

// ── Templates ───────────────────────────────────────────────────────────

export const ROLE_TEMPLATES = [
  {
    id: "warehouse-op", type: "warehouse", title: "Warehouse Operative", level: "Entry-level",
    text: `Warehouse Operative

Location: Distribution centre (on-site)
Pay: £12.50 per hour, plus night shift premium
Hours: Full-time, rotating day and night shifts including weekends

What the job involves:
- Picking and packing customer orders accurately using an RF scanner
- Loading and unloading deliveries
- Keeping the warehouse clean, tidy and safe

Essential requirements:
- Right to work in the UK
- Available for rotating shifts and weekends

Desirable:
- Previous warehouse experience
- Counterbalance or reach truck licence`,
  },
  {
    id: "flt-driver", type: "warehouse", title: "Forklift Driver", level: "Skilled",
    text: `Forklift Driver (Counterbalance / Reach)

Location: On-site warehouse
Pay: £13.50 per hour
Hours: Full-time, days, Monday to Friday

What the job involves:
- Loading and unloading trailers with a counterbalance forklift
- Putting away and replenishing stock with a reach truck
- Carrying out daily pre-use checks on equipment

Essential requirements:
- Valid counterbalance and reach truck licences
- At least 1 year of forklift experience in a warehouse
- Right to work in the UK`,
  },
  {
    id: "delivery-driver", type: "driving", title: "Delivery Driver", level: "Entry-level",
    text: `Multi-drop Delivery Driver

Location: Local depot, deliveries across the region
Pay: £12.80 per hour
Hours: Full-time, 5 days out of 7 including some weekends

What the job involves:
- Delivering parcels to homes and businesses on a planned route (80-120 drops a day)
- Loading the van in the correct drop order
- Using a handheld device to record deliveries and collect signatures

Essential requirements:
- Full UK manual driving licence held for at least 2 years
- No more than 6 points on licence
- Right to work in the UK`,
  },
  {
    id: "hgv-driver", type: "driving", title: "HGV Class 1 Driver", level: "Skilled",
    text: `HGV Class 1 (C+E) Driver

Location: Depot-based, trunking and multi-drop routes
Pay: £17-£19 per hour
Hours: Full-time, nights available

What the job involves:
- Driving articulated vehicles safely and legally to delivery points
- Completing vehicle checks and paperwork
- Working to delivery schedules

Essential requirements:
- HGV Class 1 (C+E) licence
- Valid Driver CPC and digital tachograph card
- At least 1 year of Class 1 driving experience`,
  },
  {
    id: "kitchen-porter", type: "hospitality", title: "Kitchen Porter", level: "Entry-level",
    text: `Kitchen Porter

Location: Busy city-centre restaurant
Pay: £11.75 per hour plus tips
Hours: Part-time or full-time, evenings and weekends

What the job involves:
- Washing pots, pans and dishes and keeping the kitchen clean
- Helping chefs with basic food preparation
- Receiving and putting away deliveries

Essential requirements:
- Available evenings and weekends
- Right to work in the UK

Desirable:
- Food Hygiene Level 2
- Previous kitchen experience`,
  },
  {
    id: "chef-de-partie", type: "hospitality", title: "Chef de Partie", level: "Skilled",
    text: `Chef de Partie

Location: Hotel restaurant
Pay: £30,000 per year
Hours: Full-time, 45 hours a week on a rota including weekends

What the job involves:
- Running a section of the kitchen during service
- Preparing dishes to spec and to a high standard
- Training and supporting commis chefs

Essential requirements:
- At least 2 years of experience as a chef in a quality kitchen
- Food Hygiene Level 2 or above`,
  },
  {
    id: "sales-assistant", type: "retail", title: "Sales Assistant", level: "Entry-level",
    text: `Retail Sales Assistant

Location: High street store
Pay: £11.60 per hour
Hours: Part-time, 16-24 hours a week including weekends

What the job involves:
- Serving customers and working the till
- Replenishing stock and keeping the shop floor tidy
- Helping customers find what they need

Essential requirements:
- Available weekends
- Friendly and confident with customers

Desirable:
- Previous retail or customer service experience`,
  },
  {
    id: "store-manager", type: "retail", title: "Store Manager", level: "Senior",
    text: `Store Manager

Location: Retail store
Pay: £32,000-£36,000 per year plus bonus
Hours: Full-time, including weekends on a rota

What the job involves:
- Running the store day to day and hitting sales targets
- Recruiting, training and managing a team of 15
- Managing rotas, stock, budgets and store standards

Essential requirements:
- At least 2 years of experience managing a retail store or department
- Experience managing a team`,
  },
  {
    id: "care-assistant", type: "care", title: "Care Assistant", level: "Entry-level",
    text: `Care Assistant

Location: Residential care home
Pay: £12.00 per hour
Hours: Full-time or part-time, days or nights, including alternate weekends

What the job involves:
- Supporting residents with personal care, meals and mobility
- Helping residents take part in activities
- Keeping accurate care records

Essential requirements:
- Enhanced DBS check (or willing to obtain one)
- Right to work in the UK

Desirable:
- Care Certificate or NVQ Level 2 in Health and Social Care
- Experience in a care setting`,
  },
  {
    id: "senior-carer", type: "care", title: "Senior Carer", level: "Skilled",
    text: `Senior Carer

Location: Nursing home
Pay: £13.50 per hour
Hours: Full-time, 12-hour day shifts on a rota

What the job involves:
- Leading a team of care assistants on shift
- Administering medication and keeping MAR charts
- Writing and reviewing care plans

Essential requirements:
- At least 1 year of experience as a carer
- NVQ Level 3 in Health and Social Care (or working towards)
- Medication administration training
- Enhanced DBS check`,
  },
  {
    id: "cleaner", type: "cleaning", title: "Commercial Cleaner", level: "Entry-level",
    text: `Commercial Cleaner

Location: Office buildings in the city centre
Pay: £11.50 per hour
Hours: Part-time, early mornings (6am-9am) Monday to Friday

What the job involves:
- Cleaning offices, kitchens and washrooms to a high standard
- Emptying bins and restocking supplies
- Using cleaning chemicals safely

Essential requirements:
- Available early mornings
- Right to work in the UK

Desirable:
- COSHH training
- Previous cleaning experience`,
  },
  {
    id: "labourer", type: "construction", title: "General Labourer", level: "Entry-level",
    text: `General Labourer

Location: Construction sites across the region
Pay: £14 per hour
Hours: Full-time, Monday to Friday, 7:30am-5pm

What the job involves:
- Keeping the site clean, safe and organised
- Moving materials and supporting trades on site
- Basic groundworks and loading out

Essential requirements:
- Valid CSCS card
- Own PPE
- Right to work in the UK

Desirable:
- Full UK driving licence`,
  },
  {
    id: "electrician", type: "construction", title: "Electrician", level: "Skilled",
    text: `Approved Electrician

Location: Domestic and commercial jobs across the region (van provided)
Pay: £38,000-£44,000 per year
Hours: Full-time, Monday to Friday

What the job involves:
- Installing, testing and inspecting electrical systems
- Fault finding and repairs
- Completing certification to BS 7671

Essential requirements:
- NVQ Level 3 in Electrotechnical Installation
- 18th Edition wiring regulations
- Full UK driving licence
- Gold card (ECS / JIB)`,
  },
  {
    id: "production-operative", type: "manufacturing", title: "Production Operative", level: "Entry-level",
    text: `Production Operative

Location: Food manufacturing site
Pay: £12.20 per hour plus shift allowance
Hours: Full-time, 4 on 4 off rotating shifts

What the job involves:
- Working on a production line, packing and labelling products
- Carrying out quality checks
- Following hygiene and safety procedures

Essential requirements:
- Available for rotating shifts including nights
- Right to work in the UK

Desirable:
- Experience in food production or manufacturing`,
  },
  {
    id: "security-officer", type: "security", title: "Security Officer", level: "Entry-level",
    text: `Security Officer

Location: Corporate office building
Pay: £12.60 per hour
Hours: Full-time, 12-hour shifts including nights and weekends

What the job involves:
- Controlling access and welcoming visitors
- Patrolling the site and monitoring CCTV
- Responding to alarms and incidents and writing reports

Essential requirements:
- Valid SIA Security Guarding licence
- Available nights and weekends
- 5-year checkable work history`,
  },
  {
    id: "customer-service", type: "customer", title: "Customer Service Advisor", level: "Entry-level",
    text: `Customer Service Advisor

Location: Contact centre (hybrid after training)
Pay: £24,000 per year
Hours: Full-time, 37.5 hours a week on a rota between 8am and 8pm

What the job involves:
- Handling customer calls, emails and web chats
- Resolving queries and complaints first time where possible
- Recording interactions on the CRM system

Essential requirements:
- Experience in a customer-facing role
- Confident using computers

Desirable:
- Call centre experience`,
  },
  {
    id: "sales-exec", type: "customer", title: "Sales Executive", level: "Mid-level",
    text: `Sales Executive

Pay: £28,000-£32,000 per year plus commission
Hours: Full-time

What the job involves:
- Generating new business through outbound calls, email and LinkedIn
- Running demos and negotiating deals
- Managing a pipeline in the CRM

Essential requirements:
- At least 2 years of B2B sales experience
- Track record of hitting targets
- Strong communication and negotiation skills`,
  },
  {
    id: "sales-sdr", type: "customer", title: "SDR / BDR", level: "Entry-level",
    text: `Sales / Business Development Representative

Hours: Full-time

What the job involves:
- High-volume outbound prospecting by phone, email and LinkedIn
- Qualifying leads and booking meetings for account executives

Essential requirements:
- 0-2 years in outbound sales or customer-facing work
- Organised, target-driven and coachable
- Strong written and verbal communication`,
  },
  {
    id: "customer-success", type: "customer", title: "Customer Success Manager", level: "Mid-level",
    text: `Customer Success Manager

Hours: Full-time

What the job involves:
- Owning a portfolio of key accounts
- Driving renewals and upsell conversations
- Onboarding new customers

Essential requirements:
- At least 2 years in a customer success or account management role
- Excellent stakeholder management

Desirable:
- SaaS experience`,
  },
  {
    id: "administrator", type: "office", title: "Administrator", level: "Entry-level",
    text: `Office Administrator

Location: Office-based
Pay: £23,000 per year
Hours: Full-time, Monday to Friday, 9am-5pm

What the job involves:
- Answering phones and emails and greeting visitors
- Data entry, filing and keeping records up to date
- Ordering supplies and supporting the team

Essential requirements:
- Good working knowledge of Microsoft Office, especially Excel and Outlook
- Organised with good attention to detail`,
  },
  {
    id: "ops-manager", type: "professional", title: "Operations Manager", level: "Senior",
    text: `Operations Manager

Hours: Full-time

What the job involves:
- Running day-to-day operations
- Improving processes and managing budgets and P&L
- Managing stakeholders across the business

Essential requirements:
- At least 5 years of experience managing operational teams
- Process improvement experience
- Budget and P&L ownership`,
  },
  {
    id: "software-eng", type: "professional", title: "Software Engineer", level: "Mid-level",
    text: `Software Engineer

Hours: Full-time

What the job involves:
- Building and maintaining features across the product
- Shipping and supporting production code
- Working in an agile team

Essential requirements:
- At least 3 years of professional software development experience
- Proficiency in JavaScript/TypeScript`,
  },
  {
    id: "software-eng-sr", type: "professional", title: "Senior Software Engineer", level: "Senior",
    text: `Senior Software Engineer

Hours: Full-time

What the job involves:
- Owning projects end to end
- System design and architecture
- Mentoring junior engineers

Essential requirements:
- At least 6 years of professional software development experience
- Strong system design and architecture skills
- Experience mentoring engineers`,
  },
];
