import { Link, useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetConfession,
  useUpdateConfession,
  unlockConfession,
  getGetConfessionQueryKey,
  getListConfessionsQueryKey,
  getGetConfessionStatsQueryKey,
  type Category,
  type Confession,
} from "@workspace/api-client-react";
import { ArrowLeft, Eye, EyeOff, Pencil, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichEditor } from "@/components/editor/RichEditor";
import { useCurrentStreamer } from "@/lib/streamer-context";
import { useStreamerSession } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  recallPostPassword,
  rememberPostPassword,
} from "@/lib/post-passwords";

const CATEGORIES: Category[] = ["학업", "연애", "진로", "관계", "기타"];

export default function Edit() {
  const params = useParams<{ channelId: string; id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { channelId, notFound } = useCurrentStreamer();
  const { token, isStreamer } = useStreamerSession(channelId);

  // Try the normal GET; for hidden posts we fall back to the unlock endpoint
  // using the password the author entered on the post page (kept in
  // sessionStorage).
  const {
    data: post,
    isLoading,
    error,
  } = useGetConfession(
    channelId ?? "",
    id,
    isStreamer && token ? { token } : undefined,
    { query: { enabled: !!id && !!channelId } },
  );

  const [unlockedPost, setUnlockedPost] = useState<Confession | null>(null);
  const [unlockError, setUnlockError] = useState<
    "wrong" | "missing" | "other" | null
  >(null);
  const [unlockTried, setUnlockTried] = useState(false);

  const errorStatus = (error as { status?: number } | undefined)?.status;

  // When the GET fails with 403 (hidden), try the saved password to unlock.
  useEffect(() => {
    if (!channelId || !id) return;
    if (post || unlockedPost || unlockTried) return;
    if (errorStatus !== 403) return;
    const stored = recallPostPassword(id);
    setUnlockTried(true);
    if (!stored) {
      setUnlockError("missing");
      return;
    }
    unlockConfession(channelId, id, { password: stored })
      .then((full) => setUnlockedPost(full))
      .catch((err: unknown) => {
        const e = err as { status?: number } | undefined;
        if (e?.status === 403) setUnlockError("wrong");
        else setUnlockError("other");
      });
  }, [channelId, id, post, unlockedPost, unlockTried, errorStatus]);

  const effectivePost = unlockedPost ?? post;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("학업");
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [formError, setFormError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (effectivePost && !initialized) {
      setTitle(effectivePost.title);
      setContent(effectivePost.content);
      setCategory(effectivePost.category as Category);
      setIsPrivate(
        effectivePost.isPrivate ?? effectivePost.isHidden ?? false,
      );
      // Pre-fill the password field if we already know it from the unlock.
      const stored = recallPostPassword(id);
      if (stored) setPassword(stored);
      setInitialized(true);
    }
  }, [effectivePost, initialized, id]);

  const update = useUpdateConfession();

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <p className="text-sm text-muted-foreground">존재하지 않는 스트리머예요.</p>
      </div>
    );
  }

  // The post is unreachable — either it really doesn't exist, or it's hidden
  // and we don't have a valid author password to unlock it from this page.
  const blocked =
    error &&
    !effectivePost &&
    (errorStatus !== 403 || unlockError !== null);

  if (blocked) {
    const isHiddenLockedOut = errorStatus === 403;
    return (
      <div className="min-h-screen flex items-center justify-center font-sans px-6">
        <div className="text-center max-w-sm">
          <Lock className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
          {isHiddenLockedOut ? (
            <>
              <p className="text-muted-foreground font-medium mb-2">
                비공개 글이에요
              </p>
              <p className="text-sm text-muted-foreground/70 mb-6">
                {unlockError === "wrong"
                  ? "저장된 비밀번호가 더 이상 맞지 않아요."
                  : "글로 돌아가 비밀번호를 먼저 입력해 주세요."}
              </p>
              <Link
                href={`/s/${channelId}/post/${id}`}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
              >
                <ArrowLeft className="w-4 h-4" />
                글로 돌아가기
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">글을 찾을 수 없어요.</p>
          )}
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!channelId) return;
    if (title.trim().length < 1) return setFormError("제목을 한 줄 적어주세요.");
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    if (textOnly.length < 10) return setFormError("내용은 10자 이상 적어주세요.");
    if (password.length < 1) return setFormError("비밀번호를 입력해 주세요.");

    update.mutate(
      {
        channelId,
        id,
        data: { title: title.trim(), content: content.trim(), category, password, isPrivate },
      },
      {
        onSuccess: (updated) => {
          // Password proven correct — keep it remembered for future edits.
          rememberPostPassword(updated.id, password);
          queryClient.invalidateQueries({ queryKey: getListConfessionsQueryKey(channelId) });
          queryClient.invalidateQueries({ queryKey: getGetConfessionStatsQueryKey(channelId) });
          queryClient.invalidateQueries({
            queryKey: getGetConfessionQueryKey(channelId, updated.id),
          });
          setLocation(`/s/${channelId}/post/${updated.id}`);
        },
        onError: (err: unknown) => {
          const e = err as { status?: number } | undefined;
          if (e?.status === 403) {
            setFormError("비밀번호가 일치하지 않아요.");
          } else {
            setFormError("수정 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
          }
        },
      },
    );
  };

  return (
    <div className="min-h-screen pb-24 font-sans">
      <div className="max-w-2xl mx-auto px-6 pt-12">
        <Link
          href={`/s/${channelId}/post/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          글로 돌아가기
        </Link>

        <header className="mt-12 mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-5 ring-1 ring-primary/20">
            <Pencil className="w-5 h-5" />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-foreground/90 mb-3">
            글 수정하기
          </h1>
          <p className="text-muted-foreground leading-relaxed font-light">
            작성 시 입력한 비밀번호로 수정할 수 있어요.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-3xl bg-card/40" />
            <Skeleton className="h-64 w-full rounded-3xl bg-card/40" />
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl bg-card/40 backdrop-blur-md border border-border/40 p-8 md:p-10 space-y-7 shadow-2xl shadow-black/40"
          >
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm transition-all duration-300 border backdrop-blur-sm",
                      category === c
                        ? "bg-primary/20 border-primary/30 text-primary"
                        : "bg-card/30 border-border/50 text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                제목
              </label>
              <input
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목 한 줄"
                className="w-full bg-transparent border-b border-border/60 pb-3 text-lg text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                내용
              </label>
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="여기에 마음을 비워보세요…"
              />
              <p className="mt-2 text-xs text-muted-foreground/60 text-right">
                글꼴, 색상, 이미지, 동영상을 자유롭게 사용할 수 있어요.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                비밀번호 확인 (작성 시 입력한 비밀번호)
              </label>
              <input
                required
                type="password"
                minLength={4}
                maxLength={64}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-sm transition-all",
                isPrivate
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="text-left">
                  <span className="block">
                    {isPrivate ? "스트리머만 읽을 수 있어요" : "모두에게 공개돼요"}
                  </span>
                  <span className="block text-xs text-muted-foreground/60 mt-0.5">
                    {isPrivate
                      ? "게시판에는 보이지 않아요"
                      : "다른 사람들의 위로를 받을 수 있어요"}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  "h-6 w-11 rounded-full transition relative",
                  isPrivate ? "bg-primary/70" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform",
                    isPrivate && "translate-x-5",
                  )}
                />
              </span>
            </button>

            {formError && (
              <p className="text-sm text-destructive-foreground bg-destructive/20 border border-destructive/30 rounded-xl px-4 py-3">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={update.isPending}
              className="w-full rounded-2xl bg-primary text-primary-foreground py-4 text-base font-medium shadow-[0_0_30px_rgba(217,119,6,0.25)] hover:shadow-[0_0_40px_rgba(217,119,6,0.4)] hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {update.isPending ? "수정하는 중…" : "수정 완료"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
