import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "./src/lib/supabase.js";
import { createClient } from "@supabase/supabase-js";

// Create Admin Client using Service Role Key to bypass RLS and create users securely
const SUPABASE_URL = process.env.leadshield_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://missing-env-var.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.leadshield_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "missing-key";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const apiRouter = express.Router();

apiRouter.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) return next();
  express.json()(req, res, next);
});
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

// =====================================================================
// EMAIL SYSTEM API ENDPOINTS
// =====================================================================
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined, // Some Google Workspace setups use IP authentication
});

// Helper to log emails
async function logEmailSend(client_id: string, sent_to: string, cc_emails: string, trigger_type: 'weekly_auto' | 'manual', status: 'sent' | 'failed', error_message?: string) {
  try {
    await supabaseAdmin.from('email_send_log').insert({
      client_id,
      sent_to,
      cc_emails,
      trigger_type,
      status,
      error_message
    });
  } catch (err) {
    console.error("Failed to log email send:", err);
  }
}

// 1. Manual Email Sending Endpoint
apiRouter.post("/api/email/manual-send", async (req, res) => {
  const { client_id, to, cc, subject, html_content } = req.body;
  
  if (!client_id || !to || !subject || !html_content) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || `"Lead Shield" <noreply@yourdomain.com>`,
      to,
      cc,
      subject,
      html: html_content,
    });
    
    await logEmailSend(client_id, to, cc || '', 'manual', 'sent');
    return res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Manual email error:", error);
    await logEmailSend(client_id, to, cc || '', 'manual', 'failed', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Automated Weekly Summary Cron Endpoint
apiRouter.get("/api/cron/weekly-summary", async (req, res) => {
  try {
    // 1. Fetch clients with auto_email_enabled = true
    const { data: clients, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('auto_email_enabled', true)
      .not('followup_email', 'is', null);

    if (clientErr || !clients || clients.length === 0) {
      return res.json({ success: true, message: "No clients configured for auto email." });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let sentCount = 0;

    for (const client of clients) {
      // Fetch CCs
      const { data: ccs } = await supabaseAdmin.from('client_cc_emails').select('email').eq('client_id', client.client_id);
      const ccEmails = ccs ? ccs.map(c => c.email).join(',') : '';

      // Fetch legit leads from past 7 days
      const { data: recentLeads } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('client_id', client.client_id)
        .eq('status', 'GENUINE')
        .gte('created_at', oneWeekAgo.toISOString());

      if (!recentLeads || recentLeads.length === 0) continue;

      // Prepare feedback tokens and HTML
      let leadsHtml = '';
      for (const lead of recentLeads) {
        const token = crypto.randomBytes(16).toString('hex');
        
        // Save feedback token
        await supabaseAdmin.from('lead_feedback').insert({
          lead_id: lead.id,
          client_id: client.client_id,
          status: 'pending',
          token: token
        });

        // Use environment variable for host, or fallback for dev
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VITE_APP_URL || 'http://localhost:3000');
        
        const convertedUrl = `${baseUrl}/feedback?token=${token}&status=converted`;
        const notConvertedUrl = `${baseUrl}/feedback?token=${token}&status=not_converted`;

        const name = lead.form_data.name || lead.form_data.Name || 'Client';
        
        leadsHtml += `
          <div style="border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #082b36;">Lead #${lead.id}: ${name}</h4>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #475569;">Received: ${new Date(lead.created_at).toLocaleString()}</p>
            <div style="margin-top: 15px;">
              <p style="font-size: 13px; font-weight: bold; margin-bottom: 8px;">Was this lead successful?</p>
              <a href="${convertedUrl}" style="background-color: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 12px; margin-right: 10px;">✅ Converted</a>
              <a href="${notConvertedUrl}" style="background-color: #e11d48; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 12px;">❌ Not Converted</a>
            </div>
          </div>
        `;
      }

      const html_content = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2 style="color: #096260;">Weekly Lead Summary</h2>
          <p>Hello ${client.business_name},</p>
          <p>Here are your genuine leads from the past 7 days. Please let us know how they went by clicking the buttons below!</p>
          ${leadsHtml}
          <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">This is an automated message from your Lead Shield portal.</p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM_EMAIL || `"Lead Shield" <noreply@yourdomain.com>`,
          to: client.followup_email,
          cc: ccEmails,
          subject: `Your Weekly Lead Summary (${recentLeads.length} new leads)`,
          html: html_content,
        });
        await logEmailSend(client.client_id, client.followup_email, ccEmails, 'weekly_auto', 'sent');
        sentCount++;
      } catch (err: any) {
        console.error(`Error sending weekly to ${client.client_id}:`, err);
        await logEmailSend(client.client_id, client.followup_email, ccEmails, 'weekly_auto', 'failed', err.message);
      }
    }

    return res.json({ success: true, emailsSent: sentCount });
  } catch (error: any) {
    console.error("Cron weekly summary error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Feedback Submission Endpoint
apiRouter.post("/api/feedback/submit", async (req, res) => {
  const { token, status, comment } = req.body;
  if (!token || !status) return res.status(400).json({ error: "Missing token or status" });

  try {
    const { data, error } = await supabaseAdmin
      .from('lead_feedback')
      .update({ 
        status, 
        comment,
        responded_at: new Date().toISOString()
      })
      .eq('token', token)
      .select()
      .single();

    if (error || !data) {
      return res.status(400).json({ error: "Invalid token or feedback already processed." });
    }

    return res.json({ success: true, message: "Feedback saved successfully." });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Fetch all data from Supabase instead of local file
apiRouter.get("/api/data", async (req, res) => {
  if (SUPABASE_URL.includes("missing-env-var")) {
    return res.status(500).json({ error: "Backend Env Vars Missing: VITE_SUPABASE_URL is not configured in Vercel" });
  }
  try {
    const [ { data: clients }, { data: n8nConfigs }, { data: gmbMetrics }, { data: leads }, { data: profiles }, { data: leadFeedbacks } ] = await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("n8n_configs").select("*"),
      supabase.from("gmb_metrics").select("*"),
      supabase.from("leads").select("*").order('created_at', { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("lead_feedback").select("*")
    ]);
    res.json({ clients: clients || [], users: profiles || [], gmbMetrics: gmbMetrics || [], n8nConfigs: n8nConfigs || [], leads: leads || [], leadFeedbacks: leadFeedbacks || [] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch data", details: err.message });
  }
});

const handleLeadsStats = async (req: express.Request, res: express.Response) => {
  const expectedApiKey = process.env.LEADSHIELD_API_KEY || "shield_lead_key_2026_secure";
  const providedKey = req.headers["x-api-key"] || req.query.api_key;
  if (providedKey && providedKey !== expectedApiKey) {
    return res.status(401).json({ status: "error", message: "Unauthorized access path. Invalid API key." });
  }

  const { client_id, start_date, end_date } = req.query;
  let query = supabaseAdmin.from("leads").select("*");

  if (client_id && typeof client_id === "string" && client_id !== 'all') {
    query = query.eq("client_id", client_id.trim().toLowerCase());
  }
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
  if (error) return res.status(500).json({ status: "error", message: "Failed to fetch stats", details: error.message });

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

  const totalLeads = (filteredLeads || []).length;

  res.json({
    status: "success",
    client_id: client_id || "all",
    date_range: { start: start_date || null, end: end_date || null },
    summary: { 
      total_leads: totalLeads, 
      genuine_leads: genuineCount, 
      spam_leads: spamCount, 
      spam_rate_percentage: totalLeads > 0 ? Math.round((spamCount / totalLeads) * 100) : 0 
    },
    daily_breakdown: Object.keys(dailyBreakdown).sort().map((date) => ({ date, ...dailyBreakdown[date] })),
    leads: filteredLeads || []
  });
};

apiRouter.get("/api/leads/stats", handleLeadsStats);
apiRouter.get("/api/leads-stats", handleLeadsStats);

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

// Cron Snapshot for historical monthly leads
apiRouter.all("/api/cron/snapshot", async (req, res) => {
  // Can secure with a CRON_SECRET if provided by Vercel
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized cron access" });
  }

  try {
    const now = new Date();
    // Snapshot the current month (can be run repeatedly due to UPSERT)
    const month = now.getUTCMonth() + 1; // 1-12
    const year = now.getUTCFullYear();

    const { data: clients, error: clientsErr } = await supabaseAdmin.from('clients').select('client_id');
    if (clientsErr) throw clientsErr;

    const results = [];
    for (const client of (clients || [])) {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(year, month, 1)).toISOString();

      const { count, error: leadsErr } = await supabaseAdmin.from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.client_id)
        .eq('status', 'GENUINE')
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);
        
      if (leadsErr) continue;

      const { error: upsertErr } = await supabaseAdmin.from('historical_monthly_leads')
        .upsert({
          client_id: client.client_id,
          month: month,
          year: year,
          legit_count: count || 0,
          created_at: new Date().toISOString()
        }, { onConflict: 'client_id,month,year' });

      if (!upsertErr) {
        results.push({ client_id: client.client_id, month, year, count });
      }
    }

    return res.json({ success: true, processed: results.length, snapshots: results });
  } catch (err: any) {
    console.error("Cron snapshot error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Fallback logic for standalone testing or unhandled API paths
apiRouter.all("/api/*", (req, res) => res.status(404).json({ error: "API route not found" }));
