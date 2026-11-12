import React, { useState } from 'react';
import { X, Copy, Check, Link, Globe, Send, Sparkles, Building, ShieldCheck } from 'lucide-react';

interface ClientShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingClients: string[];
  currentClient?: string | null;
  onSwitchToClientMode?: (clientName: string) => void;
}

export const ClientShareModal: React.FC<ClientShareModalProps> = ({
  isOpen,
  onClose,
  existingClients,
  currentClient,
  onSwitchToClientMode,
}) => {
  const [selectedClient, setSelectedClient] = useState(currentClient || existingClients[0] || 'Acme Studio Co.');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://swoooshz.app';
  const shareLink = `${origin}/?client=${encodeURIComponent(selectedClient)}&portal=upload`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-pink-100 flex flex-col">
        
        {/* Header with Dark Pink Accent */}
        <div className="bg-[#831843] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-600/60 flex items-center justify-center">
              <Globe className="w-5 h-5 text-pink-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Client Portal Link
              </h3>
              <p className="text-xs text-pink-200/80">
                Let your client securely upload project files directly to you.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-pink-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-white">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Select or Type Client Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                placeholder="e.g. Acme Studio, Bloom Agency"
                className="flex-1 px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#831843]/30 focus:border-[#831843]"
              />
            </div>
            {existingClients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] text-gray-400 self-center">Existing:</span>
                {existingClients.map((client) => (
                  <button
                    key={client}
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      selectedClient === client
                        ? 'bg-[#831843] text-white border-[#831843]'
                        : 'bg-pink-50/50 hover:bg-pink-100 text-pink-800 border-pink-200/60'
                    }`}
                  >
                    {client}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generated Link Box */}
          <div className="p-3.5 bg-pink-50/50 rounded-xl border border-pink-200/80">
            <span className="text-[11px] font-semibold text-gray-600 block mb-1">
              Private Client Upload Link:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 text-xs bg-white border border-pink-200 rounded-lg px-3 py-2 text-gray-600 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3.5 py-2 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2 text-gray-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Only files uploaded for this client will be linked to your portal.</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Sparkles className="w-4 h-4 text-[#831843] shrink-0" />
              <span>Clients receive a clean, friendly drag-and-drop page without complex setup.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-pink-50/40 border-t border-pink-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
