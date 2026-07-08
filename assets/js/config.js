// config.js — constants (PATH_MAP/labels/endpoint), ad-attribution capture, SECTIONS list, module-level runtime vars, FormLogic.init(). Extracted (src 4442-4518). Load 2/6.
  // ── PATH KEY MAP: display → FormLogic internal ──────────
  const PATH_MAP = {
    'rent': 'renter',
    'buy': 'buyer',
    'sell': 'seller',
    'sell-buy': 'sellbuy',
    'commercial': 'commercial',
    'not-sure': 'notsure'
  };

  const PATH_LABELS = {
    'renter': 'Rent', 'buyer': 'Buy', 'seller': 'Sell',
    'sellbuy': 'Sell + Buy', 'commercial': 'Commercial', 'notsure': 'Not Sure Yet'
  };

  const BUDGET_LABELS = {
    // rent
    '0-1000': '$0 – $1,000 / month',
    '1001-1500': '$1,001 – $1,500 / month',
    '1501-2000': '$1,501 – $2,000 / month',
    '2001-2500': '$2,001 – $2,500 / month',
    '2501-3500': '$2,501 – $3,500 / month',
    '3501+': '$3,501+ / month',
    // purchase / value
    'under-200k': 'Under $200,000',
    '200k-350k': '$200,000 – $350,000',
    '350k-500k': '$350,000 – $500,000',
    '500k-750k': '$500,000 – $750,000',
    '750k-1m': '$750,000 – $1,000,000',
    '1m+': '$1,000,000+',
    '100k-250k': '$100,000 – $250,000',
    '250k-500k': '$250,000 – $500,000',
    '500k-1m': '$500,000 – $1,000,000',
    '1m-2m': '$1,000,000 – $2,000,000',
    '2m+': '$2,000,000+',
    // commercial / misc
    'under-5k': 'Under $5,000 / month',
    '5k-10k': '$5,000 – $10,000 / month',
    '10k-25k': '$10,000 – $25,000 / month',
    '25k+': '$25,000+ / month',
    'flexible': 'Flexible / Depends on Property',
    'notsure': 'Not sure yet'
  };

  // Paste your Zapier Catch Hook or backend endpoint here once connected.
  // Keep blank while testing locally; the button will not open email.
  const SMART_MOVE_ENDPOINT = '/api/smart-move';

  // Ad-attribution params captured on load so every submission (partial and
  // final) carries which campaign produced the lead.
  const TRACKING_PARAMS = (() => {
    const params = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    const out = {};
    keys.forEach(k => {
      const v = params.get(k);
      if (v) out[k] = v.slice(0, 256);
    });
    return out;
  })();

  // sections indexed 0–7
  const SECTIONS = ['section-open','section-path','section-contact','section-trunk','section-budget','section-area','section-details','section-brief'];

  let currentStep = 0;

  // Init FormLogic
  FormLogic.init();

  let unlockedStep = 0;
  let rewindTimer = null;
  let scrollBackTimer = null;
  const autoAdvanceTimers = new Map();
  let programmaticScroll = false;
  let lastScrollY = window.scrollY || 0;
  let lastUpScrollAt = 0;

