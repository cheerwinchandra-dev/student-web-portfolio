// Default site content. The admin dashboard (Profile tab) saves changes on top
// of these values, so you rarely need to edit this file.

export const GITHUB_USERNAME = 'cheerwinchandra-dev';

export const DEFAULT_CONTENT = Object.freeze({
  name: 'Cheerwin Chandra',
  role: 'AI / ML Engineer',
  available: true,
  availabilityText: 'Open to AI/ML roles & internships',
  heroTags: 'ML / LLM / DATA',
  heroLines: ['Machine-learning models', 'LLM agents', 'Fair, explainable AI'],
  quote: 'I build machine-learning systems that are accurate, fair and explainable.',
  bio: 'AI/ML engineer taking models from raw data to live products. I train and calibrate predictive models, audit them for fairness, and build LLM agents that do real work.',
  aboutParagraphs: [
    "I'm Cheerwin, an AI/ML engineer. I work across the whole machine-learning lifecycle: preparing the data, training and comparing models, calibrating and evaluating them, and serving them behind an API that people actually use.",
    'I care about models people can trust. In EduGuard, sensitive attributes stay out of the model and are used only to audit it for gaps in false-positive and false-negative rates, and a person reviews every case. My LLM agents get de-identified prompts, validated outputs and a safe fallback.'
  ],
  aboutPoints: ['End-to-end ML lifecycle', 'Calibration & fairness audits', 'LLM agents with guardrails', 'Always learning'],
  location: 'Bengaluru, India',
  publicEmail: '',
  phone: '',
  linkedin: 'https://www.linkedin.com/in/cheerwin-chandra',
  github: 'https://github.com/cheerwinchandra-dev',
  services: [
    { title: 'Machine Learning', text: 'Predictive models in scikit-learn: logistic regression, random forests and gradient boosting, compared on PR-AUC, ROC-AUC and Brier score.' },
    { title: 'LLM Agents', text: 'Agents on Claude, Gemini or local Ollama models that read text, rank priorities and draft messages, with every output validated.' },
    { title: 'Responsible AI', text: 'Fairness audits across groups (false-positive and false-negative gaps), calibrated probabilities and plain-language explanations.' },
    { title: 'Data & Features', text: 'Cleaning and shaping data with pandas and NumPy, engineering features and splitting by time so the evaluation stays honest.' },
    { title: 'Model Deployment', text: 'Models served through FastAPI and shipped as live web and desktop apps, with drift checks after launch.' }
  ],
  process: [
    { title: 'Frame', text: 'Define the decision the model supports, the target and how success will be measured.' },
    { title: 'Data', text: 'Collect, clean and explore the data, and look for gaps and bias before training.' },
    { title: 'Train', text: 'Engineer features, start from a transparent baseline, then try stronger models.' },
    { title: 'Evaluate', text: 'Test on held-out data with imbalance-aware metrics, calibration and fairness by group.' },
    { title: 'Deploy', text: 'Serve it behind an API, watch for drift and retrain when the data changes.' }
  ],
  tools: [
    { name: 'Python', abbr: 'Py' },
    { name: 'scikit-learn', abbr: 'SK' },
    { name: 'pandas', abbr: 'Pd' },
    { name: 'NumPy', abbr: 'Np' },
    { name: 'FastAPI', abbr: 'API' },
    { name: 'Claude & Gemini', abbr: 'LLM' },
    { name: 'Ollama', abbr: 'Ol' },
    { name: 'Git & GitHub', abbr: 'Git' }
  ],
  collaborateText: "Hiring for an AI/ML role, need a model built, or want to collaborate on research? Send me a message and I'll get back to you.",
  closingLine: 'Training models. Shipping AI.',
  badgeText: 'TRAIN · TEST · DEPLOY ·'
});

export const COVER_STYLES = ['auto', 'eduguard', 'pulse', 'terrain'];

export const DEFAULT_PROJECTS = Object.freeze({
  // Shown first, in this order.
  pinned: ['alice', 'zenpagoda', 'ai-pulse', 'eduriskgaurd'],
  // Copies and drafts that would repeat a featured project. Unhide them in the dashboard.
  hidden: ['Edu-guard', 'eduguardonline', 'Edu--Guard', 'eduguardforrisk', 'eduGuardimpact', 'eduguardontime', 'pulse', 'cheerwinchandra'],
  overrides: {
    eduriskgaurd: {
      title: 'EduGuard',
      tagline: 'Fair, calibrated student-risk model',
      category: 'Machine learning · Fairness',
      description: 'Predicts which students may need support with a calibrated scikit-learn model, audits false-positive and false-negative gaps across student groups, and keeps a person in the loop before any decision.',
      demo: '',
      cover: 'eduguard'
    },
    'ai-pulse': {
      title: 'PULSE',
      tagline: 'AI sales follow-up agent',
      category: 'LLM agent · Claude & Gemini',
      description: 'An LLM agent that reads sales conversations, scores every lead by urgency, recommends the next action and drafts the follow-up email, so no lead goes cold.',
      demo: '',
      cover: 'pulse'
    },
    alice: {
      title: 'Alice',
      tagline: 'Offline voice AI desktop assistant',
      category: 'LLM agent · Local AI',
      description: 'A desktop assistant that runs a local LLM (NVIDIA Nemotron in Ollama) with offline speech recognition and voice. It controls apps, mouse, keyboard and browser, sends WhatsApp messages and emails after you confirm, runs workflows and hands big jobs to Claude.',
      demo: '',
      cover: 'auto'
    },
    zenpagoda: {
      title: 'ZenPagoda',
      tagline: 'Solar-powered soil monitor',
      category: 'IoT · Machine learning',
      description: 'A solar ESP32 stake that reads soil moisture, conductance, temperature, humidity and light every 10 minutes and tells a farmer when to water. A naive Bayes model suggests crops (right crop in the top 3 for 93% of unseen examples). Team Osten, CMR University.',
      demo: '',
      cover: 'terrain'
    },
    topolite: {
      title: 'Topolite',
      tagline: '3D terrain generator',
      category: '3D · Procedural generation',
      description: 'A generator for 3D terrain.',
      demo: '',
      cover: 'terrain'
    }
  }
});

// Projects that are not (yet) public GitHub repositories. They are shown like
// repos; a public repo with the same name replaces the entry automatically.
export const EXTRA_PROJECTS = Object.freeze([
  { name: 'alice', description: 'Offline voice AI desktop assistant', language: 'JavaScript', stars: 0, url: 'https://github.com/cheerwinchandra-dev', homepage: '', pushedAt: '2026-10-25T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', fork: false, archived: false },
  { name: 'zenpagoda', description: 'Solar-powered soil monitor', language: 'C++', stars: 0, url: 'https://github.com/cheerwinchandra-dev', homepage: '', pushedAt: '2026-10-31T00:00:00.000Z', createdAt: '2026-10-15T00:00:00.000Z', fork: false, archived: false }
]);

export const CONTACT_TOPICS = ['AI / ML project', 'Job / internship', 'Research collaboration', 'Freelance', 'Just saying hi', 'Privacy / data request'];

// The version (date) of the Privacy Policy at /privacy. Every message stores the
// version its sender agreed to. Change it whenever you change that page.
export const PRIVACY_VERSION = '2026-11-05';
// How long messages are kept before the daily job deletes them.
export const MESSAGE_RETENTION_DAYS = 365;
