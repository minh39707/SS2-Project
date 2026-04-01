import { useEffect, useState } from 'react';

import { getCurrentUser } from '@/src/services/user.service';

export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void getCurrentUser().then((result) => {
      if (mounted) {
        setUser(result);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}

