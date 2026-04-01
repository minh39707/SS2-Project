import { useEffect, useState } from 'react';

import { getDashboardData } from '@/src/services/habit.service';

export function useHabit() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void getDashboardData().then((result) => {
      if (mounted) {
        setDashboard(result);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { dashboard, loading };
}

