import { useEffect, useState } from 'react';

export function useDeferredMount(isOpen: boolean, delay = 300): boolean {
  const [mounted, setMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), delay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, delay]);

  return mounted;
}
