import { Link, useLocation, useRoute } from "wouter";
import { Flame, LogIn, LogOut, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth, useStreamerSession } from "@/lib/auth";
import { useCurrentStreamer } from "@/lib/streamer-context";

export function SiteHeader() {
  const [location] = useLocation();
  // Detect whether we are inside a streamer-scoped route (`/s/:channelId/...`).
  const [matchStreamer] = useRoute("/s/:channelId/:rest*");
  const [matchStreamerRoot] = useRoute("/s/:channelId");
  const inStreamerScope = matchStreamer || matchStreamerRoot;

  const { channelId, streamer } = useCurrentStreamer();
  const { isStreamer, nickname } = useStreamerSession(channelId);
  const { clearSession, sessions } = useAuth();

  const onLogout = () => {
    if (channelId) clearSession(channelId);
  };

  const brandHref = inStreamerScope && channelId ? `/s/${channelId}` : "/";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/60 border-b border-border/40">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link
          href={brandHref}
          className="inline-flex items-center gap-2 text-foreground/85 hover:text-foreground transition-colors"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
            <Flame className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm tracking-wide font-medium">고해성사</span>
        </Link>

        {inStreamerScope && streamer && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <Link
              href={`/s/${streamer.channelId}`}
              className="text-sm text-foreground/80 hover:text-foreground transition-colors truncate max-w-[160px]"
            >
              {streamer.name}
            </Link>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {inStreamerScope && channelId ? (
            isStreamer ? (
              <>
                <Link
                  href={`/s/${channelId}/admin`}
                  className={
                    "hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border " +
                    (location.endsWith("/admin")
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border")
                  }
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  관리자 공간
                </Link>
                <span className="hidden md:inline text-xs text-muted-foreground/80 px-2">
                  {nickname ?? "스트리머"}
                </span>
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href={`/s/${channelId}/login`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                스트리머 로그인
              </Link>
            )
          ) : Object.keys(sessions).length > 0 ? (
            (() => {
              const firstSession = Object.values(sessions)[0];
              return (
                <>
                  <span className="hidden sm:inline text-xs text-muted-foreground/80 px-2">
                    {firstSession.streamerName}
                  </span>
                  <Link
                    href={`/s/${firstSession.channelId}/admin`}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    내 어드민
                  </Link>
                  <button
                    onClick={() => clearSession(firstSession.channelId)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    로그아웃
                  </button>
                </>
              );
            })()
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              스트리머 로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
