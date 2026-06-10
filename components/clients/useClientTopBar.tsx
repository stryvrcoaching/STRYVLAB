"use client";

import { useMemo, ReactNode } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientTopBarLeft from "@/components/clients/ClientTopBarLeft";

export function useClientTopBar(pageLabel: string, rightContent?: ReactNode) {
  const { client } = useClient();

  const left = useMemo(
    () => <ClientTopBarLeft pageLabel={pageLabel} client={client} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageLabel, client]
  );

  // rightContent is passed directly — useSetTopBar stores it in a ref,
  // so no ReactNode-as-dep instability here.
  useSetTopBar(left, rightContent);
}
