import { Link } from "wouter";
import { ArrowLeft, Tv, UserPlus, X } from "lucide-react";
import { useState } from "react";

export default function Register() {
  const [showComingSoon, setShowComingSoon] = useState(true);

  return (
    <div className="min-h-screen pb-24 font-sans">
      <div className="max-w-md mx-auto px-6 pt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>

        <header className="mt-12 mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-5 ring-1 ring-primary/20">
            <Tv className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-foreground/90 mb-3">
            신규 스트리머 등록
          </h1>
          <p className="text-muted-foreground leading-relaxed font-light text-sm">
            현재 신규 등록은 준비 중이에요.
          </p>
        </header>
      </div>

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
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              돌아가기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
