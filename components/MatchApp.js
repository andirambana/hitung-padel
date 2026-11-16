"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { fill, getLangSnapshot, getServerLang, messages, setLang, subscribeLang } from "@/lib/i18n";
import { getAccountSnapshot, getAuthReadySnapshot, getServerAccount, getServerAuthReady, signInWithGoogle, signOutAccount, subscribeAccount, watchAccount } from "@/lib/account";
import { clearCloud, getCloudSnapshot, getServerCloud, publishLocalSessions, subscribeCloud, watchCloud } from "@/lib/cloud-sessions";
import { isCloudEnabled, isDeveloper } from "@/lib/firebase";
import { getServerSessions, getSessionsSnapshot, removeSession, subscribeSessions } from "@/lib/session-store";
import { CreateGame, SessionBoard } from "@/components/SessionDashboard";

function formatWhen(value, lang) {
  if (!value) {
    return "";
  }
  const when = new Date(value);
  const locale = lang === "id" ? "id-ID" : "en-US";
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(when);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(when);
  return `${date} · ${time}`;
}

function LanguageSwitch({ lang, label, onChange }) {
  return (
    <div className="lang-switch" role="group" aria-label={label}>
      <button type="button" className={lang === "id" ? "is-on" : ""} aria-pressed={lang === "id"} onClick={() => onChange("id")}>
        ID
      </button>
      <button type="button" className={lang === "en" ? "is-on" : ""} aria-pressed={lang === "en"} onClick={() => onChange("en")}>
        EN
      </button>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function MatchApp() {
  const localSessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot, getServerSessions);
  const cloud = useSyncExternalStore(subscribeCloud, getCloudSnapshot, getServerCloud);
  const account = useSyncExternalStore(subscribeAccount, getAccountSnapshot, getServerAccount);
  const authReady = useSyncExternalStore(subscribeAccount, getAuthReadySnapshot, getServerAuthReady);
  const [panel, setPanel] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLang);
  const copy = messages[lang];
  const developer = isDeveloper();
  const cloudEnabled = isCloudEnabled();
  const usingCloud = Boolean(account && cloudEnabled);
  const sessions = usingCloud ? mergeSessions(cloud.sessions, localSessions) : localSessions;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => watchAccount(), []);

  useEffect(() => {
    if (!accountError) {
      return undefined;
    }
    const timer = window.setTimeout(() => setAccountError(""), 2800);
    return () => window.clearTimeout(timer);
  }, [accountError]);

  useEffect(() => {
    if (!account?.uid || !cloudEnabled) {
      clearCloud();
      return undefined;
    }
    const stop = watchCloud(account.uid);
    publishLocalSessions(account.uid);
    return () => stop();
  }, [account?.uid, cloudEnabled]);

  const openSession = sessions.find((item) => item.id === panel);
  const mustSignIn = cloudEnabled && authReady && !account && !developer;

  useEffect(() => {
    if (mustSignIn) {
      setPanel(null);
    }
  }, [mustSignIn]);

  async function onSignIn() {
    setAccountError("");
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAccountError(error?.code === "auth/popup-blocked" ? copy.popupBlocked : copy.signInFailed);
    } finally {
      setSigningIn(false);
    }
  }

  const gate = developer ? null : cloudEnabled && !authReady ? "loading" : mustSignIn ? "sign-in" : null;

  if (!gate && panel === "create") {
    return <CreateGame copy={copy} lang={lang} onLang={setLang} onBack={(id) => setPanel(id)} />;
  }

  if (!gate && openSession) {
    return <SessionBoard session={openSession} copy={copy} lang={lang} onLang={setLang} onHome={() => setPanel(null)} onSignOut={account ? () => signOutAccount() : undefined} />;
  }

  return (
    <HomeScreen
      copy={copy}
      lang={lang}
      onLang={setLang}
      developer={developer && !account}
      sessions={sessions}
      account={account}
      cloudEnabled={cloudEnabled}
      loading={usingCloud && !cloud.ready && localSessions.length === 0}
      accountError={accountError}
      signingIn={signingIn}
      gate={gate}
      onSignIn={onSignIn}
      onSignOut={() => signOutAccount()}
      onCreate={() => setPanel("create")}
      onOpen={(id) => setPanel(id)}
      onDeleteSession={removeSession}
    />
  );
}

function mergeSessions(cloudSessions, localSessions) {
  const byId = new Map();
  for (const item of localSessions) {
    byId.set(item.id, item);
  }
  for (const item of cloudSessions) {
    const local = byId.get(item.id);
    const cloudStamp = String(item.updatedAt || item.createdAt || "");
    const localStamp = String(local?.updatedAt || local?.createdAt || "");
    if (!local || cloudStamp >= localStamp) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function initial(name) {
  const letter = String(name || "?").trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

function GuideChevron({ open }) {
  return (
    <svg className={open ? "guide-chevron is-open" : "guide-chevron"} viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M6.5 9.5L12 15l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function guideLines(detail) {
  if (Array.isArray(detail)) {
    return detail;
  }
  return detail ? [detail] : [];
}

function Guide({ copy }) {
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState("");
  const [item, setItem] = useState("");
  const groups = [
    { id: "type", title: copy.gameType, items: copy.gameTypes },
    { id: "score", title: copy.scoringSystem, items: copy.scoringOptions },
    { id: "players", title: copy.playerSystem, items: copy.playerGuide },
  ];

  return (
    <section className="guide" aria-label={copy.guideLabel}>
      <div className={open ? "guide-card is-open" : "guide-card"}>
        <button
          type="button"
          className="guide-toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
            setSection("");
            setItem("");
          }}
        >
          <span>{copy.guideLabel}</span>
          <GuideChevron open={open} />
        </button>
        {open ? (
          <>
            <div className="guide-rules">
              <div className="guide-rules-head">
                <img src="/mark.png" alt="" />
                <div>
                  <strong>{copy.padelRulesTitle}</strong>
                  <p>{copy.padelRulesLead}</p>
                </div>
              </div>
              <ol>
                {copy.padelRules.map((rule, index) => (
                  <li key={rule.title}>
                    <b>{index + 1}</b>
                    <span>
                      <strong>{rule.title}</strong>
                      {rule.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="guide-sections">
              {groups.map((group) => {
                const sectionOpen = section === group.id;
                return (
                  <div key={group.id} className={sectionOpen ? "guide-block is-open" : "guide-block"}>
                    <button
                      type="button"
                      aria-expanded={sectionOpen}
                      onClick={() => {
                        setSection(sectionOpen ? "" : group.id);
                        setItem("");
                      }}
                    >
                      <span>{group.title}</span>
                      <GuideChevron open={sectionOpen} />
                    </button>
                    {sectionOpen ? (
                      <div className="guide-items">
                        {group.items.map((entry) => {
                          const key = `${group.id}:${entry.id || entry.title}`;
                          const itemOpen = item === key;
                          return (
                            <div key={key} className="guide-item">
                              <button type="button" aria-expanded={itemOpen} onClick={() => setItem(itemOpen ? "" : key)}>
                                <span>{entry.title}</span>
                                <GuideChevron open={itemOpen} />
                              </button>
                              {itemOpen ? (
                                <ul>
                                  {guideLines(entry.detail).map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function HomeScreen({ copy, lang, onLang, developer, sessions, account, cloudEnabled, loading, accountError, signingIn, gate, onSignIn, onSignOut, onCreate, onOpen, onDeleteSession }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const locked = gate === "sign-in";

  return (
    <main className="home">
      <header className={account && cloudEnabled && !gate ? "home-hero is-dash" : "home-hero"}>
        <div className="home-bar">
          <button className="icon-button" type="button" aria-label={copy.menu} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </button>
          <h1 className="logo">
            <img src="/mark.png" alt="" />
            <span>
              HitungSkor<span>Padel</span>
            </span>
          </h1>
        </div>
        {locked || (!gate && !account) ? (
          <div className="lede">
            <p className="lede-title">{copy.ledeTitle}</p>
            <p>{copy.lede}</p>
          </div>
        ) : null}
      </header>

      {gate === "loading" ? <p className="empty">{copy.checkingAccount}</p> : null}

      {account && cloudEnabled ? (
        <section className="dash-panel">
          <div className="account-card">
            <span className="avatar" aria-hidden="true">
              {initial(account.name)}
            </span>
            <div>
              <strong>{account.name}</strong>
              <p>{account.email || copy.accountHistory}</p>
            </div>
            <button className="button button-ghost sign-out" type="button" onClick={onSignOut}>
              {copy.signOut}
            </button>
          </div>
          <button className="button button-primary" type="button" onClick={onCreate}>
            {copy.createGame}
          </button>
        </section>
      ) : null}

      {gate !== "loading" ? (
      <>
      {account && cloudEnabled ? null : (
      <div className="home-actions">
        <button className="button button-primary google-signin" type="button" disabled={locked && signingIn} onClick={locked ? onSignIn : onCreate}>
          {locked ? <GoogleMark /> : null}
          {locked && signingIn ? copy.signingIn : copy.createGame}
        </button>
      </div>
      )}

      <section className="history" aria-labelledby="games-title">
        <div className="history-head">
          <h2 id="games-title">{copy.savedGames}</h2>
          {locked ? null : <span>{sessions.length}</span>}
        </div>
        {locked ? (
          <p className="empty">{copy.needSignIn}</p>
        ) : loading ? (
          <p className="empty">{copy.loadingMatch}</p>
        ) : sessions.length === 0 ? (
          <p className="empty">{copy.noGames}</p>
        ) : (
          <ul>
            {sessions.map((item) => {
              const label = item.name || copy.untitledGame;
              const typeTitle = copy.gameTypes.find((option) => option.id === (item.system || "match"))?.title;
              const scoreTitle = copy.scoringOptions.find((option) => option.id === item.scoring)?.title;
              const ended = item.status === "finished";
              const when = formatWhen(item.createdAt, lang);
              const meta = [typeTitle, scoreTitle, item.format === "singles" ? copy.singles : copy.doubles, fill(copy.roundCount, { n: (item.rounds || []).length })].filter(Boolean).join(" · ");
              return (
                <li key={item.id} className={ended ? "game-card is-done" : "game-card"}>
                  <button type="button" className="game-open" onClick={() => onOpen(item.id)}>
                    <span className="game-top">
                      <strong>{label}</strong>
                      <span className={ended ? "status-chip is-done" : "status-chip"}>{ended ? copy.matchEnded : copy.inPlay}</span>
                    </span>
                    <span className="game-meta">{meta}</span>
                  </button>
                  <div className="game-foot">
                    <time dateTime={item.createdAt} suppressHydrationWarning>
                      {when}
                    </time>
                    {ended ? (
                      <button type="button" className="game-delete" onClick={() => onDeleteSession(item.id)} aria-label={fill(copy.deleteGame, { name: label })}>
                        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
                          <path d="M9.2 4.8h5.6M4.8 7.2h14.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          <path d="M7.2 7.2l.7 11.1a1.6 1.6 0 0 0 1.6 1.5h5a1.6 1.6 0 0 0 1.6-1.5l.7-11.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.2 10.4v5.6M13.8 10.4v5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Guide copy={copy} />
      </>
      ) : null}

      {accountError ? (
        <p className="toast" role="status" aria-live="polite">
          {accountError}
        </p>
      ) : null}

      <footer className="site-footer">
        <div className="site-footer-brand">
          <img src="/mark.png" alt="" />
          <strong>
            HitungSkor<span>Padel</span>
          </strong>
        </div>
        <p>
          {copy.footerTag}
          <span className="site-footer-meta">© 2026</span>
        </p>
      </footer>
      {menuOpen ? (
        <div
          className="drawer-wrap"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setMenuOpen(false);
            }
          }}
        >
          <div className="drawer" role="dialog" aria-modal="true" aria-label={copy.menu}>
            <div className="section-head">
              <h2>{copy.menu}</h2>
              <button className="text-button" type="button" onClick={() => setMenuOpen(false)}>
                {copy.close}
              </button>
            </div>
            <p className="muted-dark">{copy.settings}</p>
            <div className="drawer-lang side-lang">
              <span>{copy.langLabel}</span>
              <LanguageSwitch lang={lang} label={copy.langLabel} onChange={onLang} />
            </div>
            {account ? (
              <div className="settings-account">
                <span className="avatar" aria-hidden="true">
                  {initial(account.name)}
                </span>
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.email || copy.accountHistory}</p>
                </div>
                <button className="button button-ghost sign-out" type="button" onClick={onSignOut}>
                  {copy.signOut}
                </button>
              </div>
            ) : null}
            {developer ? <p className="settings-note">{copy.developerMode}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
