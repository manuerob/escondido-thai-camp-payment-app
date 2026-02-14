import { useEffect, useState } from 'react';
import { databaseService } from '@/services';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initializeDatabase() {
      try {
        await databaseService.init();
        setIsReady(true);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to initialize database:', err);
      }
    }

    initializeDatabase();
  }, []);

  return { isReady, error };
}
