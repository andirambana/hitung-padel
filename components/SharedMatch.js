"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getAccountSnapshot, getServerAccount, signOutAccount, subscribeAccount, watchAccount } from "@/lib/account";
import { watchSharedSession } from "@/lib/cloud-sessions";
import { isCloudEnabled } from "@/lib/firebase";
import { getLangSnapshot, getServerLang, messages, setLang, subscribeLang } from "@/lib/i18n";
import { SessionBoard } from "@/components/SessionDashboard";

export function SharedMatch({ id }) {
  const router = useRouter();
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLang);
  const account = useSyncExternalStore(subscribeAccount, getAccountSnapshot, getServerAccount);
  const copy = messages[lang];
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => watchAccount(), []);

  useEffect(() => {
    if (!id || !isCloudEnabled()) {
      return undefined;
    }
    return watchSharedSession(id, setSession);
  }, [id]);

  if (!isCloudEnabled()) {
    return (
      <main className="home">
        <p className="empty">{copy.cloudOff}</p>
      </main>
    );
  }

  if (session === undefined) {
    return (
      <main className="home">
        <p className="empty">{copy.loadingMatch}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="home">
        <p className="empty">{copy.missingMatch}</p>
        <button className="button button-primary" type="button" onClick={() => router.push("/")}>
          {copy.home}
        </button>
      </main>
    );
  }

  const canEdit = Boolean(account?.uid && session.ownerId === account.uid);
  return (
    <SessionBoard
      session={session}
      copy={copy}
      lang={lang}
      onLang={setLang}
      onHome={() => router.push("/")}
      onSignOut={account ? () => signOutAccount() : undefined}
      readOnly={!canEdit}
    />
  );
}
