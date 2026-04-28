import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Film,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResizableImage, Video, FontSize } from "./extensions";
import { uploadFile } from "@/lib/upload";

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "기본", value: "" },
  { label: "Pretendard", value: "Pretendard Variable, Pretendard, sans-serif" },
  { label: "명조", value: "'Noto Serif KR', 'Nanum Myeongjo', serif" },
  { label: "고딕", value: "'Nanum Gothic', sans-serif" },
  { label: "손글씨", value: "'Gaegu', 'Hi Melody', cursive" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, monospace" },
];

const FONT_SIZES = [
  { label: "작게", value: "14px" },
  { label: "보통", value: "16px" },
  { label: "조금 크게", value: "18px" },
  { label: "크게", value: "22px" },
  { label: "더 크게", value: "28px" },
  { label: "헤드", value: "36px" },
];

const COLORS = [
  "#f5e6cc",
  "#fbbf24",
  "#fb923c",
  "#f87171",
  "#fb7185",
  "#c084fc",
  "#60a5fa",
  "#34d399",
  "#a3a3a3",
  "#ffffff",
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { class: "editor-link", rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage,
      Video,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rich-editor-content focus:outline-none",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/40 min-h-[320px] animate-pulse" />
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 overflow-hidden focus-within:border-primary/40 transition-colors">
      <Toolbar editor={editor} />
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <div className="absolute top-5 left-5 text-muted-foreground/40 pointer-events-none select-none text-base">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<null | "image" | "video">(null);
  const [uploadError, setUploadError] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
    };
  }, [editor]);

  const handleImagePick = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError("");
    setUploading("image");
    let success = 0;
    let failure = 0;
    for (const file of files) {
      try {
        const r = await uploadFile(file, "image");
        editor.chain().focus().setImage({ src: r.url, alt: r.name }).run();
        success++;
      } catch (e) {
        failure++;
        setUploadError(e instanceof Error ? e.message : "업로드 실패");
      }
    }
    setUploading(null);
    if (failure > 0 && success > 0) {
      setUploadError(`${success}개 업로드 완료, ${failure}개 실패`);
    }
  }, [editor]);

  const handleVideoPick = useCallback(async (file: File) => {
    setUploadError("");
    setUploading("video");
    try {
      const r = await uploadFile(file, "video");
      editor
        .chain()
        .focus()
        .insertContent({
          type: "video",
          attrs: { src: r.url, controls: true, width: "100%" },
        })
        .run();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(null);
    }
  }, [editor]);

  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("링크 주소를 입력하세요", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const resizeSelectedImage = (delta: number) => {
    const attrs = editor.getAttributes("resizableImage");
    const current = parseInt(attrs.width || "100", 10) || 100;
    const next = Math.max(20, Math.min(100, current + delta));
    editor.chain().focus().updateAttributes("resizableImage", { width: `${next}%` }).run();
  };

  const isImageSelected = editor.isActive("resizableImage");
  const isVideoSelected = editor.isActive("video");

  return (
    <div className="border-b border-border/40 bg-card/40 backdrop-blur-sm">
      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          if (files.length > 0) handleImagePick(files);
        }}
      />
      <input
        ref={vidInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleVideoPick(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-1 p-2">
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 className="w-4 h-4" />
        </ToolBtn>

        <Sep />

        <select
          aria-label="글꼴"
          className="bg-transparent text-xs px-2 py-1.5 rounded-md border border-border/40 text-foreground/80 hover:border-border focus:outline-none focus:border-primary/40"
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          value={editor.getAttributes("textStyle").fontFamily || ""}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          aria-label="글자 크기"
          className="bg-transparent text-xs px-2 py-1.5 rounded-md border border-border/40 text-foreground/80 hover:border-border focus:outline-none focus:border-primary/40"
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          value={editor.getAttributes("textStyle").fontSize || ""}
        >
          <option value="">크기</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <ColorPicker editor={editor} />

        <Sep />

        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-4 h-4" />
        </ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-4 h-4" />
        </ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive("link")} onClick={setLink}>
          <LinkIcon className="w-4 h-4" />
        </ToolBtn>
        {/* 이미지/동영상 업로드는 잠시 비활성화 상태입니다.
        <ToolBtn onClick={() => imgInput.current?.click()} disabled={!!uploading}>
          {uploading === "image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </ToolBtn>
        <ToolBtn onClick={() => vidInput.current?.click()} disabled={!!uploading}>
          {uploading === "video" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
        </ToolBtn>
        */}
      </div>

      {(isImageSelected || isVideoSelected) && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40 bg-card/30 text-xs text-muted-foreground">
          <span>{isImageSelected ? "이미지 크기" : "동영상 크기"}</span>
          {isImageSelected ? (
            <>
              <SizeBtn onClick={() => resizeSelectedImage(-10)}>−</SizeBtn>
              <span className="px-2 text-foreground/80">
                {editor.getAttributes("resizableImage").width || "100%"}
              </span>
              <SizeBtn onClick={() => resizeSelectedImage(10)}>＋</SizeBtn>
              <span className="ml-2 flex gap-1">
                {(["25%", "50%", "75%", "100%"] as const).map((w) => (
                  <SizeBtn
                    key={w}
                    onClick={() => editor.chain().focus().updateAttributes("resizableImage", { width: w }).run()}
                  >
                    {w}
                  </SizeBtn>
                ))}
              </span>
            </>
          ) : (
            <span className="flex gap-1">
              {(["50%", "75%", "100%"] as const).map((w) => (
                <SizeBtn
                  key={w}
                  onClick={() => editor.chain().focus().updateAttributes("video", { width: w }).run()}
                >
                  {w}
                </SizeBtn>
              ))}
            </span>
          )}
        </div>
      )}

      {uploadError && (
        <div className="px-3 py-2 border-t border-destructive/30 bg-destructive/10 text-xs text-destructive-foreground">
          {uploadError}
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-primary/15 text-primary hover:bg-primary/20",
      )}
    >
      {children}
    </button>
  );
}

function SizeBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded-md border border-border/40 text-foreground/80 hover:bg-card/60 hover:text-primary transition-colors"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-border/60 mx-1" />;
}

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = editor.getAttributes("textStyle").color || "#f5e6cc";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/40 hover:border-border text-xs text-foreground/80"
      >
        <span className="w-3.5 h-3.5 rounded-sm border border-white/10" style={{ background: current }} />
        <span>색상</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 p-2 rounded-xl bg-popover border border-border shadow-2xl backdrop-blur grid grid-cols-5 gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="w-6 h-6 rounded-md border border-white/10 hover:scale-110 transition-transform"
              style={{ background: c }}
              onClick={() => {
                editor.chain().focus().setColor(c).run();
                setOpen(false);
              }}
            />
          ))}
          <button
            type="button"
            className="col-span-5 mt-1 text-xs text-muted-foreground hover:text-foreground py-1"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
          >
            색상 지우기
          </button>
        </div>
      )}
    </div>
  );
}
