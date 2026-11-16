import { Suspense } from "react";
import { SharedMatch } from "@/components/SharedMatch";
import { messages } from "@/lib/i18n";

function MatchFallback() {
  return (
    <main className="home">
      <p className="empty">{messages.id.loadingMatch}</p>
    </main>
  );
}

async function LoadedMatch({ params }) {
  const { id: rawId } = await params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return <SharedMatch id={id} />;
}

export default function SharedMatchPage({ params }) {
  return (
    <Suspense fallback={<MatchFallback />}>
      <LoadedMatch params={params} />
    </Suspense>
  );
}
