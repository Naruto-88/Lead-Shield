import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Middleware to parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for real integrations
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Seed Initial Mock/Default Data
const DEFAULT_CLIENTS = [
  { id: 1, client_id: "sydney_decking", business_name: "Sydney Decking Specialists", contact_email: "contact@sydneydecking.au", status: "active", created_at: "2026-05-18 10:14:02", has_seo: true, has_google_ads: true, has_fb_ads: true, has_gmb: true },
  { id: 2, client_id: "melbourne_renos", business_name: "Melbourne Renovation Co", contact_email: "info@melbrenos.com.au", status: "active", created_at: "2026-05-19 14:32:00", has_seo: true, has_google_ads: true, has_fb_ads: true, has_gmb: false },
  { id: 3, client_id: "brisbane_landscapes", business_name: "Brisbane Landscape Architects", contact_email: "hello@brisbanelandscapes.co", status: "inactive", created_at: "2026-05-20 01:10:45", has_seo: true, has_google_ads: false, has_fb_ads: false, has_gmb: false }
];

const DEFAULT_USERS = [
  { id: 1, username: "nstech", role: "admin", client_id: null },
  { id: 2, username: "sydney_deck", role: "client", client_id: "sydney_decking" },
  { id: 3, username: "melb_renos", role: "client", client_id: "melbourne_renos" },
  { id: 4, username: "brisbane_land", role: "client", client_id: "brisbane_landscapes" }
];

const DEFAULT_GMB_METRICS = [
  { id: "sydney_decking_2026_January", client_id: "sydney_decking", year: 2026, month: "January", call_clicks: 34 },
  { id: "sydney_decking_2026_February", client_id: "sydney_decking", year: 2026, month: "February", call_clicks: 42 },
  { id: "sydney_decking_2026_March", client_id: "sydney_decking", year: 2026, month: "March", call_clicks: 58 },
  { id: "sydney_decking_2026_April", client_id: "sydney_decking", year: 2026, month: "April", call_clicks: 49 },
  { id: "sydney_decking_2026_May", client_id: "sydney_decking", year: 2026, month: "May", call_clicks: 65 }
];

const DEFAULT_N8N_CONFIGS = [
  {
    client_id: "sydney_decking",
    gemini_prompt: "You are the primary spam filter for Sydney Decking Specialists. Analyze the following form submission message. If the customer is inquiring about genuine decking, custom pergolas, timber patios, or cost estimates in the Sydney region, classify as GENUINE. If it is advertisement, SEO requests, backlink pitches, cryptocurrency blogs, generic greetings without context, or slot link insertions, classify as SPAM. Report in strict JSON format: { \"verdict\": \"GENUINE\" | \"SPAM\", \"reason\": \"Detailed analytical logic...\" }",
    gemini_models: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash"],
    openai_enabled: true,
    openai_prompt: "Final threshold checkpoint. You are backing up failed Gemini nodes. Filter the decking lead packet. Be extra conservative but fair. High confidence spam gets SPAM. Genuine customer messages get GENUINE.",
    genuine_recipient_email: "team@sydneydecking.au",
    spam_recipient_email: "spam-inbox@outreachseo.online",
    webhook_url: "https://your-n8n.public_html/webhook/sydney_decking_forms"
  },
  {
    client_id: "melbourne_renos",
    gemini_prompt: "You are the security firewall for Melbourne Renovation Co. Determine if this incoming web inquiry is a genuine renovation lead. Homeowners booking inspections or kitchen/bathroom renovation queries are GENUINE. Mass marketing lists, offshore design services, or generic solicitations are SPAM. Report as JSON with verdict and reason.",
    gemini_models: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash"],
    openai_enabled: true,
    openai_prompt: "Verify the home renovation lead. Determine if genuine or spam.",
    genuine_recipient_email: "leads@melbrenos.com.au",
    spam_recipient_email: "spam-sandbox@outreachseo.online",
    webhook_url: "https://your-n8n.public_html/webhook/melbournerenos_leads"
  },
  {
    client_id: "brisbane_landscapes",
    gemini_prompt: "Spam block utility for Brisbane Landscape Architects. Filter turfing, decking, drainage, and landscape design plans. Block unrelated SEO/promotional pitches. Report structured JSON schema.",
    gemini_models: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash"],
    openai_enabled: false,
    openai_prompt: "Determine if landscaping query is spam or genuine.",
    genuine_recipient_email: "hello@brisbanelandscapes.co",
    spam_recipient_email: "spam-archive@agency.com",
    webhook_url: "https://your-n8n.public_html/webhook/brisbane_landscapes_leads"
  }
];

const DEFAULT_LEADS = [
  { 
    id: 101, 
    client_id: "sydney_decking", 
    form_data: { "name": "Dave Patterson", "email": "dave@pattersonbuild.com", "phone": "+61 412 345 678", "project_type": "Hardwood Decking, 40sqm", "message": "Looking to build an outdoor veranda patio next month. Can you quote?" }, 
    status: "GENUINE", 
    ai_reason: null, 
    channel: "website",
    created_at: "2026-05-19 12:45:11" 
  },
  { 
    id: 102, 
    client_id: "sydney_decking", 
    form_data: { "name": "Elena Seo Growth", "email": "elena.seo.growth@gmail.com", "subject": "Guaranteed Rankings", "message": "Hello agency owner, we offer guaranteed #1 organic rank leads, pay only on results. Review our cheap offshore packages on this page!" }, 
    status: "SPAM", 
    ai_reason: "Gated: Submission matches mass-outreach structure offering SEO / rank promotions.", 
    channel: "website",
    created_at: "2026-05-19 16:20:00" 
  },
  { 
    id: 103, 
    client_id: "sydney_decking", 
    form_data: { "name": "Brian Gallagher", "email": "brian@gallaghers.com.au", "phone": "0429 110 339", "source": "Google Search CPC Campaign", "project_budget": "$12,000", "message": "Need a prompt quotation for a cedar wood patio deck, 30 square meters." }, 
    status: "GENUINE", 
    ai_reason: null, 
    channel: "google_ads",
    created_at: "2026-05-20 09:12:40" 
  },
  { 
    id: 104, 
    client_id: "sydney_decking", 
    form_data: { "name": "Forex Signal Pro", "email": "signals@profitforex-market.club", "message": "Get 98% accurate daily signals on indices and forex pairings. Double your investment within 48 hours..." }, 
    status: "SPAM", 
    ai_reason: "Gated: High density of crypto spam buzzwords (payouts, forex, signals, double investment).", 
    channel: "google_ads",
    created_at: "2026-05-20 11:30:15" 
  },
  { 
    id: 151, 
    client_id: "sydney_decking", 
    form_data: { "name": "Amanda Thorne", "email": "amanda.thorne@hotmail.com", "phone": "0412 990 443", "campaign": "Facebook Summer Decks Promo", "message": "Interested in a free design consult for a customized timber staircase." }, 
    status: "GENUINE", 
    ai_reason: null, 
    channel: "facebook_ads",
    created_at: "2026-05-21 03:22:10" 
  },
  { 
    id: 152, 
    client_id: "sydney_decking", 
    form_data: { "name": "Meta Safety Alert", "email": "case-no-95291@meta-support-secure.org", "message": "Your Facebook Business advertiser account is scheduled for suspension due to violating guidelines. Verify credentials immediate!" }, 
    status: "SPAM", 
    ai_reason: "Gated: Phishing attempt targeting ads account control privileges.", 
    channel: "facebook_ads",
    created_at: "2026-05-21 05:44:00" 
  },
  { 
    id: 153, 
    client_id: "sydney_decking", 
    form_data: { "caller_name": "James Lawson", "phone": "0491 570 156", "duration": "4 mins 12 secs", "gmb_listing": "Sydney Decking & Patios", "transcription": "Hi, saw your GMB map listings, wanted to ask if you do council approvals?" }, 
    status: "GENUINE", 
    ai_reason: null, 
    channel: "gmb",
    created_at: "2026-05-21 08:30:00" 
  },
  { 
    id: 105, 
    client_id: "melbourne_renos", 
    form_data: { "full_name": "Marcus Aurelius", "email": "marcus@rome.org", "phone": "0499 999 999", "renovation_scope": "Full Kitchen Retrofit", "budget": "$45,000" }, 
    status: "GENUINE", 
    ai_reason: null, 
    channel: "website",
    created_at: "2026-05-20 02:05:10" 
  },
  { 
    id: 106, 
    client_id: "melbourne_renos", 
    form_data: { "full_name": "BitPayouts BOT", "email": "payouts@shiba-inu-elon.info", "subject": "Urgent Passive cryptocurrency", "message": "Earn $2500 per day passive cryptocurrency. Try shiba-presale.io or transfer instantly on this verified link..." }, 
    status: "SPAM", 
    ai_reason: "Gated: High density of crypto spam buzzwords (payouts, bitcoin, shiba, double earnings).", 
    channel: "website",
    created_at: "2026-05-20 02:45:00" 
  }
];

// Helper to read database
function getDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        clients: DEFAULT_CLIENTS,
        users: DEFAULT_USERS,
        gmbMetrics: DEFAULT_GMB_METRICS,
        n8nConfigs: DEFAULT_N8N_CONFIGS,
        leads: DEFAULT_LEADS
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, returning defaults:", err);
    return {
      clients: DEFAULT_CLIENTS,
      users: DEFAULT_USERS,
      gmbMetrics: DEFAULT_GMB_METRICS,
      n8nConfigs: DEFAULT_N8N_CONFIGS,
      leads: DEFAULT_LEADS
    };
  }
}

// Helper to write database
function writeDb(dbData: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to database file:", err);
  }
}

// REST endpoints for React context synchronization
app.get("/api/data", (req, res) => {
  const db = getDb();
  res.json(db);
});

// Dynamic API endpoint to query genuine vs spam lead intelligence stats with robust date range filtering
app.get("/api/leads/stats", (req, res) => {
  const db = getDb();
  
  // Security key: use configured secret or fallback default to make integration plug-and-play
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  if (providedKey !== expectedApiKey) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized access path. Valid X-API-Key header or api_key query parameter required."
    });
  }

  const { client_id, start_date, end_date } = req.query;

  let filteredLeads = [...db.leads];

  // 1. Client ID Filtering
  if (client_id && typeof client_id === "string") {
    filteredLeads = filteredLeads.filter(
      (lead: any) => lead.client_id.trim().toLowerCase() === client_id.trim().toLowerCase()
    );
  }

  // 2. Date Filtering
  let startDateLimit: Date | null = null;
  let endDateLimit: Date | null = null;

  if (start_date && typeof start_date === "string") {
    startDateLimit = new Date(start_date);
    if (isNaN(startDateLimit.getTime())) {
      startDateLimit = null;
    }
  }

  if (end_date && typeof end_date === "string") {
    // If a simple date YYYY-MM-DD is sent, extend to the end of that day
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(end_date);
    endDateLimit = new Date(isIsoDateOnly ? `${end_date}T23:59:59.999Z` : end_date);
    if (isNaN(endDateLimit.getTime())) {
      endDateLimit = null;
    }
  }

  filteredLeads = filteredLeads.filter((lead: any) => {
    if (!lead.created_at) return false;
    
    // Convert 'YYYY-MM-DD HH:mm:ss' to support full Date parser by replacing spaces with T
    const normalizedDateStr = lead.created_at.includes("T") ? lead.created_at : lead.created_at.replace(" ", "T");
    const leadDate = new Date(normalizedDateStr);

    if (isNaN(leadDate.getTime())) {
      return true; // Failsafe: retain records with custom unparseable string tags
    }

    if (startDateLimit && leadDate < startDateLimit) {
      return false;
    }
    if (endDateLimit && leadDate > endDateLimit) {
      return false;
    }
    return true;
  });

  // Quantify totals
  let genuineCount = 0;
  let spamCount = 0;
  const dailyBreakdown: Record<string, { genuine: number; spam: number; total: number }> = {};

  filteredLeads.forEach((lead: any) => {
    const isGenuine = lead.status === "GENUINE";
    if (isGenuine) {
      genuineCount++;
    } else {
      spamCount++;
    }

    // Capture date (YYYY-MM-DD)
    const dateStr = lead.created_at ? lead.created_at.slice(0, 10) : "unknown_date";
    if (!dailyBreakdown[dateStr]) {
      dailyBreakdown[dateStr] = { genuine: 0, spam: 0, total: 0 };
    }
    
    dailyBreakdown[dateStr].total++;
    if (isGenuine) {
      dailyBreakdown[dateStr].genuine++;
    } else {
      dailyBreakdown[dateStr].spam++;
    }
  });

  // Format and sort daily historical records
  const dailyBreakdownArray = Object.keys(dailyBreakdown)
    .sort()
    .map((date) => ({
      date,
      total: dailyBreakdown[date].total,
      genuine: dailyBreakdown[date].genuine,
      spam: dailyBreakdown[date].spam,
    }));

  res.json({
    status: "success",
    client_id: client_id || "all",
    date_range: {
      start: start_date || null,
      end: end_date || null
    },
    summary: {
      total_leads: filteredLeads.length,
      genuine_leads: genuineCount,
      spam_leads: spamCount,
      spam_rate_percentage: filteredLeads.length > 0 ? Math.round((spamCount / filteredLeads.length) * 100) : 0
    },
    daily_breakdown: dailyBreakdownArray,
    leads: filteredLeads.map((lead: any) => ({
      id: lead.id,
      client_id: lead.client_id,
      status: lead.status,
      channel: lead.channel || "website",
      created_at: lead.created_at,
      form_data: lead.form_data,
      ai_reason: lead.ai_reason
    }))
  });
});

// Single client-facing endpoint to verify API key is present
app.get("/api/check-google-ads-key", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({ configured: hasKey });
});

// Saves
app.post("/api/save-clients", (req, res) => {
  const db = getDb();
  db.clients = req.body;
  writeDb(db);
  res.json({ success: true });
});

app.post("/api/save-leads", (req, res) => {
  const db = getDb();
  db.leads = req.body;
  writeDb(db);
  res.json({ success: true });
});

app.post("/api/save-users", (req, res) => {
  const db = getDb();
  db.users = req.body;
  writeDb(db);
  res.json({ success: true });
});

app.post("/api/save-gmb-metrics", (req, res) => {
  const db = getDb();
  db.gmbMetrics = req.body;
  writeDb(db);
  res.json({ success: true });
});

app.post("/api/save-n8n-configs", (req, res) => {
  const db = getDb();
  db.n8nConfigs = req.body;
  writeDb(db);
  res.json({ success: true });
});

// Live lead-shield/api/receive-lead.php and /api/receive-lead webhook triggers for n8n or generic scrapers
const handleReceiveLead = async (req: express.Request, res: express.Response) => {
  const db = getDb();
  
  // Scraper payload could come as nested JSON or flattened root, let's extract carefully
  const client_id = req.body.client_id || req.query.client_id || "sydney_decking";
  const channel = req.body.channel || "website";
  
  // Extract form fields
  let form_data: any = {};
  if (req.body.form_data) {
    if (typeof req.body.form_data === "string") {
      try {
        form_data = JSON.parse(req.body.form_data);
      } catch {
        form_data = { raw: req.body.form_data };
      }
    } else {
      form_data = req.body.form_data;
    }
  } else {
    // Collect arbitrary POST fields into form_data payload
    const ignoredKeys = ["client_id", "channel", "status", "ai_reason", "verdict", "reason", "key"];
    for (const key of Object.keys(req.body)) {
      if (!ignoredKeys.includes(key)) {
        form_data[key] = req.body[key];
      }
    }
    // Fallbacks if form fields are direct
    if (Object.keys(form_data).length === 0) {
      form_data = {
        name: req.body.name || req.body.full_name || "Anonymous User",
        email: req.body.email || "contact@email.com",
        message: req.body.message || "No message body supplied."
      };
    }
  }

  const payload_text = JSON.stringify(form_data);
  let status = req.body.status || req.body.verdict || null;
  let ai_reason = req.body.ai_reason || req.body.reason || null;
  let forwardedToN8n = false;
  let n8nResponseData: any = null;

  // Let's print logs
  const logTimestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${logTimestamp}] Webhook trigger hit for client "${client_id}" - Raw Payload:`, req.body);

  // Normalize status if provided
  if (status && typeof status === "string") {
    const statusUpper = status.toUpperCase();
    if (statusUpper === "GENUINE" || statusUpper === "SPAM") {
      status = statusUpper;
    } else {
      status = null;
    }
  }

  const config = db.n8nConfigs.find((c: any) => c.client_id === client_id) || {
    gemini_prompt: "Determine if this message is a genuine business lead inquiry (GENUINE) or commercial spam/advertising (SPAM). Reply in strict JSON: { \"verdict\": \"GENUINE\" | \"SPAM\", \"reason\": \"string\" }",
    gemini_models: ["gemini-3.5-flash"],
    webhook_url: ""
  };

  // 1. Live n8n Forwarding Action (If a real webhook URL of http/https is specified in the UI config)
  // Skip if we already received a pre-calculated status (representing n8n sent us this post-processed lead)
  if (!status && config.webhook_url && (config.webhook_url.startsWith("http://") || config.webhook_url.startsWith("https://"))) {
    console.log(`[n8n Forwarder] Forwarding live lead packet to real n8n webhook URL: ${config.webhook_url}`);
    try {
      const n8nResponse = await fetch(config.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-LeadShield-Trigger": "InboundIngressWebhook"
        },
        body: JSON.stringify({
          lead_id: db.leads.length > 0 ? Math.max(...db.leads.map((l: any) => l.id)) + 1 : 1001,
          client_id,
          channel,
          form_data,
          gemini_prompt: config.gemini_prompt,
          gemini_models: config.gemini_models,
          openai_enabled: config.openai_enabled,
          openai_prompt: config.openai_prompt,
          genuine_recipient_email: config.genuine_recipient_email,
          spam_recipient_email: config.spam_recipient_email,
          generated_timestamp: logTimestamp
        })
      });

      if (n8nResponse.ok) {
        forwardedToN8n = true;
        const responseText = await n8nResponse.text();
        console.log(`[n8n Response] Received raw stream response:`, responseText);
        try {
          const parsedRes = JSON.parse(responseText);
          n8nResponseData = parsedRes;
          
          // Check if n8n returned a classification decisions block
          // Either standard { verdict, reason } or array or matching attributes
          const dataForClassification = Array.isArray(parsedRes) ? parsedRes[0] : parsedRes;
          if (dataForClassification) {
            const possibleVerdict = dataForClassification.verdict || dataForClassification.status || dataForClassification.classification;
            const possibleReason = dataForClassification.reason || dataForClassification.ai_reason || dataForClassification.explanation;
            
            if (possibleVerdict && (possibleVerdict === "GENUINE" || possibleVerdict === "SPAM")) {
              status = possibleVerdict;
              ai_reason = possibleReason || `Verified live by your connected active n8n integration.`;
              console.log(`[n8n Custom Verdict Applied] n8n determined this lead is: ${status}`);
            }
          }
        } catch {
          // n8n webhook replied with non-JSON success message or no verdict, safe to ignore & fallback
          console.log(`[n8n Success] Webhook succeeded, but didn't return a structured verdict JSON.`);
        }
      } else {
        console.warn(`[n8n Webhook Error] Outbound request returned HTTP ${n8nResponse.status}`);
      }
    } catch (err: any) {
      console.error(`[n8n Forwarder Exception] Failed to reach configured n8n endpoint:`, err.message);
    }
  }

  // 2. Failsafe: If status is still not provided by POST inputs or n8n feedback loop, evaluate using Gemini!
  if (!status) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        console.log(`Analyzing lead with model: ${config.gemini_models[0] || "gemini-3.5-flash"}`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Instruction rules for classification:\n${config.gemini_prompt}\n\nReview this incoming inquiry details:\n${payload_text}`,
          config: {
            responseMimeType: "application/json"
          }
        });

        const textOutput = response.text || "";
        console.log("Raw Gemini evaluation reply:", textOutput);
        const parsed = JSON.parse(textOutput.trim());
        status = parsed.verdict || "GENUINE";
        ai_reason = parsed.reason || "Evaluated by LeadShield Gemini Core Node.";
      } catch (gemError: any) {
        console.error("Gemini on-the-fly execution error:", gemError);
        // Local basic fallback checklist in case API fails
        const lowerTxt = payload_text.toLowerCase();
        if (lowerTxt.includes("seo") || lowerTxt.includes("casino") || lowerTxt.includes("crypto") || lowerTxt.includes("free rank") || lowerTxt.includes("bitcoin")) {
          status = "SPAM";
          ai_reason = "Failsafe heuristic: High frequency spam vocabulary keyword triggers matched.";
        } else {
          status = "GENUINE";
          ai_reason = "Failsafe heuristic: Safe query pass - direct builder request.";
        }
      }
    } else {
      // Local analyzer defaults since GEMINI_API_KEY is not defined yet
      const lowerTxt = payload_text.toLowerCase();
      if (lowerTxt.includes("seo") || lowerTxt.includes("casino") || lowerTxt.includes("crypto") || lowerTxt.includes("free rank") || lowerTxt.includes("bitcoin")) {
        status = "SPAM";
        ai_reason = "Local Heuristic: High risk promotional references detected.";
      } else {
        status = "GENUINE";
        ai_reason = "Local Heuristic: Genuine form inquiry context matched.";
      }
    }
  }

  // Provision unique lead id sequential increment
  const leadId = db.leads.length > 0 ? Math.max(...db.leads.map((l: any) => l.id)) + 1 : 1001;
  const newLead = {
    id: leadId,
    client_id,
    form_data,
    status: status as "GENUINE" | "SPAM",
    ai_reason,
    channel,
    created_at: logTimestamp
  };

  db.leads.unshift(newLead);
  writeDb(db);

  // Return clean JSON response
  res.status(201).json({
    status: "success",
    message: "Form transmission securely structured and indexed in LeadShield Database.",
    lead_id: leadId,
    classification: {
      verdict: status,
      reason: ai_reason
    }
  });
};

// Map identical endpoints to match both the elegant clean REST API and the cPanel script absolute URLs
app.post("/api/receive-lead", handleReceiveLead);
app.post("/lead-shield/api/receive-lead.php", handleReceiveLead);

// Serve the compiled UI static directory in production, mount Vite development middleware in dev environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LeadShield API] Express Server listening securely on internal Port :${PORT}`);
  });
}

startServer();
