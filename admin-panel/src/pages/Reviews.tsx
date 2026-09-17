import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Star, Trash2 } from 'lucide-react';
import api from '../lib/api';

export default function Reviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const res = await api.get('/admin/reviews');
      if (res.data?.success) {
        setReviews(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load reviews', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDeleteReview = async (id: string) => {
    if (confirm('Are you sure you want to delete this review?')) {
      try {
        await api.delete(`/admin/reviews/${id}`);
        fetchReviews();
      } catch (err) {
        alert('Failed to delete review');
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          Reviews & Ratings Moderation
        </h2>
        <p className="text-slate-500 text-sm mt-1">Audit client consultation reviews, rating breakdown, and moderate reported feedback.</p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">All Customer Reviews</span>
          <span className="text-xs text-slate-500 font-medium">Total: {reviews.length}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No client reviews found.</div>
          ) : (
            reviews.map(rev => (
              <div key={rev._id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Number(rev.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{Number(rev.rating || 0).toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium font-serif italic">{rev.comment ? `“${rev.comment}”` : <span className="text-slate-400">No written feedback</span>}</p>
                  <p className="text-xs text-slate-500">
                    By <strong className="text-slate-700">{rev.client?.name || 'Anonymous Client'}</strong> for Advocate <strong className="text-slate-700">{rev.advocate?.user?.name || 'Advocate'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={() => handleDeleteReview(rev._id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Review
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </motion.div>
  );
}
