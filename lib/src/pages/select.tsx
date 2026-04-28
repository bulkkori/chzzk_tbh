import { Link } from "wouter";
import { Flame, Tv, UserPlus, X } from "lucide-react";
import { useListStreamers } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

export default function Select() {
  const { data: streamers, isLoading, error } = useListStreamers();
  const { sessions } = useAuth();
  const isLoggedIn = Object.keys(sessions).length > 0;
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <div className="min-h-screen pb-24 font-sans">
      <header className="pt-24 pb-14 px-6 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-6 ring-1 ring-primary/20">
          <Flame className="w-6 h-6" />
        </div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4 text-foreground/90">
          고해성사
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed font-light">
          어느 스트리머의 게시판으로 갈까요?<br />
          마음을 내려놓을 곳을 골라주세요.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-6 space-y-10">
        <section className="space-y-3">
          {isLoading && (
            <div className="flex flex-wrap gap-6 justify-center">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="w-36 h-48 rounded-2xl bg-card/40" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive-foreground">
              스트리머 목록을 불러오지 못했어요.
            </div>
          )}

          {streamers && streamers.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border/40 bg-card/30 p-10 text-center">
              <Tv className="w-8 h-8 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                아직 등록된 스트리머가 없어요.
              </p>
            </div>
          )}

          {streamers && streamers.length > 0 && (
            <div className="flex flex-wrap gap-6 justify-center">
              {streamers.map((s) => (
                <Link
                  key={s.id}
                  href={`/s/${s.channelId}`}
                  className="group flex flex-col items-center gap-3 w-36 p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 hover:border-primary/50 hover:bg-card/60 transition-all duration-200 hover:scale-[1.04]"
                >
                  <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-border/40 group-hover:ring-primary/50 bg-secondary/40 shrink-0 transition-all duration-200">
                    {s.profileImageUrl ? (
                      <img
                        src={s.profileImageUrl}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Tv className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground/85 group-hover:text-primary transition-colors text-center leading-tight">
                    {s.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {!isLoggedIn && (
          <section className="flex justify-center pt-2">
            <button
              onClick={() => setShowComingSoon(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-muted-foreground hover:text-foreground bg-card/30 hover:bg-card/50 border border-border/50 hover:border-border backdrop-blur-md transition-all"
            >
              <UserPlus className="w-4 h-4" />
              치지직으로 스트리머 등록
            </button>
          </section>
        )}
      </main>

      {showComingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="relative mx-4 max-w-sm w-full rounded-3xl bg-card/90 border border-border/50 p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowComingSoon(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 mb-4">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-medium text-foreground/90 mb-2">
              신규 등록은 준비 중입니다
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              현재 신규 스트리머 등록은 준비 중이에요.<br />
              조금만 기다려 주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
