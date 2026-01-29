"use client";

import { useEffect, useState } from "react";
import {
  getInboxActivity,
  startInboxActivityEngine,
  subscribeInboxActivity,
  type InboxActivity,
} from "@/src/lib/inboxActivity";

export function useInboxActivity(): InboxActivity {
  const [a, setA] = useState<InboxActivity>(() => getInboxActivity());

  useEffect(() => {
    startInboxActivityEngine();
    return subscribeInboxActivity((next) => setA(next));
  }, []);

  return a;
}
