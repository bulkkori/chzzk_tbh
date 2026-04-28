import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useStreamerLogin } from "@workspace/api-client-react";
import { ArrowLeft, KeyRound, Loader2, Tv, UserPlus } from "lucide-react";
import { useAuth, useStreamerSession } from "@/lib/auth";
import { useCurrentStreamer } from "@/lib/streamer-context";
import { cn } from "@/lib/utils";
import { startChzzkOAuth } from "@/lib/chzzk";

type Mode = "password" | "chzzk";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setSession } = useAuth();
  const { channelId, streamer, notFound } = useCurrentStreamer();
  const { isStreamer } = useStreamerSession(channelId);
  const [mode, setMode] = useState<Mode>("password");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useStreamerLogin();

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <p className="text-sm text-muted-foreground">존재하지 않는 스트리머예요.</p>
      </div>
    );
  }

  if (isStreamer && channelId) {
    setLocation(`/s/${channelId}/admin`);
  }

  const ensureMatchingChannel = (resChannelId: string): boolean => {
    if (!channelId) return false;
    if (resChannelId !== channelId) {
      setError(
        `로그인된 계정은 다른 스트리머(${resChannelId.slice(0, 6)}…)의 어드민이에요. 해당 스트리머 페이지에서 로그인해 주세요.`,
      );
      return false;
    }
    return true;
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    login.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: (res) => {
          if (!ensureMatchingChannel(res.streamer.channelId)) return;
          setSession({
            channelId: res.streamer.channelId,
            streamerName: res.streamer.name,
            token: res.token,
            nickname: username.trim(),
          });
          setPassword("");
          setLocation(`/s/${res.streamer.channelId}/admin`);
        },
        onError: (err: unknown) => {
          const e = err as
            | { status?: number; data?: { message?: string } | null }
            | undefined;
          if (e?.status === 401) {
            setError(e?.data?.message ?? "아이디 또는 비밀번호가 올바르지 않아요.");
          } else {
            setError(e?.data?.message ?? "로그인 중 문제가 생겼어요.");
          }
        },
      },
    );
  };

  const startChzzk = () => {
    setError("");
    // Send the streamer back here after auth so the channel-mismatch check
    // still runs if they pick a different account.
    startChzzkOAuth(channelId ? `/s/${channelId}/admin` : "/");
  };

  return (
    <div className="min-h-screen pb-24 font-sans">
      <div className="max-w-md mx-auto px-6 pt-12">
        <Link
          href={`/s/${channelId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          게시판으로
        </Link>

        <header className="mt-12 mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-5 ring-1 ring-primary/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-foreground/90 mb-3">
            {streamer ? `${streamer.name} 스트리머 로그인` : "스트리머 로그인"}
          </h1>
          <p className="text-muted-foreground leading-relaxed font-light text-sm">
            관리자만 들어올 수 있는 곳이에요.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-card/30 border border-border/40">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError("");
            }}
            className={cn(
              "flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all",
              mode === "password"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <KeyRound className="w-4 h-4" />
            아이디
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("chzzk");
              setError("");
            }}
            className={cn(
              "flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all",
              mode === "chzzk"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Tv className="w-4 h-4" />
            치지직
          </button>
        </div>

        {mode === "password" ? (
          <form
            onSubmit={submitPassword}
            className="rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-6 md:p-8 space-y-5"
          >
            <p className="text-xs leading-relaxed text-muted-foreground">
              치지직 인증 후 만들어 둔 아이디와 비밀번호로 로그인해 주세요.
              아직 만들지 않으셨다면 먼저 치지직 탭으로 인증해 주세요.
            </p>
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                아이디
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="my_id"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                비밀번호
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {login.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  확인 중…
                </>
              ) : (
                "로그인"
              )}
            </button>
          </form>
        ) : (
          <div className="rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-6 md:p-8 space-y-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              치지직 공식 로그인을 통해 본인 인증 후 어드민으로 들어갈 수
              있어요. 아직 등록되지 않은 채널이라도, 첫 로그인과 동시에 자동으로
              스트리머가 등록돼요. 첫 인증 후 곧바로 아이디·비밀번호를 만들어
              두면, 다음부터는 클릭 한 번 없이 로그인할 수 있어요.
            </p>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={startChzzk}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Tv className="w-4 h-4" />
              치지직으로 로그인
            </button>

            <Link
              href="/register"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            >
              <UserPlus className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
              아직 등록되지 않은 채널인가요? 신규 등록하기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
