import { useEffect, useState } from 'react';
import { Text } from 'react-native';

// Steht stellvertretend fuer z. B. PendingAuthBanner: pollt periodisch mit
// einem echten setInterval, solange die Komponente gemountet ist.
export function PollingBanner({ intervalMs = 3000 }: { intervalMs?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return <Text>{count}</Text>;
}
