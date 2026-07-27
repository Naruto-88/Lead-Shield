import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmailComposerModalProps {
  client: any;
  onClose: () => void;
}

export default function EmailComposerModal({ client, onClose }: EmailComposerModalProps) {
  const [to, setTo] = useState(client.followup_email || client.contact_email || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function prepareEmail() {
      try {
        setIsLoading(true);
        // Fetch CCs
        const { data: ccs } = await supabase.from('client_cc_emails').select('email').eq('client_id', client.client_id);
        if (ccs) {
          setCc(ccs.map(c => c.email).join(', '));
        }

        // Fetch recent leads
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: recentLeads } = await supabase
          .from('leads')
          .select('*')
          .eq('client_id', client.client_id)
          .eq('status', 'GENUINE')
          .gte('created_at', oneWeekAgo.toISOString());

        setSubject(`Your Weekly Lead Summary (${recentLeads?.length || 0} new leads)`);

        let leadsHtml = '';
        if (recentLeads && recentLeads.length > 0) {
          for (const lead of recentLeads) {
            const name = lead.form_data.name || lead.form_data.Name || 'Client';
            
            // Generate a secure token placeholder for preview. Actual cron does this securely.
            // For manual send, we still need real tokens if we want them to click it.
            // Since this is just a quick composer, let's just generate random tokens for manual sends too.
            const token = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
            
            await supabase.from('lead_feedback').insert({
              lead_id: lead.id,
              client_id: client.client_id,
              status: 'pending',
              token: token
            });

            const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            const convertedUrl = `${baseUrl}/feedback?token=${token}&status=converted`;
            const notConvertedUrl = `${baseUrl}/feedback?token=${token}&status=not_converted`;

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
        } else {
          leadsHtml = `<p>No new genuine leads were received in the past 7 days.</p>`;
        }

        const template = `
<div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
  <h2 style="color: #096260;">Weekly Lead Summary</h2>
  <p>Hello ${client.business_name},</p>
  <p>Here are your genuine leads from the past 7 days. Please let us know how they went by clicking the buttons below!</p>
  ${leadsHtml}
  <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">This is an automated message from your Lead Shield portal.</p>
</div>
        `;
        setHtmlContent(template.trim());
      } catch (err: any) {
        setError(err.message || 'Failed to prepare email.');
      } finally {
        setIsLoading(false);
      }
    }

    prepareEmail();
  }, [client]);

  const handleSend = async () => {
    setIsSending(true);
    setError('');

    try {
      const response = await fetch('/api/email/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.client_id,
          to,
          cc,
          subject,
          html_content: htmlContent
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send email.');

      alert('Email sent successfully!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-transparent glass-card premium-border-glow rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-[#096260]/15 flex flex-col max-h-[90vh]">
        <div className="bg-[#082b36] p-5 border-b border-[#03212a] flex justify-between items-center text-white">
          <div>
            <h3 className="font-extrabold text-lg leading-none">Send Follow-up Email</h3>
            <p className="text-[10px] text-[#5fb4a9] font-bold mt-2 uppercase tracking-wider font-mono">
              Composing to: {client.business_name}
            </p>
          </div>
          <button onClick={onClose} className="text-[#5fb4a9] hover:text-white font-extrabold text-xs bg-transparent glass-card premium-border-glow/10 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#5fb4a9] space-y-4">
              <Loader2 className="animate-spin" size={40} />
              <p className="text-sm font-bold uppercase tracking-widest font-mono">Generating Weekly Summary Payload...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">To</label>
                  <input
                    type="text"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="w-full bg-black/20 border border-[#096260]/10 focus:border-[#096260] rounded-xl py-2 px-3 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">CC</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={e => setCc(e.target.value)}
                    className="w-full bg-black/20 border border-[#096260]/10 focus:border-[#096260] rounded-xl py-2 px-3 text-xs outline-none"
                    placeholder="Comma separated emails"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-black/20 border border-[#096260]/10 focus:border-[#096260] rounded-xl py-2 px-3 text-xs outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">HTML Content (Raw)</label>
                <textarea
                  value={htmlContent}
                  onChange={e => setHtmlContent(e.target.value)}
                  rows={15}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#096260] rounded-xl py-3 px-3 text-xs outline-none font-mono"
                />
              </div>
            </>
          )}
        </div>

        <div className="bg-white/5 p-5 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || isLoading}
            className="bg-[#096260] hover:bg-[#5fb4a9] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSending ? 'Sending...' : <><Send size={14} /> Send Manual Email</>}
          </button>
        </div>
      </div>
    </div>
  );
}
