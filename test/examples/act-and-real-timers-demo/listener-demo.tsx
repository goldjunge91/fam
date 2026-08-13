import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { onStatusChange } from './listener-service';

export function ListenerDemo() {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const unsubscribe = onStatusChange((newStatus) => setStatus(newStatus));
    return unsubscribe;
  }, []);

  return <Text>{status}</Text>;
}
