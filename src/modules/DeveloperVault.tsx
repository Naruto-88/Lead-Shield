import React from 'react';
import GlassCard from '../components/ui/GlassCard';
import { Database, Code, Copy, Check } from 'lucide-react';

interface DeveloperVaultProps {
  appFiles: { [key: string]: { path: string; desc: string; lang: string; content: string } };
}

const DeveloperVault: React.FC<DeveloperVaultProps> = ({ appFiles }) => {
  const [copiedFile, setCopiedFile] = React.useState<string | null>(null);

  const handleCopy = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
          <Database className="text-cyan-400 w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Virtual Vault & PHP Developer Suite</h2>
          <p className="text-xs text-gray-400">Code editors and integration snippets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {Object.entries(appFiles || {}).map(([filename, file]) => (
          <GlassCard key={filename} className="!p-0 overflow-hidden">
            <div className="bg-white/5 border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Code className="text-cyan-400 w-4 h-4" />
                <span className="font-mono text-sm font-bold text-white">{filename}</span>
                <span className="text-[10px] text-gray-500 font-mono hidden sm:inline-block">({file.path})</span>
              </div>
              <button 
                onClick={() => handleCopy(filename, file.content)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[10px] uppercase tracking-widest font-bold text-gray-300 hover:text-white"
              >
                {copiedFile === filename ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copiedFile === filename ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="p-4 bg-black/40">
              <p className="text-xs text-gray-400 mb-4">{file.desc}</p>
              <pre className="font-mono text-[10px] sm:text-xs text-gray-300 overflow-x-auto p-4 bg-black/60 rounded-xl border border-white/5 max-h-[400px] overflow-y-auto">
                <code>{file.content}</code>
              </pre>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default DeveloperVault;
