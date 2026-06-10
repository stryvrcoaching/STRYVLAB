'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RunIPTPage() {
  const router = useRouter();

  useEffect(() => {
    const unlocked = localStorage.getItem('stryv_analysis_unlocked');
    if (!unlocked) {
      router.replace('/ipt/pre-analyse?mode=ipt');
    }
  }, [router]);

  return (
    <>
      {/* ICI tu mets ton moteur IPT réel, inchangé */}
    </>
  );
}
