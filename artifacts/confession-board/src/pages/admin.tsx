import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAllConfessions,
  useAnswerConfession,
  getListAllConfessionsQueryKey,
  getListConfessionsQueryKey,
  getGetConfessionStatsQueryKey,
  getListHealedConfessionsQueryKey,
  getListPrivateConfessionsQueryKey,
  type Confession,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  Send,
  KeyRound,
  Smile,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useStreamerSession } from "@/lib/auth";
import { useCurrentStreamer } from "@/lib/streamer-context";
import { useState } from "react";
import { RichContent } from "@/components/editor/RichContent";

export default function Admin() {
  const { channelId, streamer, notFound } = useCurrentStreamer();
  const { token, isStreamer } = useStreamerSession(channelId);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!notFound && channelId && !isStreamer) {
      setLocation(`/s/${channelId}/login`);
    }
  }, [isStreamer, setLocation, channelId, notFound]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <p className="text-sm text-muted-foreground">존재하지 않는 스트리머예요.</p>
      </div>
    );
  }

  if (!token || !channelId) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="rounded-3xl border border-border/40 bg-card/40 p-8 text-center max-w-sm">
          <KeyRound className="w-6 h-6 mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">로그인 페이지로 이동 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 font-sans">
      <div className="max-w-3xl mx-auto px-6 pt-12">
        <Link
          href={`/s/${channelId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          게시판으로
        </Link>

        <header className="mt-12 mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-5 ring-1 ring-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-foreground/90 mb-3">
            {streamer ? `${streamer.name} 관리자 공간` : "관리자 공간"}
          </h1>
          <p className="text-muted-foreground leading-relaxed font-light">
            모든 글을 한 곳에서 살펴볼 수 있어요. 숨겨진 글은 눈을 감은 표시로 구분됩니다.
          </p>
        </header>

        <AdminContent channelId={channelId} token={token} />
      </div>
    </div>
  );
}

function AdminContent({ channelId, token }: { channelId: string; token: string }) {
  const allQuery = useListAllConfessions(
    channelId,
    { token },
    { query: { queryKey: getListAllConfessionsQueryKey(channelId, { token }) } },
  );

  if (allQuery.error) {
    const status = (allQuery.error as { status?: number }).status;
    if (status === 401) {
      return (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive-foreground">
          권한이 없어요. 다시 로그인해 주세요.
        </div>
      );
    }
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive-foreground">
        글을 불러오지 못했어요.
      </div>
    );
  }

  const all = allQuery.data ?? [];
  const hidden = all.filter((c) => c.isHidden);
  const visible = all.filter((c) => !c.isHidden);

  const Section = ({
    title,
    icon,
    items,
    accent,
  }: {
    title: string;
    icon: React.ReactNode;
    items: Confession[];
    accent: "primary" | "muted";
  }) => (
    <section className="space-y-4">
      <div
        className={
          "flex items-center gap-2 " +
          (accent === "primary" ? "text-primary/90" : "text-foreground/80")
        }
      >
        {icon}
        <h2 className="text-lg font-medium">
          {title} ({items.length})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center rounded-2xl border border-dashed border-border/40">
          아직 없어요.
        </p>
      ) : (
        items.map((c) => (
          <AdminCard key={c.id} confession={c} channelId={channelId} token={token} />
        ))
      )}
    </section>
  );

  return (
    <div className="space-y-12">
      <Section
        title="숨겨진 글"
        icon={<EyeOff className="w-4 h-4" />}
        items={hidden}
        accent="primary"
      />
      <Section
        title="공개된 글"
        icon={<Eye className="w-4 h-4" />}
        items={visible}
        accent="muted"
      />
    </div>
  );
}

const VERDICT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  guilty: {
    label: "유죄",
    bg: "bg-destructive/15 border-destructive/30",
    text: "text-destructive-foreground",
  },
  innocent: {
    label: "무죄",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-300",
  },
  funny: {
    label: "웃겼으니 무죄",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-300",
  },
};

function AdminCard({
  confession,
  channelId,
  token,
}: {
  confession: Confession;
  channelId: string;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const answerMut = useAnswerConfession();

  const submit = () => {
    if (answer.trim().length < 1) return;
    answerMut.mutate(
      { channelId, id: confession.id, data: { answer: answer.trim(), token } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAllConfessionsQueryKey(channelId, { token }) });
          queryClient.invalidateQueries({ queryKey: getListConfessionsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getListPrivateConfessionsQueryKey(channelId, { token }) });
          queryClient.invalidateQueries({ queryKey: getGetConfessionStatsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getListHealedConfessionsQueryKey(channelId) });
          setAnswer("");
          setOpen(false);
        },
      },
    );
  };

  const isHidden = confession.isHidden;
  const verdictStyle = confession.verdict ? VERDICT_STYLES[confession.verdict] : null;

  return (
    <div
      className={
        "rounded-3xl backdrop-blur-md border p-6 md:p-7 transition-colors " +
        (isHidden ? "border-primary/30 bg-primary/[0.04]" : "border-border/40 bg-card/40")
      }
    >
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">
          {confession.category}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(confession.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
        </span>
        <span
          className={
            "ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border " +
            (isHidden
              ? "text-primary border-primary/30 bg-primary/10"
              : "text-muted-foreground/80 border-border/50 bg-background/30")
          }
        >
          {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {isHidden ? "숨겨진 글" : "공개된 글"}
        </span>
        {verdictStyle && (
          <span
            className={
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border " +
              verdictStyle.bg + " " + verdictStyle.text
            }
          >
            <Gavel className="w-3 h-3" />
            {verdictStyle.label}
          </span>
        )}
      </div>

      <Link href={`/s/${channelId}/post/${confession.id}`}>
        <h3 className="text-lg font-medium text-foreground/95 mb-3 hover:text-primary transition-colors cursor-pointer">
          {confession.title}
        </h3>
      </Link>
      <RichContent html={confession.content} className="rich-content text-sm text-foreground/80" />

      {confession.answer && (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm whitespace-pre-wrap leading-loose">
          <div className="flex items-center gap-2 text-primary/90 text-xs mb-2">
            <Sparkles className="w-3 h-3" /> 이미 답변함
          </div>
          {confession.answer}
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-border/40 flex items-center gap-3 flex-wrap">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-primary/90 hover:text-primary inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            답 보내기
          </button>
        ) : null}
        <Link
          href={`/s/${channelId}/post/${confession.id}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <Smile className="w-3.5 h-3.5" />
          판결 내리러 가기
        </Link>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <textarea
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="조용히 답을 적어주세요…"
            className="w-full resize-none rounded-2xl border border-border/60 bg-background/40 p-4 text-sm leading-loose focus:border-primary/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={answerMut.isPending}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {answerMut.isPending ? "보내는 중…" : "보내기"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setAnswer("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground px-3"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
