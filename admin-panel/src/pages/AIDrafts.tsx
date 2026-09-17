import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Bot, Search, CheckCircle, XCircle, Eye, FileText, AlertTriangle, Sparkles, Download, Copy } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/button';
import api from '../lib/api';

const timeAgo = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

export default function AIDrafts() {
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Computed real stats from API data
  const today = new Date().toDateString();
  const todayDrafts = drafts.filter(d => new Date(d.createdAt).toDateString() === today).length;
  const pendingDrafts = drafts.filter(d => d.status === 'pending' || !d.status).length;

  React.useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await api.get('/admin/ai-drafts');
        if (res.data.success) {
          setDrafts(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching drafts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDrafts();
  }, []);

  const filteredDrafts = drafts.filter(d => 
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d._id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-500" />
            AI Draft Center
          </h2>
          <p className="text-slate-500 text-sm mt-1">Review, approve, and manage AI-generated legal documents.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 text-indigo-700 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Persisted Drafts
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 bg-white border-slate-200">
          <p className="text-sm font-medium text-slate-500">Drafts Generated Today</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{todayDrafts}</p>
        </Card>
        <Card className="p-5 bg-white border-slate-200">
          <p className="text-sm font-medium text-slate-500">Pending Review</p>
          <p className="text-3xl font-black text-amber-500 mt-2">{pendingDrafts}</p>
        </Card>
        <Card className="p-5 bg-white border-slate-200">
          <p className="text-sm font-medium text-slate-500">Total AI Drafts</p>
          <p className="text-3xl font-black text-emerald-500 mt-2">{drafts.length}</p>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search drafts by ID, type, or client..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-4">Draft ID</th>
                <th className="p-4">Document Type</th>
                <th className="p-4">Client</th>
                <th className="p-4">Source</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDrafts.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No AI drafts found.</td></tr>
              ) : (
                filteredDrafts.map(draft => (
                  <tr key={draft._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer">{draft._id.substring(0, 12)}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{timeAgo(draft.createdAt)}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{draft.title || 'Untitled Draft'}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-700">{draft.user?.name || 'Unknown User'}</td>
                    <td className="p-4 text-sm text-slate-600 capitalize">{String(draft.source || 'fir').replace(/_/g, ' ')}</td>
                    <td className="p-4">
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-medium capitalize">{draft.status || 'draft'}</Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setSelectedDraft(draft); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg shadow-sm transition-colors" title="Review Draft">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Draft & Advice Inspector Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="AI Draft & Legal Advice Workspace">
        {selectedDraft && (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{selectedDraft.title || 'Legal FIR & Notice Draft'}</h4>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedDraft._id}</p>
                </div>
                <Badge className="bg-indigo-600 text-white font-bold">
                  {String(selectedDraft.source || 'fir').replace(/_/g, ' ')}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs mt-3">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase">Client</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedDraft.user?.name || 'Client User'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase">Generated Date</span>
                  <span className="font-bold text-slate-800 text-sm">{new Date(selectedDraft.createdAt || Date.now()).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* AI Legal Strategy & Section Breakdown */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Legal Strategy & Grounds
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedDraft.summary || 'No separate strategy summary was stored for this draft.'}
              </p>
            </div>

            {/* Draft Content Preview */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                <span>GENERATED LEGAL DRAFT CONTENT</span>
                <Button size="sm" variant="outline" disabled={!selectedDraft.content} onClick={() => navigator.clipboard.writeText(selectedDraft.content)} className="h-7 text-xs bg-white">
                  <Copy className="w-3 h-3 mr-1" /> Copy Draft
                </Button>
              </div>
              <textarea
                readOnly
                rows={8}
                value={selectedDraft.content || ''}
                className="w-full p-3 font-mono text-xs text-slate-800 bg-white outline-none resize-none"
              />
            </div>

            <div className="pt-3 flex justify-between items-center border-t border-slate-100">
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Stored in Legalitt
              </span>
              <Button onClick={() => setIsModalOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Close Workspace
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
