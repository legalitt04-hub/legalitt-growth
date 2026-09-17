import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/card';
import { ShieldCheck, Check, X, Eye, FileText, Clock, Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

const Verification = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  const [stats, setStats] = useState({ pending: 0, under_review: 0, approved: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchVerifications();
  }, [page, statusFilter, debouncedSearch]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      queryParams.append('page', page.toString());
      if (statusFilter) queryParams.append('verificationStatus', statusFilter);
      if (debouncedSearch) queryParams.append('search', debouncedSearch);

      const res = await api.get(`/admin/pending-advocates?${queryParams.toString()}`);
      setVerifications(res.data.data);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.pages);
        setTotalItems(res.data.pagination.total);
      }
      
      if (res.data.counts) {
        setStats({
          pending: res.data.counts.pending || 0,
          under_review: res.data.counts.under_review || 0,
          approved: res.data.counts.approved || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load verifications', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = useCallback(async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id + status);
    try {
      await api.patch(`/admin/pending-advocates/${id}/${status === 'approved' ? 'approve' : 'reject'}`, {
        reason: status === 'rejected' ? 'Rejected during verification review' : undefined,
      });
      setVerifications(prev => prev.filter(v => v._id !== id));
      setStats(prev => ({
        ...prev,
        [statusFilter]: Math.max(0, prev[statusFilter as keyof typeof prev] - 1),
        approved: status === 'approved' ? prev.approved + 1 : prev.approved
      }));
    } catch (err) {
      alert('Failed to update verification status');
    } finally {
      setActionLoading(null);
    }
  }, [statusFilter]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-8 relative"
    >
      {/* Applications List */}
      <Card className="bg-white/50 border-slate-200 backdrop-blur-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 md:p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex-1 max-w-md relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search advocates by name or email..." 
              className="pl-9 h-9 bg-slate-50/50 border-slate-200 text-slate-900 w-full text-sm focus-visible:ring-teal-500"
            />
          </div>
          <div className="flex bg-slate-50/50 rounded-lg p-1 border border-slate-200">
            <button 
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1 sm:flex-none ${statusFilter === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Pending
            </button>
            <button 
              onClick={() => setStatusFilter('under_review')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1 sm:flex-none ${statusFilter === 'under_review' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Reviewing
            </button>
            <button 
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1 sm:flex-none ${statusFilter === 'approved' ? 'bg-green-500/20 text-green-400' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Approved
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : verifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-500">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-base font-medium text-slate-900 mb-1">No {statusFilter.replace('_', ' ')} applications!</h3>
            <p className="text-sm text-center">You're all caught up.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-800/50 flex-1">
              {verifications.map((adv: any) => (
                <div key={adv._id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {adv.user?.avatar ? <img src={adv.user.avatar} className="w-full h-full object-cover" /> : <span className="text-slate-600 font-medium text-sm">{adv.user?.name?.charAt(0) || '?'}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{adv.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 truncate">{adv.user?.email}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${adv.verificationStatus === 'pending' ? 'bg-amber-500/10 text-amber-400' : adv.verificationStatus === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {adv.verificationStatus.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    {adv.documents && Object.keys(adv.documents).length > 0 ? (
                      <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {Object.keys(adv.documents).length} doc(s) uploaded
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No documents</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {statusFilter !== 'approved' && (
                      <>
                        <Button 
                          onClick={() => handleVerify(adv._id, 'approved')} 
                          size="sm" 
                          disabled={actionLoading === adv._id + 'approved'}
                          className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 h-8 text-xs font-medium"
                        >
                          {actionLoading === adv._id + 'approved' ? (
                            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <><Check className="w-3.5 h-3.5 mr-1" /> Approve</>
                          )}
                        </Button>
                        <Button 
                          onClick={() => handleVerify(adv._id, 'rejected')} 
                          variant="outline" size="sm" 
                          disabled={actionLoading === adv._id + 'rejected'}
                          className="flex-1 bg-white border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 text-xs"
                        >
                          {actionLoading === adv._id + 'rejected' ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <><X className="w-3.5 h-3.5 mr-1" /> Reject</>
                          )}
                        </Button>
                      </>
                    )}
                    <Button 
                      onClick={() => setSelectedDocs(adv)} 
                      variant="outline" size="sm" 
                      className={`${statusFilter === 'approved' ? 'flex-1' : 'w-8'} bg-white border-slate-200 text-slate-600 hover:text-slate-900 h-8 p-0 flex-shrink-0 flex items-center justify-center`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {statusFilter === 'approved' && <span className="ml-2 text-xs">View Docs</span>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="p-4 font-medium w-12"></th>
                    <th className="p-4 font-medium">Advocate Name & Email</th>
                    <th className="p-4 font-medium">Phone</th>
                    <th className="p-4 font-medium text-center">Documents</th>
                    <th className="p-4 font-medium text-center">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((adv: any) => (
                    <tr 
                      key={adv._id} 
                      className="border-b border-slate-200/50 hover:bg-slate-50/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {adv.user?.avatar ? <img src={adv.user.avatar} className="w-full h-full object-cover" /> : <span className="text-slate-600 font-medium text-sm">{adv.user?.name?.charAt(0) || '?'}</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium text-slate-900">{adv.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]" title={adv.user?.email}>{adv.user?.email}</p>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {adv.user?.phone || '—'}
                      </td>
                      <td className="p-4 text-center">
                        {adv.documents && Object.keys(adv.documents).length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-teal-400 bg-teal-500/10 px-2 py-1 rounded-full text-xs font-medium">
                            <FileText className="w-3 h-3" /> Uploaded
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${adv.verificationStatus === 'pending' ? 'bg-amber-500/10 text-amber-400' : adv.verificationStatus === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {adv.verificationStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {statusFilter !== 'approved' && (
                            <>
                              <Button 
                                onClick={() => handleVerify(adv._id, 'approved')} 
                                size="sm" 
                                disabled={actionLoading === adv._id + 'approved'}
                                className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-8 text-xs"
                              >
                                {actionLoading === adv._id + 'approved' ? (
                                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <><Check className="w-3.5 h-3.5 mr-1" /> Approve</>
                                )}
                              </Button>
                              <Button 
                                onClick={() => handleVerify(adv._id, 'rejected')} 
                                variant="outline" size="sm" 
                                disabled={actionLoading === adv._id + 'rejected'}
                                className="bg-white border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 text-xs"
                              >
                                {actionLoading === adv._id + 'rejected' ? (
                                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <><X className="w-3.5 h-3.5 mr-1" /> Reject</>
                                )}
                              </Button>
                            </>
                          )}
                          <Button 
                            onClick={() => setSelectedDocs(adv)} 
                            variant="outline" size="sm" 
                            className="bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 h-8 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {!loading && totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between mt-auto">
                <span className="text-xs text-slate-500">
                  Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalItems)} of {totalItems}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                    className="h-8 bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="px-3 text-sm text-slate-900 font-medium">
                    {page} <span className="text-slate-500 font-normal">/ {totalPages}</span>
                  </div>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                    size="sm"
                    className="h-8 bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Document View Modal */}
      <AnimatePresence>
        {selectedDocs && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDocs(null)}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-lg"
            >
              <Card className="w-full bg-white border-slate-200 shadow-2xl relative rounded-t-2xl md:rounded-2xl max-h-[80vh] overflow-y-auto">
                <button onClick={() => setSelectedDocs(null)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 bg-slate-50 rounded-full p-1.5 z-10 active:scale-95 transition-transform">
                  <X className="w-4 h-4" />
                </button>
                <div className="p-5 md:p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Verification Documents</h2>
                  <p className="text-sm text-slate-500 mb-5">Submitted by {selectedDocs.user?.name}</p>
                  
                  <div className="space-y-2.5">
                    {selectedDocs.documents && Object.entries(selectedDocs.documents).map(([key, url]: [string, any], i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-slate-50/50 border border-slate-200 rounded-xl gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-teal-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{key}</p>
                            <p className="text-[11px] text-slate-500 truncate">{url ? 'Document available' : 'No URL'}</p>
                          </div>
                        </div>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 text-xs font-medium whitespace-nowrap bg-teal-500/10 px-3 py-1.5 rounded-lg transition-colors">
                            Open ↗
                          </a>
                        )}
                      </div>
                    ))}
                    {(!selectedDocs.documents || Object.keys(selectedDocs.documents).length === 0) && (
                      <div className="text-center py-8 text-slate-500 text-sm">No documents submitted.</div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <Button onClick={() => setSelectedDocs(null)} className="flex-1 bg-slate-50 text-slate-900 hover:bg-slate-100 h-10">
                      Close
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Verification;
