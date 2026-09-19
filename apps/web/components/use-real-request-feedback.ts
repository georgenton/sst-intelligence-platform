'use client';

import { useEffect, useState } from 'react';

// Only presentation is delayed. The request and success transition never wait.
export function useRealRequestFeedback(pending: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setVisible(true), 250);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [pending]);
  return pending && visible;
}
