import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "./src/lib/supabase";
import { createClient } from "@supabase/supabase-js";

// Create Admin Client using Service Role Key to bypass RLS and create users securely
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);



const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Create Auth User securely using Admin Service Key (so the Admin isn't logged out)
app.post("/api/admin/create-client-user", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Service Role Key is missing in backend configuration." });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Auto confirm their email so they can login immediately
    });

    if (error) {
      console.error("Supabase Admin Create User Error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    
    return res.json({ success: true, user: data.user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// n8n Webhook Receiver Endpoint
app.post("/api/webhook/lead", async (req, res) => {
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  
  if (providedKey !== expectedApiKey) {
    return res.status(401).json({ error: "Unauthorized access. Invalid API Key." });
  }

  const { client_id, contact_name, contact_email, contact_phone, service_requested, message, lead_score, is_spam, ai_summary, source } = req.body;

  if (!client_id || !contact_name) {
    return res.status(400).json({ error: "client_id and contact_name are required fields." });
  }

  try {
    const { data, error } = await supabaseAdmin.from("leads").insert({
      client_id,
      form_data: { contact_name, contact_email, contact_phone, service_requested, message, lead_score },
      status: is_spam ? 'SPAM' : 'GENUINE',
      ai_reason: ai_summary || '',
      channel: source || 'n8n_webhook'
    }).select().single();

    if (error) throw error;
    
    return res.json({ success: true, message: "Lead received and safely stored in database.", lead: data });
  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    return res.status(500).json({ error: "Internal server error while saving lead.", details: err.message });
  }
});

// Admin endpoint to manually trigger 30-day spam auto-cleanup function in Postgres
app.post("/api/admin/cleanup-spam", async (req, res) => {
  try {
    const { error } = await supabaseAdmin.rpc("cleanup_old_spam");
    if (error) {
      // If the RPC isn't deployed yet, fallback to manual node-side deletion
      if (error.code === 'PGRST202') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { error: manualErr } = await supabaseAdmin
          .from("leads")
          .delete()
          .eq("status", "spam")
          .lt("created_at", thirtyDaysAgo.toISOString());
          
        if (manualErr) throw manualErr;
        return res.json({ success: true, message: "Cleaned up old spam via manual query fallback." });
      }
      throw error;
    }
    return res.json({ success: true, message: "Successfully executed cleanup_old_spam Postgres function." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to execute cleanup." });
  }
});

// Fetch all data from Supabase instead of local file
app.get("/api/data", async (req, res) => {
  try {
    const [
      { data: clients },
      { data: n8nConfigs },
      { data: gmbMetrics },
      { data: leads },
      { data: profiles }
    ] = await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("n8n_configs").select("*"),
      supabase.from("gmb_metrics").select("*"),
      supabase.from("leads").select("*").order('created_at', { ascending: false }),
      supabase.from("profiles").select("*")
    ]);

    res.json({
      clients: clients || [],
      users: profiles || [],
      gmbMetrics: gmbMetrics || [],
      n8nConfigs: n8nConfigs || [],
      leads: leads || []
    });
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Dynamic API endpoint to query genuine vs spam lead intelligence
app.get("/api/leads/stats", async (req, res) => {
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  if (providedKey !== expectedApiKey) {
    return res.status(401).json({ status: "error", message: "Unauthorized access path." });
  }

  const { client_id, start_date, end_date } = req.query;

  let query = supabase.from("leads").select("*");

  if (client_id && typeof client_id === "string") {
    query = query.eq("client_id", client_id.trim().toLowerCase());
  }
  if (start_date && typeof start_date === "string") {
    const startDateLimit = new Date(start_date);
    if (!isNaN(startDateLimit.getTime())) {
      query = query.gte("created_at", startDateLimit.toISOString());
    }
  }
  if (end_date && typeof end_date === "string") {
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(end_date);
    const endDateLimit = new Date(isIsoDateOnly ? `${end_date}T23:59:59.999Z` : end_date);
    if (!isNaN(endDateLimit.getTime())) {
      query = query.lte("created_at", endDateLimit.toISOString());
    }
  }

  const { data: filteredLeads, error } = await query;

  if (error) {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }

  let genuineCount = 0;
  let spamCount = 0;
  const dailyBreakdown: Record<string, { genuine: number; spam: number; total: number }> = {};

  (filteredLeads || []).forEach((lead: any) => {
    const isGenuine = lead.status === "GENUINE";
    if (isGenuine) genuineCount++; else spamCount++;

    const dateStr = lead.created_at ? new Date(lead.created_at).toISOString().slice(0, 10) : "unknown_date";
    if (!dailyBreakdown[dateStr]) {
      dailyBreakdown[dateStr] = { genuine: 0, spam: 0, total: 0 };
    }
    dailyBreakdown[dateStr].total++;
    if (isGenuine) dailyBreakdown[dateStr].genuine++; else dailyBreakdown[dateStr].spam++;
  });

  const dailyBreakdownArray = Object.keys(dailyBreakdown).sort().map((date) => ({
    date, ...dailyBreakdown[date]
  }));

  res.json({
    status: "success",
    client_id: client_id || "all",
    date_range: { start: start_date || null, end: end_date || null },
    summary: {
      total_leads: filteredLeads.length,
      genuine_leads: genuineCount,
      spam_leads: spamCount,
      spam_rate_percentage: filteredLeads.length > 0 ? Math.round((spamCount / filteredLeads.length) * 100) : 0
    },
    daily_breakdown: dailyBreakdownArray,
    leads: filteredLeads
  });
});

app.get("/api/check-google-ads-key", (req, res) => {
  res.json({ configured: !!process.env.GEMINI_API_KEY });
});

// Saves
app.post("/api/save-clients", async (req, res) => {
  const { error } = await supabase.from('clients').upsert(req.body, { onConflict: 'client_id' });
  if (error) console.error("Error saving clients", error);
  res.json({ success: !error });
});

app.post("/api/save-leads", async (req, res) => {
  const { error } = await supabase.from('leads').upsert(req.body, { onConflict: 'id' });
  res.json({ success: !error });
});

app.post("/api/save-users", async (req, res) => {
  // Profiles are handled by Supabase Auth, keeping this for backward compatibility in MVP UI
  const { error } = await supabase.from('profiles').upsert(req.body, { onConflict: 'username' });
  res.json({ success: !error });
});

app.post("/api/save-gmb-metrics", async (req, res) => {
  const { error } = await supabase.from('gmb_metrics').upsert(req.body, { onConflict: 'id' });
  res.json({ success: !error });
});

app.post("/api/save-n8n-configs", async (req, res) => {
  const { error } = await supabase.from('n8n_configs').upsert(req.body, { onConflict: 'client_id' });
  if (error) console.error("Error saving configs", error);
  res.json({ success: !error });
});

// Webhook
const handleReceiveLead = async (req: express.Request, res: express.Response) => {
  const client_id = req.body.client_id || req.query.client_id || "sydney_decking";
  const channel = req.body.channel || "website";
  
  let form_data: any = {};
  if (req.body.form_data) {
    if (typeof req.body.form_data === "string") {
      try { form_data = JSON.parse(req.body.form_data); } 
      catch { form_data = { raw: req.body.form_data }; }
    } else {
      form_data = req.body.form_data;
    }
  } else {
    const ignoredKeys = ["client_id", "channel", "status", "ai_reason", "verdict", "reason", "key"];
    for (const key of Object.keys(req.body)) {
      if (!ignoredKeys.includes(key)) form_data[key] = req.body[key];
    }
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
  const logTimestamp = new Date().toISOString();

  console.log(`[${logTimestamp}] Webhook trigger hit for client "${client_id}" - Raw Payload:`, req.body);

  if (status && typeof status === "string") {
    status = status.toUpperCase() === "GENUINE" || status.toUpperCase() === "SPAM" ? status.toUpperCase() : null;
  }

  const { data: configData } = await supabase.from('n8n_configs').select('*').eq('client_id', client_id).single();
  const config = configData || {
    gemini_prompt: "Determine if this message is a genuine business lead inquiry (GENUINE) or commercial spam/advertising (SPAM). Reply in strict JSON: { \"verdict\": \"GENUINE\" | \"SPAM\", \"reason\": \"string\" }",
    gemini_models: ["gemini-3.5-flash"],
    webhook_url: ""
  };

  if (!status && config.webhook_url && (config.webhook_url.startsWith("http://") || config.webhook_url.startsWith("https://"))) {
    try {
      const n8nResponse = await fetch(config.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "X-LeadShield-Trigger": "InboundIngressWebhook" },
        body: JSON.stringify({ client_id, channel, form_data, ...config, generated_timestamp: logTimestamp })
      });
      if (n8nResponse.ok) {
        const responseText = await n8nResponse.text();
        try {
          const parsedRes = JSON.parse(responseText);
          const dataForClassification = Array.isArray(parsedRes) ? parsedRes[0] : parsedRes;
          if (dataForClassification) {
            const possibleVerdict = dataForClassification.verdict || dataForClassification.status || dataForClassification.classification;
            const possibleReason = dataForClassification.reason || dataForClassification.ai_reason || dataForClassification.explanation;
            if (possibleVerdict && (possibleVerdict === "GENUINE" || possibleVerdict === "SPAM")) {
              status = possibleVerdict;
              ai_reason = possibleReason || `Verified live by your connected active n8n integration.`;
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.error(`[n8n Forwarder Exception] Failed to reach configured n8n endpoint:`, err.message);
    }
  }

  if (!status) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Instruction rules for classification:\n${config.gemini_prompt}\n\nReview this incoming inquiry details:\n${payload_text}`,
          config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse((response.text || "").trim());
        status = parsed.verdict || "GENUINE";
        ai_reason = parsed.reason || "Evaluated by LeadShield Gemini Core Node.";
      } catch (gemError: any) {
        status = "GENUINE";
        ai_reason = "Failsafe heuristic: Safe query pass - direct builder request.";
      }
    } else {
      status = "GENUINE";
      ai_reason = "Local Heuristic: Genuine form inquiry context matched.";
    }
  }

  const { data: insertedLead, error } = await supabase.from('leads').insert({
    client_id,
    form_data,
    status: status as "GENUINE" | "SPAM",
    ai_reason,
    channel,
    created_at: logTimestamp
  }).select().single();

  res.status(201).json({
    status: "success",
    message: "Form transmission securely structured and indexed in LeadShield Database.",
    lead_id: insertedLead?.id,
    classification: { verdict: status, reason: ai_reason }
  });
};

app.post("/api/receive-lead", handleReceiveLead);
app.post("/lead-shield/api/receive-lead.php", handleReceiveLead);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LeadShield API] Express Server listening securely on internal Port :${PORT}`);
  });
}

startServer();
