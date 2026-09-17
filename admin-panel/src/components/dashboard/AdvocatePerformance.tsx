import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Star, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

export const AdvocatePerformance = () => {
  const [advocates, setAdvocates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopAdvocates = async () => {
      try {
        const res = await api.get('/admin/advocates?limit=4');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setAdvocates(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load advocate performance', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopAdvocates();
  }, []);

  return (
    <Card className="p-5 border border-slate-200 bg-white h-[350px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Top Advocates</h3>
        <a href="/advocates" className="text-sm text-teal-600 font-medium hover:text-teal-700">View Directory</a>
      </div>
      
      <div className="space-y-4 overflow-y-auto hidden-scrollbar flex-1">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Loading advocates...</p>
        ) : advocates.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No advocates registered</p>
        ) : (
          advocates.map((adv) => (
            <div key={adv._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  {adv.user?.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{adv.user?.name || 'Advocate'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center text-amber-500 text-xs font-medium">
                      <Star className="w-3 h-3 fill-amber-500 mr-1" />
                      {adv.rating?.count > 0 ? Number(adv.rating.average || 0).toFixed(1) : 'No rating'}
                    </div>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-slate-500 text-xs">{adv.experience || 0} Yrs Exp</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">₹{adv.consultationFee || 0}</p>
                <p className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1 mt-0.5">
                  <TrendingUp className="w-3 h-3" />
                  Approved
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
