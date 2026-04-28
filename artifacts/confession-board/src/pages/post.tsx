import { Link, useParams, useLocation } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetConfession,
  useDeleteConfession,
  useSetConfessionVerdict,
  useUnlockConfession,
  getGetConfessionQueryKey,
  getListConfessionsQueryKey,
  getGetConfessionStatsQueryKey,
  getListHealedConfessionsQueryKey,
  getListAllConfessionsQueryKey,
  type Confession,
  type Verdict,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Sparkles,
  Trash2,
  Pencil,
  Lock,
  EyeOff,
  ThumbsDown,
  ThumbsUp,
  Smile,
  Loader2,
  Gavel,
  KeyRound,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { RichContent } from "@/components/editor/RichContent";
import { useStreamerSession } from "@/lib/auth";
import { useCurrentStreamer } from "@/lib/streamer-context";
import { rememberPostPassword } from "@/lib/post-passwords";

export default function Post() {
  const params = useParams<{ channelId: string; id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { channelId, notFound } = useCurrentStreamer();
  const { token, isStreamer } = useStreamerSession(channelId);

  // Holds the post once unlocked by author password (when not streamer admin).
  const [unlockedPost, setUnlockedPost] = useState<Confession | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const unlockMut = useUnlockConfession();

  const { data: post, isLoading, error } = useGetConfession(
    channelId ?? "",
    id,
    isStreamer && token ? { token } : undefined,
    {
      query: {
        enabled: !!id && !!channelId && !unlockedPost,
        queryKey: getGetConfessionQueryKey(
          channelId ?? "",
          id,
          isStreamer && token ? { token } : undefined,
        ),
      },
    },
  );

  const effectivePost = unlockedPost ?? post;

  const del = useDeleteConfession();
  const verdictMut = useSetConfessionVerdict();
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [delError, setDelError] = useState("");

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <p className="text-sm text-muted-foreground">존재하지 않는 스트리머예요.</p>
      </div>
    );
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError("");
    if (!channelId) return;
    if (unlockPassword.length < 1) {
      setUnlockError("비밀번호를 입력해 주세요.");
      return;
    }
    unlockMut.mutate(
      { channelId, id, data: { password: unlockPassword } },
      {
        onSuccess: (full) => {
          setUnlockedPost(full);
          // Remember password so the edit page can reuse it.
          rememberPostPassword(id, unlockPassword);
          // Pre-fill the delete password field so the user doesn't retype.
          setPassword(unlockPassword);
        },
        onError: (err: unknown) => {
          const e = err as { status?: number } | undefined;
          if (e?.status === 403) {
            setUnlockError("비밀번호가 일치하지 않아요.");
          } else if (e?.status === 404) {
            setUnlockError("글을 찾을 수 없어요.");
          } else {
            setUnlockError("확인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
          }
        },
      },
    );
  };

  const handleDelete = () => {
    setDelError("");
    if (!channelId) return;
    if (password.length < 1) {
      setDelError("비밀번호를 입력해 주세요.");
      return;
    }
    del.mutate(
      { channelId, id, data: { password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConfessionsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getGetConfessionStatsQueryKey(channelId) });
          setLocation(`/s/${channelId}`);
        },
        onError: (err: unknown) => {
          const e = err as { status?: number } | undefined;
          if (e?.status === 403) {
            setDelError("비밀번호가 일치하지 않아요.");
          } else {
            setDelError("삭제 중 문제가 생겼어요.");
          }
        },
      },
    );
  };

  const setVerdict = (verdict: Verdict | null) => {
    if (!token || !channelId) return;
    verdictMut.mutate(
      { channelId, id, data: { token, verdict } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetConfessionQueryKey(
              channelId,
              id,
              isStreamer && token ? { token } : undefined,
            ),
          });
          queryClient.invalidateQueries({ queryKey: getListConfessionsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getGetConfessionStatsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getListHealedConfessionsQueryKey(channelId) });
          queryClient.invalidateQueries({
            queryKey: getListAllConfessionsQueryKey(channelId, { token }),
          });
        },
      },
    );
  };

  const errorStatus = (error as { status?: number } | undefined)?.status;
  const showHiddenUnlockUI = !effectivePost && errorStatus === 403;

  return (
    <div className="min-h-screen pb-24 font-sans">
      <div className="max-w-2xl mx-auto px-6 pt-12">
        <Link
          href={`/s/${channelId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          게시판으로
        </Link>

        {isLoading && !unlockedPost && (
          <div className="mt-12 space-y-4">
            <Skeleton className="h-8 w-2/3 bg-card/40" />
            <Skeleton className="h-64 w-full bg-card/40 rounded-3xl" />
          </div>
        )}

        {showHiddenUnlockUI && (
          <div className="mt-12 rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-8 md:p-10 shadow-2xl shadow-black/40">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-5 ring-1 ring-primary/20">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-light text-foreground/90 mb-2">비공개 글이에요</h2>
              <p className="text-sm text-muted-foreground/80 mb-1">
                스트리머에게만 공개된 고민입니다.
              </p>
              <p className="text-sm text-muted-foreground/60">
                작성자라면 비밀번호로 글을 열어 수정·삭제할 수 있어요.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="mt-8 space-y-3 max-w-sm mx-auto">
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 text-center">
                <KeyRound className="inline-block w-3 h-3 mr-1.5 -mt-0.5" />
                작성 시 입력한 비밀번호
              </label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="비밀번호"
                autoFocus
                className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={unlockMut.isPending}
                className="w-full rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unlockMut.isPending ? "확인 중…" : "비밀번호로 열기"}
              </button>
              {unlockError && (
                <p className="text-xs text-destructive-foreground/90 text-center">
                  {unlockError}
                </p>
              )}
            </form>
          </div>
        )}

        {!effectivePost && error && !showHiddenUnlockUI && (
          <div className="mt-12 text-center py-20">
            <Lock className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">글을 찾을 수 없어요.</p>
          </div>
        )}

        {effectivePost && (
          <article className="mt-12 rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-8 md:p-12 shadow-2xl shadow-black/40 relative overflow-hidden">
            {(effectivePost.answer || effectivePost.verdict) && (
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
            )}

            <div className="relative">
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">
                  {effectivePost.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(effectivePost.createdAt), "yyyy년 M월 d일 HH:mm", { locale: ko })}
                </span>
                {effectivePost.isHidden && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <EyeOff className="w-3 h-3" />
                    숨겨진 글
                  </span>
                )}
                {effectivePost.verdict && <VerdictBadge verdict={effectivePost.verdict} />}
              </div>

              <h1 className="text-3xl md:text-4xl font-light leading-snug text-foreground/95 mb-8">
                {effectivePost.title}
              </h1>

              <RichContent html={effectivePost.content} className="rich-content text-foreground/85" />

              {isStreamer && (
                <VerdictPanel
                  current={effectivePost.verdict}
                  isPending={verdictMut.isPending}
                  onSelect={setVerdict}
                />
              )}

              {effectivePost.answer && (
                <div className="mt-12 rounded-3xl border border-primary/25 bg-primary/5 p-7 md:p-8 backdrop-blur-sm relative">
                  <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <div className="flex items-center gap-2 mb-4 text-primary">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium tracking-wide">스트리머의 답</span>
                    {effectivePost.answeredAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(effectivePost.answeredAt), "yyyy.MM.dd", { locale: ko })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-loose text-foreground/95">
                    {effectivePost.answer}
                  </p>
                </div>
              )}

              <div className="mt-10 pt-6 border-t border-border/40">
                {!showDelete ? (
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/s/${channelId}/post/${id}/edit`}
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      이 글 수정하기
                    </Link>
                    <span className="text-border/60 text-xs">·</span>
                    <button
                      onClick={() => setShowDelete(true)}
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-destructive-foreground transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      이 글 지우기
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1 rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
                      />
                      <button
                        onClick={handleDelete}
                        disabled={del.isPending}
                        className="rounded-xl bg-destructive/80 hover:bg-destructive text-destructive-foreground px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
                      >
                        {del.isPending ? "지우는 중…" : "삭제"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDelete(false);
                          setPassword(unlockedPost ? unlockPassword : "");
                          setDelError("");
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground px-3"
                      >
                        취소
                      </button>
                    </div>
                    {delError && <p className="text-xs text-destructive-foreground/90">{delError}</p>}
                  </div>
                )}
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, { label: string; cls: string }> = {
    guilty: { label: "유죄", cls: "border-destructive/40 bg-destructive/15 text-destructive-foreground" },
    innocent: { label: "무죄", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
    funny: { label: "웃겼으니 무죄", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  };
  const m = map[verdict];
  return (
    <span className={"inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border " + m.cls}>
      <Gavel className="w-3 h-3" />
      {m.label}
    </span>
  );
}

function VerdictPanel({
  current,
  isPending,
  onSelect,
}: {
  current: Verdict | null | undefined;
  isPending: boolean;
  onSelect: (v: Verdict | null) => void;
}) {
  const Btn = ({
    v,
    label,
    icon,
    color,
  }: {
    v: Verdict;
    label: string;
    icon: React.ReactNode;
    color: string;
  }) => {
    const active = current === v;
    return (
      <button
        onClick={() => onSelect(active ? null : v)}
        disabled={isPending}
        className={
          "flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium border transition-colors disabled:opacity-50 " +
          (active
            ? color + " text-foreground shadow-lg"
            : "border-border/50 bg-background/30 text-muted-foreground hover:text-foreground hover:border-border")
        }
      >
        {isPending && active ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {label}
      </button>
    );
  };

  return (
    <div className="mt-10 rounded-3xl border border-border/40 bg-background/40 p-5 md:p-6">
      <div className="flex items-center gap-2 text-foreground/80 mb-4">
        <Gavel className="w-4 h-4" />
        <span className="text-sm font-medium">스트리머 판결</span>
        {current && (
          <button
            onClick={() => onSelect(null)}
            disabled={isPending}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            판결 취소
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Btn v="guilty" label="유죄" icon={<ThumbsDown className="w-4 h-4" />} color="border-destructive/50 bg-destructive/15" />
        <Btn v="innocent" label="무죄" icon={<ThumbsUp className="w-4 h-4" />} color="border-emerald-500/50 bg-emerald-500/15" />
        <Btn v="funny" label="웃겼으니 무죄" icon={<Smile className="w-4 h-4" />} color="border-amber-500/50 bg-amber-500/15" />
      </div>
    </div>
  );
}
