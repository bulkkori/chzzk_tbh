import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { CredentialsSetupDialog } from "@/components/CredentialsSetupDialog";

interface CallbackPayload {
  token: string;
  channelId: string;
  streamerName: string;
  nickname: string;
  hasCredentials: boolean;
  isNew: boolean;
  returnTo: string;
}

function parseHashParams(): Record<string, string> {
  // Strip the leading "#" from the hash, if any.
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(raw);
  const result: Record<string, string> = {};
  params.forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

function safePath(input: string | undefined): string {
  if (!input) return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { setSession } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CallbackPayload | null>(null);

  useEffect(() => {
    const params = parseHashParams();

    if (params.error) {
      setError(params.error);
      // Clear the hash so a refresh won't re-show the error.
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const { token, channelId, streamerName, nickname, hasCredentials, isNew, returnTo } =
      params;

    if (!token || !channelId) {
      setError("로그인 정보를 받지 못했어요. 다시 시도해 주세요.");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const payload: CallbackPayload = {
      token,
      channelId,
      streamerName: streamerName || channelId,
      nickname: nickname || "",
      hasCredentials: hasCredentials === "1",
      isNew: isNew === "1",
      returnTo: safePath(returnTo),
    };

    // Strip the hash from the URL so the token isn't lying around in
    // window.location after we're done.
    window.history.replaceState(null, "", window.location.pathname);

    if (!payload.hasCredentials) {
      // First time in (or never set creds) — let them set up an id/password
      // before we hand control back to the rest of the app.
      setPending(payload);
      return;
    }

    setSession({
      channelId: payload.channelId,
      streamerName: payload.streamerName,
      token: payload.token,
      nickname: payload.nickname || null,
    });

    const fallback = `/s/${payload.channelId}/admin`;
    setLocation(payload.returnTo === "/" ? fallback : payload.returnTo);
  }, [setLocation, setSession]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full text-center rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-8">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-destructive/10 text-destructive mb-4 ring-1 ring-destructive/30">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-light text-foreground/90 mb-3">
            치지직 로그인 실패
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {error}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-6">
      {pending && (
        <CredentialsSetupDialog
          open
          token={pending.token}
          channelId={pending.channelId}
          streamerName={pending.streamerName}
          onSaved={(next) => {
            setSession({
              channelId: pending.channelId,
              streamerName: pending.streamerName,
              token: next.token,
              nickname: next.nickname,
            });
            const fallback = `/s/${pending.channelId}/admin`;
            const target =
              pending.returnTo === "/" ? fallback : pending.returnTo;
            setPending(null);
            setLocation(target);
          }}
          onSkip={() => {
            setSession({
              channelId: pending.channelId,
              streamerName: pending.streamerName,
              token: pending.token,
              nickname: pending.nickname || null,
            });
            const fallback = `/s/${pending.channelId}/admin`;
            const target =
              pending.returnTo === "/" ? fallback : pending.returnTo;
            setPending(null);
            setLocation(target);
          }}
        />
      )}
      {!pending && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-4 ring-1 ring-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            로그인 마무리 중…
          </p>
        </div>
      )}
    </div>
  );
}
