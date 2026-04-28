import { Link } from "wouter";
import {
  useListConfessions,
  useGetConfessionStats,
  useListHealedConfessions,
  Category,
  type ConfessionPreview,
} from "@workspace/api-client-react";
import { Flame, Sparkles, Feather, Archive, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useStreamerSession } from "@/lib/auth";
import { useCurrentStreamer } from "@/lib/streamer-context";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const { channelId, streamer, isLoading: streamerLoading, notFound } =
    useCurrentStreamer();
  const { token } = useStreamerSession(channelId);

  const enabled = !!channelId;
  const { data: stats } = useGetConfessionStats(channelId ?? "", {
    query: { enabled },
  });
  const { data: healed } = useListHealedConfessions(channelId ?? "", {
    query: { enabled },
  });
  const { data: confessions, isLoading } = useListConfessions(
    channelId ?? "",
    {
      ...(selectedCategory ? { category: selectedCategory } : {}),
      ...(token ? { token } : {}),
    },
    { query: { enabled } },
  );

  const categories: { label: string; value: Category | undefined }[] = [
    { label: "전체", value: undefined },
    { label: "학업", value: Category.학업 },
    { label: "연애", value: Category.연애 },
    { label: "진로", value: Category.진로 },
    { label: "관계", value: Category.관계 },
    { label: "기타", value: Category.기타 },
  ];

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="rounded-3xl border border-border/40 bg-card/40 p-8 text-center max-w-sm">
          <p className="text-sm text-muted-foreground mb-4">
            존재하지 않는 스트리머예요.
          </p>
          <Link
            href="/"
            className="text-sm text-primary hover:text-primary/80"
          >
            스트리머 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 font-sans">
      <header className="pt-24 pb-16 px-6 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-6 ring-1 ring-primary/20">
          <Flame className="w-6 h-6" />
        </div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-3 text-foreground/90">
          {streamerLoading ? "고해성사" : (streamer?.name ?? "고해성사")}
        </h1>
        <p className="text-muted-foreground text-lg mb-10 leading-relaxed font-light">
          누구에게도 말하지 못한 무거운 마음을 내려놓는 곳.<br />
          당신의 이야기에 조용히 귀 기울이겠습니다.
        </p>
        <Link href={`/s/${channelId}/write`}>
          <Button
            size="lg"
            className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-full px-8 h-14 text-lg font-medium shadow-[0_0_20px_rgba(217,119,6,0.3)] transition-all hover:shadow-[0_0_30px_rgba(217,119,6,0.5)]"
          >
            <Feather className="mr-2 w-5 h-5" />
            마음 털어놓기
          </Button>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 space-y-16">
        {stats && (
          <section className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto">
            <div className="flex flex-col items-center p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/50">
              <span className="text-3xl font-light text-foreground mb-1">{stats.total}</span>
              <span className="text-sm text-muted-foreground">총 고민</span>
            </div>
            <div className="flex flex-col items-center p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/50">
              <span className="text-3xl font-light text-primary mb-1">{stats.healed}</span>
              <span className="text-sm text-primary/80">치유됨</span>
            </div>
            <div className="flex flex-col items-center p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/50">
              <span className="text-3xl font-light text-foreground mb-1">{stats.waiting}</span>
              <span className="text-sm text-muted-foreground">기다리는 글</span>
            </div>
          </section>
        )}

        {healed && healed.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-primary/80">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-medium">최근 치유된 고민</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {healed.slice(0, 2).map((h) => (
                <ConfessionCard key={h.id} confession={h} channelId={channelId!} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((c) => (
              <button
                key={c.label}
                onClick={() => setSelectedCategory(c.value)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm transition-all duration-300 border backdrop-blur-sm",
                  selectedCategory === c.value
                    ? "bg-primary/20 border-primary/30 text-primary"
                    : "bg-card/30 border-border/50 text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl bg-card/40" />
              ))
            ) : confessions?.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                <Archive className="w-12 h-12 mb-4 opacity-20" />
                <p>아직 남겨진 이야기가 없습니다.</p>
              </div>
            ) : (
              confessions?.map((c) => (
                <ConfessionCard key={c.id} confession={c} channelId={channelId!} />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ConfessionCard({
  confession,
  channelId,
}: {
  confession: ConfessionPreview;
  channelId: string;
}) {
  const isHidden = confession.isHidden;
  return (
    <Link href={`/s/${channelId}/post/${confession.id}`} className="block group">
      <div
        className={cn(
          "p-6 rounded-2xl backdrop-blur-md border transition-all duration-500 hover:-translate-y-1 relative overflow-hidden",
          isHidden
            ? "bg-violet-500/[0.07] border-violet-400/30 hover:bg-violet-500/[0.12] hover:border-violet-400/50 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.08)]"
            : "bg-card/40 border-border/40 hover:bg-card/60 hover:border-primary/20",
        )}
      >
        {confession.hasAnswer && !isHidden && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none transition-opacity group-hover:opacity-100 opacity-60" />
        )}
        {isHidden && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/15 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none" />
        )}
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-md",
                isHidden
                  ? "bg-violet-500/15 text-violet-200 border border-violet-400/30"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {confession.category}
            </span>
            {isHidden && (
              <span className="flex items-center gap-1 text-xs font-medium text-violet-200 bg-violet-500/15 px-2 py-1 rounded-md border border-violet-400/40">
                <EyeOff className="w-3 h-3" />
                숨김
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(confession.createdAt), "yyyy.MM.dd", { locale: ko })}
            </span>
          </div>
          {confession.hasAnswer && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 shadow-[0_0_10px_rgba(217,119,6,0.1)] shrink-0">
              <Sparkles className="w-3 h-3" />
              치유됨
            </span>
          )}
        </div>
        <h3
          className={cn(
            "text-xl font-medium mb-3 line-clamp-1 transition-colors",
            isHidden
              ? "text-violet-100/90 group-hover:text-violet-100"
              : "text-foreground/90 group-hover:text-primary",
          )}
        >
          {confession.title}
        </h3>
        {!isHidden && (
          <p className="line-clamp-2 leading-relaxed text-sm text-muted-foreground">
            {confession.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
          </p>
        )}
        {isHidden && (
          <p className="text-sm text-violet-200/50 italic">내용이 숨겨져 있어요.</p>
        )}
      </div>
    </Link>
  );
}
