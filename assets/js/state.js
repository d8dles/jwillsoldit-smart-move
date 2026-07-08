// state.js — FormLogic model: state init, path defs, question sequencing, smart flags, field validation, submission-object shape. Extracted from index.html (src 3788-4439). Global (non-module). Load 1/6.
/* Inline FormLogic.js so this HTML works as a standalone preview file. */
/**
 * Real Estate Intake Form Logic Module
 * Version: 1.0
 * Purpose: Core form state management, routing, conditional visibility, smart flags, and submission
 *
 * This module handles:
 * 1. Path routing (Q1 selection)
 * 2. Question sequencing (shared trunk + branch-specific)
 * 3. Conditional visibility (sub-questions, dynamic question counts)
 * 4. Smart flag detection (R1-R18)
 * 5. Progress bar calculation
 * 6. Submission data structure
 * 7. Lender link tracking (Buyer path)
 * 8. Sell+Buy auto-routing (smart logic)
 */

const FormLogic = {
  // ============================================================================
  // 1. FORM STATE INITIALIZATION
  // ============================================================================

  formData: {
    // Metadata
    path: null, // "renter" | "buyer" | "seller" | "sellbuy" | "commercial" | "notsure"
    submissionTime: null,
    formVersion: "1.0",

    // Contact info (Q1-Q3 in shared trunk, or specific order per path)
    contact: {
      name: null,
      email: null,
      phone: null
    },

    // Shared trunk (Q2-Q7)
    trunk: {
      Q2_timeline: null,        // "within_month", "1-3_months", "3-6_months", "exploring"
      Q3_propertyTypes: [],     // ["single_family", "condo", "multi_family", "land"]
      Q4_budget: null,          // "100k-250k", "250k-500k", "500k-1m", "1m-2m", "2m+", "notsure"
      Q5_areas: [],             // Array of locations ["Houston", "Katy", ...]
      Q6_homeStatus: null,      // "own", "first_time", "prefer_not_say"
      Q6_sellFirstRequired: null, // "yes_must_sell", "no_have_funds", "unsure" (conditional)
      Q7_pets: null,            // "yes", "no"
      Q7_petTypes: [],          // ["dogs", "cats", "other"] (conditional)
      Q7_petOther: null         // Free text (conditional)
    },

    // Path-specific data
    pathData: {
      // Buyer (Q8-Q15)
      Q8_preApproval: null,     // "pre-approved", "pre-qualified", "not_yet"
      Q8_approvalAmount: null,  // Number (conditional)
      Q9_lenderLinkClicked: false, // Boolean
      Q10_buyerAgreed: null,    // "yes", "no" (sell+buy check)
      Q11_homeOwnershipStatus: null, // "own", "rent"
      Q12_newResale: null,      // "new", "resale"
      Q13_bedsBaths: null,      // "2b1b", "3b2b", "4b3b", etc.
      Q14_mustHaves: null,      // Free text
      Q15_buyerAgreed: null,    // "yes", "no" (confirm for sell+buy)

      // Seller (Q8-Q14)
      Q8_propertyCondition: null, // "excellent", "good", "fair", "needs_work"
      Q9_motivatedTimeline: null, // "asap", "1-3_months", "3-6_months", "flexible"
      Q10_sellReason: null,     // "upgrade", "downsize", "relocating", "investment", "other"
      Q11_listingHistory: null, // "first_time", "listed_before", "expired"
      Q12_openHouseWilling: null, // "yes", "no"
      Q13_virtualTourWilling: null, // "yes", "no"
      Q14_agentPreference: null,   // "exclusive", "open_to_offers", "no_preference"

      // Renter (Q8-Q14)
      Q8_rentalBudget: null,    // "$500-1k", "$1k-1.5k", "$1.5k-2k", "$2k+"
      Q9_bedroomsBathrooms: null, // "1b1b", "2b1b", "2b2b", "3b2b+", "flexible"
      Q10_rentalAmenities: [],  // ["parking", "laundry", "gym", "pool", "patio"]
      Q11_rentalMoveIn: null,   // "asap", "2_weeks", "1_month", "flexible"
      Q12_leaseTerm: null,      // "3_months", "6_months", "1_year", "flexible"
      Q13_pets: null,           // "yes", "no"
      Q13_petTypes: [],         // ["dogs", "cats", "other"] (conditional)
      Q13_petOther: null,       // Free text (conditional)
      Q14_employment: null,     // "employed", "self_employed", "retired", "student"

      // Commercial (Q8-Q14)
      Q8_commercialType: null,  // "office", "retail", "warehouse", "mixed"
      Q9_squareFootage: null,   // "5k-10k", "10k-25k", "25k-50k", "50k+"
      Q10_leasePurchase: null,  // "lease", "purchase", "both"
      Q11_moveInTimeline: null, // "asap", "1-3_months", "3-6_months", "flexible"
      Q12_businessType: null,   // Free text
      Q13_ownershipStructure: null, // "sole_prop", "llc", "corp", "other"
      Q14_financialQualification: null, // "established", "startup", "unsure"

      // Not Sure (Q8-Q10)
      Q8_questionCategory: null, // "mortgage", "market", "investment", "process", "other"
      Q9_questionDetails: null,  // Free text
      Q10_callback: null        // "yes", "no", "text"
    },

    // Smart flags and scoring
    flags: [],           // Array of flag strings (R1-R18)
    urgencyScore: 0      // 0-10 scale
  },

  // ============================================================================
  // 2. PATH DEFINITIONS & QUESTION COUNTS
  // ============================================================================

  paths: {
    buyer: {
      name: "buyer",
      label: "I want to buy",
      trunkQuestions: 7,      // Q1-Q7 (Q1 is route selector, Q2-Q7 is trunk)
      pathQuestions: 8,       // Q8-Q15
      conditionalCount: 1,    // Q9 sub-question if "Not yet"
      totalBase: 15,
      branches: ["Q9_lenderLink", "Q10_buyerAgreed"]
    },
    seller: {
      name: "seller",
      label: "I want to sell",
      trunkQuestions: 7,
      pathQuestions: 7,       // Q8-Q14
      conditionalCount: 0,
      totalBase: 14,
      branches: []
    },
    renter: {
      name: "renter",
      label: "I'm a renter",
      trunkQuestions: 7,
      pathQuestions: 7,       // Q8-Q14
      conditionalCount: 1,    // Q13 sub-question if pets = "yes"
      totalBase: 14,
      branches: ["Q13_petTypes"]
    },
    sellbuy: {
      name: "sellbuy",
      label: "I'm selling and buying",
      trunkQuestions: 7,
      pathQuestions: 14,      // Seller Q8-Q14 + Buyer Q8-Q15
      conditionalCount: 2,    // Seller conditions + Buyer conditions
      totalBase: 21,
      branches: ["Q9_lenderLink", "Q13_petTypes"]
    },
    commercial: {
      name: "commercial",
      label: "I have a commercial need",
      trunkQuestions: 7,
      pathQuestions: 7,       // Q8-Q14
      conditionalCount: 0,
      totalBase: 14,
      branches: []
    },
    notsure: {
      name: "notsure",
      label: "I have a question",
      trunkQuestions: 7,
      pathQuestions: 3,       // Q8-Q10 (shorter)
      conditionalCount: 0,
      totalBase: 10,
      branches: []
    }
  },

  // ============================================================================
  // 3. INITIALIZE FORM
  // ============================================================================

  init() {
    console.log("[FormLogic] Initializing form...");
    this.formData = this.getInitialState();
    return this.formData;
  },

  getInitialState() {
    return {
      path: null,
      submissionTime: null,
      formVersion: "1.0",
      contact: {
        name: null,
        email: null,
        phone: null
      },
      trunk: {
        Q2_timeline: null,
        Q3_propertyTypes: [],
        Q4_budget: null,
        Q5_areas: [],
        Q6_homeStatus: null,
        Q6_sellFirstRequired: null,
        Q7_pets: null,
        Q7_petTypes: [],
        Q7_petOther: null
      },
      pathData: {
        Q8_preApproval: null,
        Q8_approvalAmount: null,
        Q9_lenderLinkClicked: false,
        Q10_buyerAgreed: null,
        Q11_homeOwnershipStatus: null,
        Q12_newResale: null,
        Q13_bedsBaths: null,
        Q14_mustHaves: null,
        Q15_buyerAgreed: null,
        Q8_propertyCondition: null,
        Q9_motivatedTimeline: null,
        Q10_sellReason: null,
        Q11_listingHistory: null,
        Q12_openHouseWilling: null,
        Q13_virtualTourWilling: null,
        Q14_agentPreference: null,
        Q8_rentalBudget: null,
        Q9_bedroomsBathrooms: null,
        Q10_rentalAmenities: [],
        Q11_rentalMoveIn: null,
        Q12_leaseTerm: null,
        Q13_pets: null,
        Q13_petTypes: [],
        Q13_petOther: null,
        Q14_employment: null,
        Q8_commercialType: null,
        Q9_squareFootage: null,
        Q10_leasePurchase: null,
        Q11_moveInTimeline: null,
        Q12_businessType: null,
        Q13_ownershipStructure: null,
        Q14_financialQualification: null,
        Q8_questionCategory: null,
        Q9_questionDetails: null,
        Q10_callback: null
      },
      flags: [],
      urgencyScore: 0
    };
  },

  // ============================================================================
  // 4. PATH ROUTING (Q1)
  // ============================================================================

  setPath(selectedPath) {
    if (!this.paths[selectedPath]) {
      console.error(`[FormLogic] Invalid path: ${selectedPath}`);
      return false;
    }

    this.formData.path = selectedPath;
    console.log(`[FormLogic] Path set to: ${selectedPath} (${this.getTotalQuestions()} total questions)`);

    return true;
  },

  getPath() {
    return this.formData.path;
  },

  // ============================================================================
  // 5. QUESTION SEQUENCING & PROGRESS
  // ============================================================================

  getTotalQuestions() {
    if (!this.formData.path) return 0;

    const pathDef = this.paths[this.formData.path];
    let total = pathDef.trunkQuestions + pathDef.pathQuestions;

    // Add conditional questions
    if (this.formData.path === "buyer" && this.formData.pathData.Q8_preApproval !== "pre-approved") {
      total += 1; // Q9 lender button appears
    }

    if ((this.formData.path === "renter" || this.formData.path === "sellbuy") &&
        this.formData.trunk.Q7_pets === "yes") {
      total += 1; // Q13 sub-question for pets
    }

    return total;
  },

  // ============================================================================
  // 7. SMART FLAGS (R1-R18)
  // ============================================================================

  /**
   * Detects all smart flags and calculates urgency score
   * Called before submission
   */
  detectSmartFlags() {
    this.formData.flags = [];
    let urgencyScore = 0;

    // R1: Buyer + not preapproved
    if (this.formData.path === "buyer" &&
        this.formData.pathData.Q8_preApproval !== "pre-approved") {
      this.formData.flags.push("needs-preapproval");
      urgencyScore += 2;
    }

    // R2: Buyer + preapproved (HOT)
    if (this.formData.path === "buyer" &&
        this.formData.pathData.Q8_preApproval === "pre-approved") {
      this.formData.flags.push("preapproved-buyer");
      urgencyScore += 9;
    }

    // R3: Buyer + cash (HOT)
    if (this.formData.path === "buyer" &&
        this.formData.pathData.Q8_preApproval === "cash") {
      this.formData.flags.push("cash-buyer");
      urgencyScore += 10;
    }

    // R4: Buyer owns home + will sell first (reroute to SELL+BUY)
    if (this.formData.path === "buyer" &&
        this.formData.trunk.Q6_homeStatus === "own" &&
        this.formData.trunk.Q6_sellFirstRequired === "yes_must_sell") {
      // This triggers auto-routing, flag it
      this.formData.flags.push("needs-sell-first");
      urgencyScore += 5;
    }

    // R6: Seller + ASAP timeline
    if (this.formData.path === "seller" &&
        this.formData.pathData.Q9_motivatedTimeline === "asap") {
      this.formData.flags.push("urgent-sale");
      urgencyScore += 9;
    }

    // R7: Renter + has pets
    if (this.formData.path === "renter" &&
        this.formData.trunk.Q7_pets === "yes") {
      this.formData.flags.push("has-pets");
      urgencyScore += 3;
    }

    // R8: Renter + self-employed
    if (this.formData.path === "renter" &&
        this.formData.pathData.Q14_employment === "self_employed") {
      this.formData.flags.push("future-buyer-investor");
      urgencyScore += 6;
    }

    // R9: ANY + existing agent (from Q7 context - adapt to your field name)
    // NOTE: Adjust field name if different in your form
    if (this.formData.trunk.Q7_existingAgent === "yes") {
      this.formData.flags.push("existing-agent");
      urgencyScore += 2;
    }

    // R10: Commercial + >25K SF
    if (this.formData.path === "commercial" &&
        (this.formData.pathData.Q9_squareFootage === "25k-50k" ||
         this.formData.pathData.Q9_squareFootage === "50k+")) {
      this.formData.flags.push("commercial-large");
      urgencyScore += 7;
    }

    // R11: Timeline pressure (any path, ASAP)
    if (this.formData.trunk.Q2_timeline === "within_month") {
      this.formData.flags.push("timeline-urgent");
      urgencyScore += 4;
    }

    // R12: Budget high-end (buyer)
    if (this.formData.path === "buyer" &&
        (this.formData.trunk.Q4_budget === "1m-2m" ||
         this.formData.trunk.Q4_budget === "2m+")) {
      this.formData.flags.push("high-budget-buyer");
      urgencyScore += 8;
    }

    // R13: Lender link NOT clicked (buyer at not_yet stage)
    if (this.formData.path === "buyer" &&
        this.formData.pathData.Q8_preApproval === "not_yet" &&
        !this.formData.pathData.Q9_lenderLinkClicked) {
      this.formData.flags.push("lender-link-not-clicked");
      urgencyScore += 1;
    }

    // R14: Sell+Buy path (complex transaction)
    if (this.formData.path === "sellbuy") {
      this.formData.flags.push("sell-buy-bridge");
      urgencyScore += 7;
    }

    // Cap urgency score at 10
    this.formData.urgencyScore = Math.min(urgencyScore, 10);

    console.log(`[FormLogic] Detected flags:`, this.formData.flags);
    console.log(`[FormLogic] Urgency score:`, this.formData.urgencyScore);

    return {
      flags: this.formData.flags,
      urgencyScore: this.formData.urgencyScore
    };
  },

  // ============================================================================
  // 10. SUBMISSION DATA STRUCTURE
  // ============================================================================

  /**
   * Builds the submission object ready to POST to HubSpot
   */
  buildSubmissionObject() {
    this.formData.submissionTime = new Date().toISOString();

    // Detect smart flags
    this.detectSmartFlags();

    const submission = {
      // Metadata
      path: this.formData.path,
      submissionTime: this.formData.submissionTime,
      formVersion: this.formData.formVersion,

      // Contact info
      contact: {
        name: this.formData.contact.name,
        email: this.formData.contact.email,
        phone: this.formData.contact.phone
      },

      // Shared trunk
      trunk: {
        Q2_timeline: this.formData.trunk.Q2_timeline,
        Q3_propertyTypes: this.formData.trunk.Q3_propertyTypes,
        Q4_budget: this.formData.trunk.Q4_budget,
        Q5_areas: this.formData.trunk.Q5_areas,
        Q6_homeStatus: this.formData.trunk.Q6_homeStatus,
        Q6_sellFirstRequired: this.formData.trunk.Q6_sellFirstRequired,
        Q7_pets: this.formData.trunk.Q7_pets,
        Q7_petTypes: this.formData.trunk.Q7_petTypes,
        Q7_petOther: this.formData.trunk.Q7_petOther
      },

      // Path-specific data (subset based on path)
      pathData: this.buildPathDataForSubmission(),

      // Smart flags and scoring
      flags: this.formData.flags,
      urgencyScore: this.formData.urgencyScore,

      // Lender link tracking (buyer only)
      lenderLinkClicked: this.formData.pathData.Q9_lenderLinkClicked
    };

    return submission;
  },

  /**
   * Builds path-specific data subset for submission
   */
  buildPathDataForSubmission() {
    const submission = {};

    switch (this.formData.path) {
      case "buyer":
      case "sellbuy": // Include buyer data for sell+buy
        submission.Q8_preApproval = this.formData.pathData.Q8_preApproval;
        submission.Q8_approvalAmount = this.formData.pathData.Q8_approvalAmount;
        submission.Q9_lenderLinkClicked = this.formData.pathData.Q9_lenderLinkClicked;
        submission.Q10_buyerAgreed = this.formData.pathData.Q10_buyerAgreed;
        submission.Q11_homeOwnershipStatus = this.formData.pathData.Q11_homeOwnershipStatus;
        submission.Q12_newResale = this.formData.pathData.Q12_newResale;
        submission.Q13_bedsBaths = this.formData.pathData.Q13_bedsBaths;
        submission.Q14_mustHaves = this.formData.pathData.Q14_mustHaves;
        submission.Q15_buyerAgreed = this.formData.pathData.Q15_buyerAgreed;

        if (this.formData.path === "sellbuy") {
          // Also include seller data
          submission.Q8_propertyCondition = this.formData.pathData.Q8_propertyCondition;
          submission.Q9_motivatedTimeline = this.formData.pathData.Q9_motivatedTimeline;
          submission.Q10_sellReason = this.formData.pathData.Q10_sellReason;
          submission.Q11_listingHistory = this.formData.pathData.Q11_listingHistory;
          submission.Q12_openHouseWilling = this.formData.pathData.Q12_openHouseWilling;
          submission.Q13_virtualTourWilling = this.formData.pathData.Q13_virtualTourWilling;
          submission.Q14_agentPreference = this.formData.pathData.Q14_agentPreference;
        }
        break;

      case "seller":
        submission.Q8_propertyCondition = this.formData.pathData.Q8_propertyCondition;
        submission.Q9_motivatedTimeline = this.formData.pathData.Q9_motivatedTimeline;
        submission.Q10_sellReason = this.formData.pathData.Q10_sellReason;
        submission.Q11_listingHistory = this.formData.pathData.Q11_listingHistory;
        submission.Q12_openHouseWilling = this.formData.pathData.Q12_openHouseWilling;
        submission.Q13_virtualTourWilling = this.formData.pathData.Q13_virtualTourWilling;
        submission.Q14_agentPreference = this.formData.pathData.Q14_agentPreference;
        break;

      case "renter":
        submission.Q8_rentalBudget = this.formData.pathData.Q8_rentalBudget;
        submission.Q9_bedroomsBathrooms = this.formData.pathData.Q9_bedroomsBathrooms;
        submission.Q10_rentalAmenities = this.formData.pathData.Q10_rentalAmenities;
        submission.Q11_rentalMoveIn = this.formData.pathData.Q11_rentalMoveIn;
        submission.Q12_leaseTerm = this.formData.pathData.Q12_leaseTerm;
        submission.Q13_pets = this.formData.trunk.Q7_pets;
        submission.Q13_petTypes = this.formData.trunk.Q7_petTypes;
        submission.Q13_petOther = this.formData.trunk.Q7_petOther;
        submission.Q14_employment = this.formData.pathData.Q14_employment;
        break;

      case "commercial":
        submission.Q8_commercialType = this.formData.pathData.Q8_commercialType;
        submission.Q9_squareFootage = this.formData.pathData.Q9_squareFootage;
        submission.Q10_leasePurchase = this.formData.pathData.Q10_leasePurchase;
        submission.Q11_moveInTimeline = this.formData.pathData.Q11_moveInTimeline;
        submission.Q12_businessType = this.formData.pathData.Q12_businessType;
        submission.Q13_ownershipStructure = this.formData.pathData.Q13_ownershipStructure;
        submission.Q14_financialQualification = this.formData.pathData.Q14_financialQualification;
        break;

      case "notsure":
        submission.Q8_questionCategory = this.formData.pathData.Q8_questionCategory;
        submission.Q9_questionDetails = this.formData.pathData.Q9_questionDetails;
        submission.Q10_callback = this.formData.pathData.Q10_callback;
        break;
    }

    return submission;
  },

  // ============================================================================
  // 11. VALIDATION
  // ============================================================================

  /**
   * Validates a specific field
   * Returns: { valid: boolean, error: string }
   */
  validateField(fieldName, value) {
    const result = { valid: true, error: "" };

    switch (fieldName) {
      case "name":
        if (!value || value.trim().length < 2) {
          result.valid = false;
          result.error = "Enter a valid name";
        } else if (/\d/.test(value)) {
          result.valid = false;
          result.error = "Name cannot contain numbers";
        }
        break;

      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value || !emailRegex.test(value)) {
          result.valid = false;
          result.error = "Enter a valid email address";
        }
        break;

      case "phone":
        // Accept 10-digit US or international format
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!value || !phoneRegex.test(value.replace(/\s/g, ""))) {
          result.valid = false;
          result.error = "Enter a valid phone number";
        }
        break;

      case "location":
        if (!value || value.trim().length < 3) {
          result.valid = false;
          result.error = "Enter a valid location";
        }
        break;

      case "timeline":
      case "budget":
      case "homeStatus":
      case "pets":
      case "preApproval":
      case "propertyType":
        if (!value) {
          result.valid = false;
          result.error = "Please select an option";
        }
        break;

      case "propertyTypes": // Array field
        if (!Array.isArray(value) || value.length === 0) {
          result.valid = false;
          result.error = "Select at least one property type";
        }
        break;

      case "petTypes": // Array field
        if (!Array.isArray(value) || value.length === 0) {
          result.valid = false;
          result.error = "Select at least one pet type";
        }
        break;

      case "petOther":
        if (!value || value.trim().length === 0) {
          result.valid = false;
          result.error = "Please specify";
        }
        break;

      case "approvalAmount":
        if (!value || isNaN(value) || value <= 0) {
          result.valid = false;
          result.error = "Enter a valid amount";
        }
        break;
    }

    return result;
  },

  // ============================================================================
  // 13. STATE UPDATES
  // ============================================================================

  updateTrunkField(fieldName, value) {
    if (this.formData.trunk.hasOwnProperty(fieldName)) {
      this.formData.trunk[fieldName] = value;
      console.log(`[FormLogic] Updated trunk.${fieldName} =`, value);
      return true;
    }
    console.warn(`[FormLogic] Unknown trunk field: ${fieldName}`);
    return false;
  },

  updatePathField(fieldName, value) {
    if (this.formData.pathData.hasOwnProperty(fieldName)) {
      this.formData.pathData[fieldName] = value;
      console.log(`[FormLogic] Updated pathData.${fieldName} =`, value);
      return true;
    }
    console.warn(`[FormLogic] Unknown path field: ${fieldName}`);
    return false;
  },

  updateContactField(fieldName, value) {
    if (this.formData.contact.hasOwnProperty(fieldName)) {
      this.formData.contact[fieldName] = value;
      console.log(`[FormLogic] Updated contact.${fieldName} =`, value);
      return true;
    }
    console.warn(`[FormLogic] Unknown contact field: ${fieldName}`);
    return false;
  },
};

// Export for use in HTML/modules (if using ES6)
if (typeof module !== "undefined" && module.exports) {
  module.exports = FormLogic;
}

