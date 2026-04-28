import { useState } from "react";
import { useSetStreamerCredentials } from "@workspace/api-client-react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  /** Existing admin token (from chzzk login). */
  token: string;
  channelId: string;
  streamerName: string;
  onSaved: (next: { token: string; nickname: string }) => void;
  onSkip: () => void;
}

export function CredentialsSetupDialog({
  open,
  token,
  channelId: _channelId,
  streamerName,
  onSaved,
  onSkip,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const setCreds = useSetStreamerCredentials();

  const reset = () => {
    setUsername("");
    setPassword("");
    setConfirmPw("");
    setError("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(u)) {
      setError("아이디는 영문/숫자/._- 만 사용할 수 있고 3~32자여야 해요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    if (password !== confirmPw) {
      setError("비밀번호가 서로 달라요.");
      return;
    }
    setCreds.mutate(
      { data: { token, username: u, password } },
      {
        onSuccess: (res) => {
          const next = { token: res.token, nickname: u };
          reset();
          onSaved(next);
        },
        onError: (err: unknown) => {
          const e = err as
            | { status?: number; data?: { message?: string } | null }
            | undefined;
          setError(e?.data?.message ?? "계정 만들기에 실패했어요.");
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onSkip();
      }}
    >
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-3 ring-1 ring-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-light text-foreground/90">
            로그인용 아이디·비밀번호 만들기
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-foreground/80">{streamerName}</span> 님,
            다음번엔 치지직 쿠키를 입력하지 않고도 들어오실 수 있게
            전용 아이디와 비밀번호를 만들어 두시는 걸 권해요.
            <br />
            <span className="text-xs text-muted-foreground/80">
              방금 입력하신 쿠키는 인증 직후 폐기되었어요.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              아이디
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="english_or_number_3_to_32"
              className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              비밀번호 (6자 이상)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              비밀번호 확인
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2 sm:flex-row sm:justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onSkip();
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-4 py-2"
            >
              나중에 만들기
            </button>
            <button
              type="submit"
              disabled={setCreds.isPending}
              className="rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {setCreds.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중…
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  계정 만들기
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
