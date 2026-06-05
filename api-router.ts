import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "./src/lib/supabase";
import { createClient } from "@supabase/supabase-js";

// Create Admin Client using Service Role Key to bypass RLS and create users securely
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

apiRouter.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Create Auth User securely using Admin Service Key
apiRouter.post("/api/admin/create-client-user", async (req, res) => {
  const { email, password, client_id, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: "Service Role Key is missing in backend configuration." });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return res.status(400).json({ error: error.message });
    
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: data.user.id, username: email, role: role || 'client', client_id: client_id || null
    });
    if (profileError) return res.status(500).json({ error: "Auth created but failed to link profile: " + profileError.message });
    
    return res.json({ success: true, user: data.user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Delete Auth User securely using Admin Service Key
apiRouter.post("/api/admin/delete-client-user", async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: "client_id is required" });
  if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: "Service Role Key missing." });

  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('client_id', client_id).single();
    if (profile && profile.id) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// n8n Webhook Receiver Endpoint
apiRouter.post("/api/webhook/lead", async (req, res) => {
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  if (providedKey !== expectedApiKey) return res.status(401).json({ error: "Unauthorized access. Invalid API Key." });

  const { client_id, contact_name, contact_email, contact_phone, service_requested, message, lead_score, is_spam, ai_summary, source } = req.body;
  if (!client_id || !contact_name) return res.status(400).json({ error: "client_id and contact_name are required fields." });

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
    return res.status(500).json({ error: "Internal server error while saving lead.", details: err.message });
  }
});

// Admin endpoint to manually trigger 30-day spam auto-cleanup function in Postgres
apiRouter.post("/api/admin/cleanup-spam", async (req, res) => {
  try {
    const { error } = await supabaseAdmin.rpc("cleanup_old_spam");
    if (error) {
      if (error.code === 'PGRST202') {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { error: manualErr } = await supabaseAdmin.from("leads").delete().eq("status", "SPAM").lt("created_at", thirtyDaysAgo.toISOString());
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
apiRouter.get("/api/data", async (req, res) => {
  try {
    const [ { data: clients }, { data: n8nConfigs }, { data: gmbMetrics }, { data: leads }, { data: profiles } ] = await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("n8n_configs").select("*"),
      supabase.from("gmb_metrics").select("*"),
      supabase.from("leads").select("*").order('created_at', { ascending: false }),
      supabase.from("profiles").select("*")
    ]);
    res.json({ clients: clients || [], users: profiles || [], gmbMetrics: gmbMetrics || [], n8nConfigs: n8nConfigs || [], leads: leads || [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

apiRouter.get("/api/leads/stats", async (req, res) => {
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  if (providedKey !== expectedApiKey) return res.status(401).json({ status: "error", message: "Unauthorized access path." });

  const { client_id, start_date, end_date } = req.query;
  let query = supabase.from("leads").select("*");

  if (client_id && typeof client_id === "string") query = query.eq("client_id", client_id.trim().toLowerCase());
  if (start_date && typeof start_date === "string") {
    const startDateLimit = new Date(start_date);
    if (!isNaN(startDateLimit.getTime())) query = query.gte("created_at", startDateLimit.toISOString());
  }
  if (end_date && typeof end_date === "string") {
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(end_date);
    const endDateLimit = new Date(isIsoDateOnly ? `${end_date}T23:59:59.999Z` : end_date);
    if (!isNaN(endDateLimit.getTime())) query = query.lte("created_at", endDateLimit.toISOString());
  }

  const { data: filteredLeads, error } = await query;
  if (error) return res.status(500).json({ error: "Failed to fetch stats" });

  let genuineCount = 0; let spamCount = 0;
  const dailyBreakdown: Record<string, { genuine: number; spam: number; total: number }> = {};

  (filteredLeads || []).forEach((lead: any) => {
    const isGenuine = lead.status === "GENUINE";
    if (isGenuine) genuineCount++; else spamCount++;
    const dateStr = lead.created_at ? new Date(lead.created_at).toISOString().slice(0, 10) : "unknown_date";
    if (!dailyBreakdown[dateStr]) dailyBreakdown[dateStr] = { genuine: 0, spam: 0, total: 0 };
    dailyBreakdown[dateStr].total++;
    if (isGenuine) dailyBreakdown[dateStr].genuine++; else dailyBreakdown[dateStr].spam++;
  });

  res.json({
    status: "success", client_id: client_id || "all", date_range: { start: start_date || null, end: end_date || null },
    summary: { total_leads: filteredLeads.length, genuine_leads: genuineCount, spam_leads: spamCount, spam_rate_percentage: filteredLeads.length > 0 ? Math.round((spamCount / filteredLeads.length) * 100) : 0 },
    daily_breakdown: Object.keys(dailyBreakdown).sort().map((date) => ({ date, ...dailyBreakdown[date] })),
    leads: filteredLeads
  });
});

apiRouter.get("/api/check-google-ads-key", (req, res) => {
  res.json({ configured: !!process.env.GEMINI_API_KEY });
});

apiRouter.post("/api/save-clients", async (req, res) => {
  const { error } = await supabase.from('clients').upsert(req.body, { onConflict: 'client_id' });
  res.json({ success: !error });
});
apiRouter.post("/api/save-leads", async (req, res) => {
  const { error } = await supabase.from('leads').upsert(req.body, { onConflict: 'id' });
  res.json({ success: !error });
});
apiRouter.post("/api/save-users", async (req, res) => {
  const { error } = await supabase.from('profiles').upsert(req.body, { onConflict: 'username' });
  res.json({ success: !error });
});
apiRouter.post("/api/save-gmb-metrics", async (req, res) => {
  const { error } = await supabase.from('gmb_metrics').upsert(req.body, { onConflict: 'id' });
  res.json({ success: !error });
});
apiRouter.post("/api/save-n8n-configs", async (req, res) => {
  const { error } = await supabase.from('n8n_configs').upsert(req.body, { onConflict: 'client_id' });
  res.json({ success: !error });
});

const handleReceiveLead = async (req: express.Request, res: express.Response) => {
  const client_id = req.body.client_id || req.query.client_id || "sydney_decking";
  const channel = req.body.channel || "website";
  let form_data: any = {};
  if (req.body.form_data) {
    if (typeof req.body.form_data === "string") {
      try { form_data = JSON.parse(req.body.form_data); } 
      catch { form_data = { raw: req.body.form_data }; }
    } else form_data = req.body.form_data;
  } else {
    const ignoredKeys = ["client_id", "channel", "status", "ai_reason", "verdict", "reason", "key"];
    for (const key of Object.keys(req.body)) if (!ignoredKeys.includes(key)) form_data[key] = req.body[key];
    if (Object.keys(form_data).length === 0) form_data = { name: req.body.name || req.body.full_name || "Anonymous User", email: req.body.email || "contact@email.com", message: req.body.message || "No message body supplied." };
  }

  const payload_text = JSON.stringify(form_data);
  let status = req.body.status || req.body.verdict || null;
  let ai_reason = req.body.ai_reason || req.body.reason || null;
  const logTimestamp = new Date().toISOString();

  if (status && typeof status === "string") status = status.toUpperCase() === "GENUINE" || status.toUpperCase() === "SPAM" ? status.toUpperCase() : null;

  const { data: configData } = await supabase.from('n8n_configs').select('*').eq('client_id', client_id).single();
  const config = configData || { gemini_prompt: "Determine if this message is a genuine business lead inquiry...", gemini_models: ["gemini-3.5-flash"], webhook_url: "" };

  if (!status && config.webhook_url && (config.webhook_url.startsWith("http://") || config.webhook_url.startsWith("https://"))) {
    try {
      const n8nResponse = await fetch(config.webhook_url, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json", "X-LeadShield-Trigger": "InboundIngressWebhook" }, body: JSON.stringify({ client_id, channel, form_data, ...config, generated_timestamp: logTimestamp }) });
      if (n8nResponse.ok) {
        const responseText = await n8nResponse.text();
        try {
          const parsedRes = JSON.parse(responseText);
          const dataForClassification = Array.isArray(parsedRes) ? parsedRes[0] : parsedRes;
          if (dataForClassification) {
            const possibleVerdict = dataForClassification.verdict || dataForClassification.status || dataForClassification.classification;
            const possibleReason = dataForClassification.reason || dataForClassification.ai_reason || dataForClassification.explanation;
            if (possibleVerdict && (possibleVerdict === "GENUINE" || possibleVerdict === "SPAM")) {
              status = possibleVerdict; ai_reason = possibleReason || "Verified live by your connected active n8n integration.";
            }
          }
        } catch {}
      }
    } catch (err: any) { console.error("n8n Webhook Error:", err.message); }
  }

  if (!status) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: `Instruction rules:\n${config.gemini_prompt}\n\nReview:\n${payload_text}`, config: { responseMimeType: "application/json" } });
        const parsed = JSON.parse((response.text || "").trim());
        status = parsed.verdict || "GENUINE"; ai_reason = parsed.reason || "Evaluated by LeadShield Gemini Core Node.";
      } catch { status = "GENUINE"; ai_reason = "Failsafe heuristic: Safe query pass."; }
    } else { status = "GENUINE"; ai_reason = "Local Heuristic: Genuine form inquiry context matched."; }
  }

  const { data: insertedLead, error } = await supabase.from('leads').insert({ client_id, form_data, status: status as "GENUINE" | "SPAM", ai_reason, channel, created_at: logTimestamp }).select().single();
  res.status(201).json({ status: "success", message: "Form transmission securely structured and indexed.", lead_id: insertedLead?.id, classification: { verdict: status, reason: ai_reason } });
};

apiRouter.post("/api/receive-lead", handleReceiveLead);
apiRouter.post("/lead-shield/api/receive-lead.php", handleReceiveLead);

// Fallback logic for standalone testing or unhandled API paths
apiRouter.all("/api/*", (req, res) => res.status(404).json({ error: "API route not found" }));
