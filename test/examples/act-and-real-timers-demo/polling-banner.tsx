import { useEffect, useState } from 'react';
import { Text } from 'react-native';

// Simuliert periodisches Polling mit echten Timern.
export function PollingBanner({ intervalMs = 3000 }: { intervalMs?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return <Text>{count}</Text>;
}
