// validation.js — dynamic budget + field/details rendering, detail input handling, field readiness/validation. Extracted (src 4914-5424). Load 4/6.
  // ── DYNAMIC BUDGET SCREEN ───────────────────────────────
  const BUDGET_SETS = {
    renter: {
      title: 'What is your<br>monthly rent budget?',
      target: 'pathData.Q8_rentalBudget',
      options: [
        ['0-1000', '$0 – $1,000', 'Entry range'],
        ['1001-1500', '$1,001 – $1,500', 'Moderate range'],
        ['1501-2000', '$1,501 – $2,000', 'Mid range'],
        ['2001-2500', '$2,001 – $2,500', 'Upper mid range'],
        ['2501-3500', '$2,501 – $3,500', 'Premium range'],
        ['3501+', '$3,501+', 'Luxury range'],
        ['flexible', 'Flexible', 'Depends on fit']
      ]
    },
    buyer: {
      title: 'What is your<br>purchase budget?',
      target: 'trunk.Q4_budget',
      options: [
        ['under-200k', 'Under $200,000', 'Limited inventory'],
        ['200k-350k', '$200,000 – $350,000', 'Starter range'],
        ['350k-500k', '$350,000 – $500,000', 'Core market'],
        ['500k-750k', '$500,000 – $750,000', 'Upper core'],
        ['750k-1m', '$750,000 – $1,000,000', 'Upper market'],
        ['1m+', '$1,000,000+', 'Luxury'],
        ['notsure', 'Not sure yet', 'Need guidance']
      ]
    },
    sellbuy: null,
    seller: {
      title: 'What is your<br>estimated property value?',
      target: 'trunk.Q4_budget',
      options: [
        ['100k-250k', '$100,000 – $250,000', 'Approximate'],
        ['250k-500k', '$250,000 – $500,000', 'Approximate'],
        ['500k-1m', '$500,000 – $1,000,000', 'Approximate'],
        ['1m-2m', '$1,000,000 – $2,000,000', 'Approximate'],
        ['2m+', '$2,000,000+', 'Approximate'],
        ['notsure', 'Not sure yet', 'Need valuation']
      ]
    },
    commercial: {
      title: 'What is your<br>commercial budget?',
      target: 'trunk.Q4_budget',
      options: [
        ['under-5k', 'Under $5,000 / month', 'Lease budget'],
        ['5k-10k', '$5,000 – $10,000 / month', 'Lease budget'],
        ['10k-25k', '$10,000 – $25,000 / month', 'Lease budget'],
        ['25k+', '$25,000+ / month', 'Lease budget'],
        ['500k-1m', '$500,000 – $1,000,000', 'Purchase budget'],
        ['1m-2m', '$1,000,000 – $2,000,000', 'Purchase budget'],
        ['2m+', '$2,000,000+', 'Purchase budget'],
        ['notsure', 'Not sure yet', 'Need guidance']
      ]
    },
    notsure: {
      title: 'Do you have<br>a budget in mind?',
      target: 'trunk.Q4_budget',
      options: [
        ['0-1000', '$0 – $1,000 / month', 'Rent idea'],
        ['1001-1500', '$1,001 – $1,500 / month', 'Rent idea'],
        ['1501-2000', '$1,501 – $2,000 / month', 'Rent idea'],
        ['200k-350k', '$200,000 – $350,000', 'Starter purchase idea'],
        ['350k-500k', '$350,000 – $500,000', 'Core purchase idea'],
        ['500k-1m', '$500,000 – $1,000,000', 'Upper purchase idea'],
        ['notsure', 'Not sure yet', 'Need guidance']
      ]
    }
  };
  BUDGET_SETS.sellbuy = BUDGET_SETS.buyer;

  function prepareBudgetScreen() {
    const path = FormLogic.getPath() || 'renter';
    const set = BUDGET_SETS[path] || BUDGET_SETS.renter;
    const title = document.getElementById('budget-title');
    const wrap = document.getElementById('budget-bands');
    if (!title || !wrap) return;
    title.innerHTML = set.title;
    wrap.dataset.target = set.target;
    wrap.innerHTML = set.options.map(([value, range, label]) => `
      <div class="budget-band" data-budget="${value}" onclick="selectBudget(this)">
        <span class="budget-range">${range}</span>
        <span class="budget-label">${label}</span>
        <div class="budget-indicator"></div>
      </div>
    `).join('');
    document.getElementById('budget-btn').disabled = true;
  }

  function setStoredValue(storage, value) {
    const [bucket, key] = storage.split('.');
    if (bucket === 'trunk') {
      if (FormLogic.formData.trunk.hasOwnProperty(key)) FormLogic.updateTrunkField(key, value);
      else FormLogic.formData.trunk[key] = value;
      return;
    }
    if (bucket === 'pathData') {
      if (FormLogic.formData.pathData.hasOwnProperty(key)) FormLogic.updatePathField(key, value);
      else FormLogic.formData.pathData[key] = value;
      return;
    }
    if (!FormLogic.formData.additionalIntake) FormLogic.formData.additionalIntake = {};
    FormLogic.formData.additionalIntake[storage] = value;
  }

  function getStoredValue(storage) {
    const [bucket, key] = storage.split('.');
    if (bucket === 'trunk') return FormLogic.formData.trunk[key];
    if (bucket === 'pathData') return FormLogic.formData.pathData[key];
    return FormLogic.formData.additionalIntake ? FormLogic.formData.additionalIntake[storage] : undefined;
  }

  function detailVisible(field) {
    if (field.paths && !field.paths.includes(FormLogic.getPath())) return false;
    if (!field.when) return true;
    const val = getStoredValue(field.when.field);
    if (field.when.includes) return Array.isArray(val) && val.includes(field.when.includes);
    if (field.when.equals !== undefined) return val === field.when.equals;
    if (field.when.notEmpty) return val !== null && val !== undefined && val !== '';
    return true;
  }

  const SHARED_DETAIL_FIELDS = [
    { group:'Search criteria', type:'multi', store:'trunk.Q3_propertyTypes', label:'What type of property should I search for?', required:true,
      paths:['buyer','sellbuy','notsure'],
      options:[['single_family','Single-family home'],['condo','Condo / townhome'],['duplex_fourplex','Duplex / fourplex'],['multi_family','Multi-family / income property'],['new_construction','New construction'],['land','Land'],['not_sure','Not sure yet']] },

    // ── SCHOOLS, COMMUTE & LOCATION ANCHORS ──────────────────────────────
    { group:'Schools, Commute & Location', type:'single', store:'pathData.school_zoning_factor',
      label:'Is school zoning a factor?', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      options:[['yes','Yes'],['not_important','Not important'],['unsure','Unsure']] },
    { group:'Schools, Commute & Location', type:'text', store:'pathData.school_district_preference',
      label:'Preferred school district, zone, or campus', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      when:{ field:'pathData.school_zoning_factor', equals:'yes' } },
    { group:'Schools, Commute & Location', type:'single', store:'pathData.school_anchor_distance',
      label:'Desired travel time from school or anchor location', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      when:{ field:'pathData.school_zoning_factor', equals:'yes' },
      options:[['5min','5 minutes'],['10min','10 minutes'],['15min','15 minutes'],['20min','20 minutes'],['flexible','Flexible']] },
    { group:'Schools, Commute & Location', type:'multi', store:'pathData.location_anchors',
      label:'Important location anchors', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      options:[['work_commute','Work commute'],['family_friends','Family / friends nearby'],['daycare_childcare','Daycare / childcare'],['medical_care','Medical care'],['airport_access','Airport access'],['highway_access','Highway access'],['gym_wellness','Gym / wellness'],['grocery_shopping','Grocery / shopping'],['restaurants_nightlife','Restaurants / nightlife'],['parks_trails','Parks / trails'],['worship_community','Worship / community'],['other','Other']] },
    { group:'Schools, Commute & Location', type:'single', store:'pathData.commute_time_preference',
      label:'Preferred commute time', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      options:[['under_15','Under 15 minutes'],['15_30','15–30 minutes'],['30_45','30–45 minutes'],['flexible','Flexible']] },
    { group:'Schools, Commute & Location', type:'disclaimer', store:'', required:false,
      paths:['buyer','renter','sellbuy','notsure'],
      text:'School zoning and boundaries should be independently verified with the district before applying, leasing, or purchasing.' },

    // ── NON-NEGOTIABLES ───────────────────────────────────────────────────
    { group:'Non-Negotiables', type:'multi', store:'pathData.non_negotiables',
      label:'Any deal-breakers I should know about?', required:false,
      paths:['buyer','renter','sellbuy'],
      options:[['too_far_work_school','Too far from work / school'],['too_many_stairs','Too many stairs'],['no_yard','No yard'],['no_garage','No garage'],['too_much_carpet','Too much carpet'],['too_close_major_road','Too close to a major road'],['hoa_too_high','HOA too high'],['tax_rate_too_high','Tax rate too high'],['flood_zone_concern','Flood zone concern'],['pet_restrictions','Pet restrictions'],['parking_issues','Parking issues'],['older_property_systems','Older property systems'],['small_kitchen','Small kitchen'],['not_enough_storage','Not enough storage'],['other','Other']] }
  ];

  const PATH_DETAIL_FIELDS = {
    renter: [
      { group:'Rental needs', type:'multi', store:'pathData.renter_property_type', label:'What rental types should I search?', required:true,
        options:[['apartment','Apartment'],['condo_townhome','Condo / townhome'],['single_family','Single-family home'],['duplex','Duplex'],['fourplex','Fourplex'],['townhouse','Townhouse'],['garage_apartment','Garage apartment / guest house'],['flexible','Flexible']] },
      { group:'Rental needs', type:'bedbath', store:'pathData.Q9_bedroomsBathrooms', label:'Minimum bedroom / bathroom count', required:true,
        note:'Use the plus and minus controls so this feels quick instead of making someone hunt through a long dropdown.' },
      { group:'Rental needs', type:'multi', store:'pathData.Q10_rentalAmenities', label:'What features or amenities matter most?', required:false,
        options:[['washer_dryer','Washer / dryer'],['garage','Garage'],['covered_parking','Covered parking'],['yard','Yard'],['fenced_yard','Fenced yard'],['patio_balcony','Patio / balcony'],['pet_friendly','Pet friendly'],['study','Study / office'],['home_office','Home office space'],['one_story_preferred','One-story preferred'],['two_story_ok','Two-story okay'],['three_plus_stories_ok','Three+ stories okay'],['split_level_ok','Split-level okay'],['primary_down','Primary bedroom down'],['one_bed_down','At least one bedroom down'],['no_carpet','No carpet'],['island_kitchen','Island kitchen'],['walk_in_closet','Walk-in closet'],['pool','Pool'],['gym','Gym'],['gated','Gated access'],['elevator','Elevator'],['first_floor','First-floor unit'],['top_floor','Top-floor unit'],['storage','Extra storage'],['ev_charging','EV charging']] },
      { group:'Rental needs', type:'select', store:'pathData.Q12_leaseTerm', label:'What lease term are you looking for?', required:true,
        options:[['','Select lease term'],['3_months','3 months'],['6_months','6 months'],['12_months','12 months'],['18_months','18 months'],['24_months','24 months'],['flexible','Flexible']] },
      { group:'Rental qualification', type:'select', store:'pathData.Q14_employment', label:'What is your employment status?', required:true,
        options:[['','Select status'],['employed','Employed'],['self_employed','Self-employed'],['retired','Retired'],['student','Student'],['other','Other']] },
      { group:'Rental qualification', type:'ack', store:'pathData.renter_background_eviction_consent', label:'I understand that rental applications may require background and eviction screening.', required:true },
      { group:'Rental qualification', type:'ack', store:'pathData.renter_credit_report_consent', label:'I understand that rental applications may require credit screening or proof of financial qualification.', required:true },
      { group:'Rental qualification', type:'textarea', store:'pathData.renter_history_note', label:'Is there anything about your rental history you’d like me to know?', required:false },
      { group:'Pets', type:'single', store:'trunk.Q7_pets', label:'Do you have pets?', required:true,
        options:[['yes','Yes'],['no','No']] },
      { group:'Pets', type:'multi', store:'trunk.Q7_petTypes', label:'What type of pet?', required:true,
        when:{field:'trunk.Q7_pets', equals:'yes'},
        options:[['dogs','Dog'],['cats','Cat'],['both','Both'],['other','Other']] },
      { group:'Pets', type:'text', store:'pathData.renter_pet_breed', label:'Breed(s)', required:true,
        when:{field:'trunk.Q7_pets', equals:'yes'} },
      { group:'Pets', type:'text', store:'pathData.renter_pet_weight', label:'Approximate weight(s)', required:true,
        when:{field:'trunk.Q7_pets', equals:'yes'} },
      { group:'Pets', type:'text', store:'trunk.Q7_petOther', label:'Anything else about your pet I should know?', required:false,
        when:{field:'trunk.Q7_pets', equals:'yes'} },
      { group:'Target Date Details', type:'single', store:'pathData.target_date_precision', label:'Preferred lease start or move-in window', required:false,
        options:[['exact_date','Exact date'],['specific_week','Specific week'],['specific_month','Specific month'],['flexible','Flexible'],['need_help','Need help timing this']] },
      { group:'Target Date Details', type:'text', store:'pathData.target_date_input', label:'Preferred date or window', required:false,
        when:{field:'pathData.target_date_precision', notEmpty:true} }
    ],
    buyer: [
      { group:'Buying readiness', type:'single', store:'pathData.Q8_preApproval', label:'Are you pre-approved for a mortgage?', required:true,
        options:[['pre-approved','Yes, pre-approved'],['pre-qualified','Pre-qualified'],['not_yet','Not yet'],['cash','Cash buyer']] },
      { group:'Buying readiness', type:'number', store:'pathData.Q8_approvalAmount', label:'What is your pre-approval amount?', required:true,
        when:{field:'pathData.Q8_preApproval', equals:'pre-approved'} },
      { group:'Buying readiness', type:'link', store:'pathData.Q9_lenderLinkClicked', label:'Need lender help?', note:'If you are not pre-approved yet, I can connect you with a preferred lender when you’re ready.', required:false,
        when:{field:'pathData.Q8_preApproval', notEmpty:true} },
      { group:'Buying criteria', type:'single', store:'pathData.Q12_newResale', label:'Are you more interested in new construction or resale?', required:true,
        options:[['new','New construction'],['resale','Resale'],['both','Open to both']] },
      { group:'Buying criteria', type:'bedbath', store:'pathData.Q13_bedsBaths', label:'Minimum bedroom / bathroom count', required:true,
        note:'Set the minimum search target. Joey can widen it if the right property needs flexibility.' },
      { group:'Buying criteria', type:'multi', store:'pathData.Q14_mustHaves', label:'Which must-haves matter most?', required:true,
        options:[['garage','Garage'],['yard','Yard / outdoor space'],['home_office','Home office'],['multi_story_ok','Multi-story okay'],['split_level_ok','Split-level okay'],['primary_down','Primary bedroom downstairs'],['updated_kitchen','Updated kitchen'],['no_carpet','No carpet'],['low_hoa','Low HOA'],['new_construction','New construction'],['move_in_ready','Move-in ready'],['commute','Commute / access'],['walkability','Walkability']] },
      { group:'Target Date Details', type:'single', store:'pathData.target_date_precision', label:'Preferred closing or move-in window', required:false,
        options:[['exact_date','Exact date'],['specific_week','Specific week'],['specific_month','Specific month'],['flexible','Flexible'],['need_help','Need help timing this']] },
      { group:'Target Date Details', type:'text', store:'pathData.target_date_input', label:'Preferred date or window', required:false,
        when:{field:'pathData.target_date_precision', notEmpty:true} },
      { group:'Representation', type:'ack', store:'pathData.Q15_buyerAgreed', label:'I acknowledge that I may be required to sign a buyer representation agreement before receiving property showings or buyer services.', required:true }
    ],
    seller: [
      { group:'Selling details', type:'address', store:'pathData.seller_property_address', label:'What is the property address?', required:true,
        note:'Start typing the full property address. Browser address suggestions are enabled now; true map/parcel verification can be connected when the site goes live.' },
      { group:'Selling details', type:'single', store:'pathData.seller_property_type', label:'What type of property are you selling?', required:true,
        options:[['single_family','Single-family home'],['condo_townhome','Condo / townhome'],['duplex_fourplex','Duplex / fourplex'],['multi_family','Multi-family / income property'],['land','Land'],['commercial','Commercial property'],['other','Other / not sure']] },
      { group:'Selling details', type:'single', store:'pathData.Q8_propertyCondition', label:'What is the condition of your property?', required:true,
        options:[['excellent','Excellent','Updated / turnkey / very little work needed'],['good','Good','Clean and functional with normal wear'],['fair','Fair','Dated or cosmetic work needed'],['needs_work','Needs work','Repairs, deferred maintenance, or major updates needed']] },
      { group:'Selling details', type:'single', store:'pathData.seller_mortgage_status', label:'Do you currently have a mortgage on the property?', required:true,
        options:[['yes','Yes'],['no','No'],['unsure','Not sure / prefer to discuss']] },
      { group:'Selling details', type:'number', store:'pathData.seller_mortgage_balance', label:'Approximate payoff balance / what is left on the mortgage?', required:true,
        when:{field:'pathData.seller_mortgage_status', equals:'yes'} },
      { group:'Selling motivation', type:'single', store:'pathData.Q10_sellReason', label:'What is driving the sale?', required:true,
        options:[['upgrade','Upgrading'],['downsize','Downsizing'],['relocating','Relocating'],['investment','Investment decision'],['other','Other']] },
      { group:'Selling motivation', type:'single', store:'pathData.Q9_motivatedTimeline', label:'How motivated is your selling timeline?', required:true,
        options:[['asap','ASAP'],['1-3_months','1–3 months'],['3-6_months','3–6 months'],['flexible','Flexible']] },
      { group:'Listing prep', type:'single', store:'pathData.Q11_listingHistory', label:'Has this property been listed before?', required:true,
        options:[['first_time','First time listing'],['listed_before','Listed before'],['expired','Expired listing'],['unsure','Not sure']] },
      { group:'Listing prep', type:'single', store:'pathData.Q12_openHouseWilling', label:'Are you open to open houses if recommended?', required:true,
        options:[['yes','Yes'],['no','No'],['maybe','Maybe']] },
      { group:'Listing prep', type:'single', store:'pathData.Q13_virtualTourWilling', label:'Are you open to professional video / virtual tour marketing?', required:true,
        options:[['yes','Yes'],['no','No'],['maybe','Maybe']] },
      { group:'Target Date Details', type:'single', store:'pathData.target_date_precision', label:'Preferred list date or target sale timeline', required:false,
        options:[['exact_date','Exact date'],['specific_week','Specific week'],['specific_month','Specific month'],['flexible','Flexible'],['need_help','Need help timing this']] },
      { group:'Target Date Details', type:'text', store:'pathData.target_date_input', label:'Preferred date or window', required:false,
        when:{field:'pathData.target_date_precision', notEmpty:true} },
      { group:'Representation', type:'ack', store:'pathData.Q14_agentPreference', label:'I acknowledge that a listing agreement is required before marketing or listing services begin.', required:true }
    ],
    sellbuy: [],
    commercial: [
      { group:'Commercial need', type:'multi', store:'pathData.Q8_commercialType', label:'What type of commercial property do you need?', required:true,
        options:[['office','Office'],['retail','Retail / storefront'],['industrial','Industrial / warehouse'],['flex','Flex space'],['medical','Medical / dental'],['restaurant','Restaurant / bar'],['land','Commercial land'],['multifamily','Multi-family / income property'],['mixed','Mixed use'],['special_use','Special use'],['not_sure','Not sure yet']] },
      { group:'Commercial need', type:'single', store:'pathData.Q10_leasePurchase', label:'Are you looking to lease, purchase, or sell?', required:true,
        options:[['lease','Lease'],['purchase','Purchase'],['sell','Sell'],['both','Open to options']] },
      { group:'Commercial need', type:'single', store:'pathData.Q9_squareFootage', label:'Approximate square footage?', required:true,
        options:[['under_5k','Under 5,000 SF'],['5k-10k','5,000 – 10,000 SF'],['10k-25k','10,000 – 25,000 SF'],['25k-50k','25,000 – 50,000 SF'],['50k+','50,000+ SF']] },
      { group:'Business details', type:'text', store:'pathData.Q12_businessType', label:'What type of business is this for?', required:true },
      { group:'Business details', type:'single', store:'pathData.Q13_ownershipStructure', label:'Business ownership structure?', required:true,
        options:[['sole_prop','Sole proprietor'],['llc','LLC'],['corp','Corporation'],['other','Other / not sure']] },
      { group:'Business details', type:'single', store:'pathData.Q14_financialQualification', label:'Financial qualification status?', required:true,
        options:[['established','Established business'],['startup','Startup / new venture'],['funded','Funded / capital ready'],['unsure','Not sure yet']] },
      { group:'Target Date Details', type:'single', store:'pathData.target_date_precision', label:'Preferred occupancy or launch window', required:false,
        options:[['exact_date','Exact date'],['specific_week','Specific week'],['specific_month','Specific month'],['flexible','Flexible'],['need_help','Need help timing this']] },
      { group:'Target Date Details', type:'text', store:'pathData.target_date_input', label:'Preferred date or window', required:false,
        when:{field:'pathData.target_date_precision', notEmpty:true} }
    ],
    notsure: [
      { group:'Point me in the right direction', type:'multi', store:'pathData.Q8_questionCategory', label:'What are you trying to figure out?', required:true,
        options:[['mortgage','Mortgage / financing'],['market','Market timing'],['investment','Investment'],['rent','Renting'],['buy','Buying'],['sell','Selling'],['commercial','Commercial'],['process','The process'],['other','Other']] },
      { group:'Point me in the right direction', type:'textarea', store:'pathData.Q9_questionDetails', label:'Notes', required:false },
      { group:'Follow-up', type:'single', store:'pathData.Q10_callback', label:'How should Joey follow up?', required:true,
        options:[['yes','Call me'],['text','Text me'],['email','Email me']] }
    ]
  };
  PATH_DETAIL_FIELDS.sellbuy = [
    { group:'Sell + Buy coordination', type:'single', store:'pathData.sellbuy_using_sale_proceeds', label:'Are you planning to use sale proceeds toward the purchase?', required:true,
      options:[['yes','Yes'],['no','No'],['unsure','Maybe / depends on the numbers']] },
    ...PATH_DETAIL_FIELDS.seller.filter(f => f.group !== 'Target Date Details'),
    ...PATH_DETAIL_FIELDS.buyer.filter(f => f.group !== 'Target Date Details'),
    { group:'Target Date Details', type:'single', store:'pathData.target_date_precision', label:'Preferred sell and buy coordination window', required:false,
      options:[['exact_date','Exact date'],['specific_week','Specific week'],['specific_month','Specific month'],['flexible','Flexible'],['need_help','Need help timing this']] },
    { group:'Target Date Details', type:'text', store:'pathData.target_date_input', label:'Preferred date or window', required:false,
      when:{field:'pathData.target_date_precision', notEmpty:true} }
  ];

  function renderField(field, idx) {
    if (!detailVisible(field)) return '';
    const current = getStoredValue(field.store);
    const required = field.required ? '<span class="detail-option-desc">Required</span>' : '<span class="detail-option-desc">Optional</span>';
    let body = '';
    if (field.type === 'single' || field.type === 'multi') {
      const selected = Array.isArray(current) ? current : (current ? [current] : []);
      body = `<div class="detail-options">` + field.options.map(([value, label, desc]) => `
        <div class="detail-option ${selected.includes(value) ? 'selected' : ''}" data-store="${field.store}" data-type="${field.type}" data-value="${value}" onclick="selectDetailOption(this)">
          <div class="detail-dot"></div>
          <span class="detail-option-label">${label}</span>
          ${desc ? `<span class="detail-option-desc">${desc}</span>` : ''}
        </div>
      `).join('') + `</div>`;
    } else if (field.type === 'select') {
      body = `<select class="detail-select" data-store="${field.store}" onchange="updateDetailInput(this)">${field.options.map(([value, label]) => `<option value="${value}" ${String(current || '') === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    } else if (field.type === 'bedbath') {
      const bb = parseBedBathValue(current);
      const bedBathPresets = [
        ['flexible','Flexible'],
        ['Studio / 1+ bath','Studio'],
        ['1+ bed / 1+ bath','1 / 1'],
        ['2+ bed / 1+ bath','2 / 1'],
        ['2+ bed / 2+ bath','2 / 2'],
        ['3+ bed / 2+ bath','3 / 2'],
        ['3+ bed / 2.5+ bath','3 / 2.5'],
        ['3+ bed / 3+ bath','3 / 3'],
        ['4+ bed / 2+ bath','4 / 2'],
        ['4+ bed / 3+ bath','4 / 3'],
        ['4+ bed / 4+ bath','4 / 4'],
        ['5+ bed / 3+ bath','5+ / 3+']
      ];
      body = `<div class="bedbath-helper">Quick pick or fine-tune with the steppers.</div>
      <div class="bedbath-presets">
        ${bedBathPresets.map(([value, label]) => `<button class="bedbath-preset ${String(current || '') === value ? 'selected' : ''}" type="button" onclick="setBedBathPreset('${field.store}', '${value.replace(/'/g, "\\'")}')">${label}</button>`).join('')}
      </div>
      <div class="bedbath-control" data-bedbath-store="${field.store}">
        <div class="bedbath-stepper">
          <div class="bedbath-stepper-label">Bedrooms</div>
          <div class="bedbath-stepper-row">
            <button class="bedbath-btn" type="button" onclick="adjustBedBath('${field.store}', 'beds', -1)">−</button>
            <div class="bedbath-value" data-bedbath-part="beds">${bb.bedsLabel || '—'}</div>
            <button class="bedbath-btn" type="button" onclick="adjustBedBath('${field.store}', 'beds', 1)">+</button>
          </div>
        </div>
        <div class="bedbath-stepper">
          <div class="bedbath-stepper-label">Bathrooms</div>
          <div class="bedbath-stepper-row">
            <button class="bedbath-btn" type="button" onclick="adjustBedBath('${field.store}', 'baths', -0.5)">−</button>
            <div class="bedbath-value" data-bedbath-part="baths">${bb.bathsLabel || '—'}</div>
            <button class="bedbath-btn" type="button" onclick="adjustBedBath('${field.store}', 'baths', 0.5)">+</button>
          </div>
        </div>
      </div>`;
    } else if (field.type === 'textarea') {
      body = `<textarea class="detail-textarea" data-store="${field.store}" oninput="updateDetailInput(this)" placeholder="Type your answer...">${current || ''}</textarea>`;
    } else if (field.type === 'number') {
      body = `<input class="detail-input" type="number" data-store="${field.store}" oninput="updateDetailInput(this)" placeholder="Example: 450000" value="${current || ''}">`;
    } else if (field.type === 'address') {
      body = `<input class="detail-input" type="text" data-store="${field.store}" autocomplete="street-address" inputmode="text" oninput="updateDetailInput(this)" placeholder="Start typing the property address..." value="${current || ''}">
      <div class="address-assist">Address autofill is enabled. Full map verification can be connected with a Places API key later.</div>`;
    } else if (field.type === 'text') {
      body = `<input class="detail-input" type="text" data-store="${field.store}" oninput="updateDetailInput(this)" placeholder="Type your answer..." value="${current || ''}">`;
    } else if (field.type === 'ack') {
      body = `<div class="detail-options"><div class="detail-option ${current ? 'selected' : ''}" data-store="${field.store}" data-type="ack" data-value="true" onclick="selectDetailOption(this)">
        <div class="detail-dot"></div><span class="detail-option-label">I acknowledge</span></div></div>`;
    } else if (field.type === 'link') {
      body = `<a href="#" class="detail-link" onclick="markLenderClicked(event)">Mark lender intro needed / clicked</a>`;
    } else if (field.type === 'disclaimer') {
      return `<div class="detail-field" data-field="_disclaimer" data-visible="true">
        <div class="detail-disclaimer">${field.text || ''}</div>
      </div>`;
    }
    return `<div class="detail-field" data-field="${field.store}" data-visible="true">
      <div class="detail-label">${field.label}</div>
      ${field.note ? `<div class="detail-note">${field.note}</div>` : ''}
      ${body}
      <div class="detail-field-error" id="detail-err-${idx}"></div>
      <div style="display:none">${required}</div>
    </div>`;
  }

  function renderRouteDetails() {
    const path = FormLogic.getPath() || 'notsure';
    const fields = [...SHARED_DETAIL_FIELDS, ...(PATH_DETAIL_FIELDS[path] || [])];
    const wrap = document.getElementById('route-detail-fields');
    if (!wrap) return;

    let html = '';
    let lastGroup = '';
    fields.forEach((field, idx) => {
      if (!detailVisible(field)) return;
      if (field.group !== lastGroup) {
        if (lastGroup) html += '</div>';
        html += `<div class="detail-group"><div class="detail-group-title">${field.group}</div>`;
        lastGroup = field.group;
      }
      html += renderField(field, idx);
    });
    if (lastGroup) html += '</div>';
    wrap.innerHTML = html;
    document.getElementById('detail-error').textContent = '';
  }

  function selectDetailOption(el) {
    const store = el.dataset.store;
    const value = el.dataset.value;
    const type = el.dataset.type;
    if (type === 'multi') {
      const current = Array.isArray(getStoredValue(store)) ? [...getStoredValue(store)] : [];
      const i = current.indexOf(value);
      if (i >= 0) current.splice(i, 1);
      else current.push(value);
      setStoredValue(store, current);
    } else if (type === 'ack') {
      setStoredValue(store, !getStoredValue(store));
    } else {
      setStoredValue(store, value);
    }
    renderRouteDetails();
    refreshBriefIfUnlocked();
    maybeAutoDetails();
  }

  function updateDetailInput(el) {
    setStoredValue(el.dataset.store, el.value.trim());
    refreshBriefIfUnlocked();
    maybeAutoDetails();
  }

  function markLenderClicked(event) {
    event.preventDefault();
    FormLogic.formData.pathData.Q9_lenderLinkClicked = true;
    event.target.textContent = 'Lender intro marked';
  }

  function getCurrentDetailFields() {
    const path = FormLogic.getPath() || 'notsure';
    return [...SHARED_DETAIL_FIELDS, ...(PATH_DETAIL_FIELDS[path] || [])].filter(detailVisible);
  }

  function parseBedBathValue(value) {
    const out = { beds: '', baths: '', bedsLabel: '', bathsLabel: '', flexible: false };
    if (!value) return out;
    const text = String(value);
    if (/flexible/i.test(text)) {
      out.flexible = true;
      out.bedsLabel = 'Flex';
      out.bathsLabel = 'Flex';
      return out;
    }
    if (/studio/i.test(text)) {
      out.beds = '0';
      out.bedsLabel = 'Studio';
    }
    const bedMatch = text.match(/(\d+)\+?\s*bed/i);
    const bathMatch = text.match(/(\d+(?:\.5)?)\+?\s*bath/i);
    if (bedMatch) {
      out.beds = bedMatch[1];
      out.bedsLabel = bedMatch[1];
    }
    if (bathMatch) {
      out.baths = bathMatch[1];
      out.bathsLabel = bathMatch[1];
    }
    return out;
  }

  function findBedBathControl(store) {
    return Array.from(document.querySelectorAll('.bedbath-control')).find(el => el.dataset.bedbathStore === store);
  }

  function formatBedBathLabel(beds, baths) {
    if (String(beds) === '0') return baths ? `Studio / ${baths}+ bath` : '';
    return beds && baths ? `${beds}+ bed / ${baths}+ bath` : '';
  }

  function setBedBathPreset(store, value) {
    setStoredValue(store, value);
    renderRouteDetails();
    refreshBriefIfUnlocked();
    maybeAutoDetails();
  }

  function adjustBedBath(store, part, delta) {
    const control = findBedBathControl(store);
    const current = parseBedBathValue(getStoredValue(store));
    let beds = current.beds === '' ? '' : Number(current.beds);
    let baths = current.baths === '' ? '' : Number(current.baths);

    if (part === 'beds') {
      beds = (beds === '' ? 0 : beds) + delta;
      beds = Math.max(0, Math.min(9, beds));
    } else {
      baths = (baths === '' ? 1 : baths) + delta;
      baths = Math.max(1, Math.min(9, baths));
    }

    const label = formatBedBathLabel(beds, baths);
    setStoredValue(store, label);

    if (control) {
      const bedNode = control.querySelector('[data-bedbath-part="beds"]');
      const bathNode = control.querySelector('[data-bedbath-part="baths"]');
      if (bedNode) bedNode.textContent = String(beds) === '0' ? 'Studio' : (beds || '—');
      if (bathNode) bathNode.textContent = baths || '—';
    }

    control?.parentElement?.querySelectorAll('.bedbath-preset').forEach(btn => {
      btn.classList.toggle('selected', btn.textContent.trim() === label);
    });

    refreshBriefIfUnlocked();
    maybeAutoDetails();
  }

  function fieldHasValue(field) {
    const v = getStoredValue(field.store);
    if (!field.required) return true;
    if (field.type === 'link') return true;
    if (Array.isArray(v)) return v.length > 0;
    if (field.type === 'ack') return v === true || v === 'yes' || v === 'exclusive';
    if (field.type === 'bedbath') {
      if (String(v || '').toLowerCase() === 'flexible') return true;
      const bb = parseBedBathValue(v);
      return (bb.beds !== '' || /studio/i.test(String(v || ''))) && !!bb.baths;
    }
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  function maybeAutoDetails() {
    // The details step never auto-advances: many fields are optional and users
    // should not be yanked to the brief mid-form. The explicit "Build My Smart
    // Move Brief" button (and the route cue) are the way forward here.
    updateRouteCue();
  }
