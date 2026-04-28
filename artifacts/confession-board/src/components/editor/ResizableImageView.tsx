import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useRef, useState, useEffect } from "react";

const ALIGN_TO_FLEX: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverWidth, setHoverWidth] = useState<string | null>(null);

  const width = (node.attrs.width as string) || "100%";
  const align = (node.attrs.align as string) || "left";

  useEffect(() => {
    if (!dragging) setHoverWidth(null);
  }, [dragging]);

  const startDrag = (
    e: React.PointerEvent,
    corner: "br" | "bl" | "tr" | "tl",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    const img = imgRef.current;
    if (!wrapper || !img) return;

    const containerWidth = wrapper.parentElement?.clientWidth ?? wrapper.clientWidth;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = img.getBoundingClientRect();
    const startPx = rect.width;
    const aspect = rect.height / rect.width || 1;

    const dirX = corner === "br" || corner === "tr" ? 1 : -1;
    const dirY = corner === "br" || corner === "bl" ? 1 : -1;

    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * dirX;
      const dy = ((ev.clientY - startY) * dirY) / aspect;
      const delta = Math.max(dx, dy);
      const nextPx = Math.max(60, Math.min(containerWidth, startPx + delta));
      const nextPct = Math.round((nextPx / containerWidth) * 100);
      const clamped = Math.max(15, Math.min(100, nextPct));
      const nextWidth = `${clamped}%`;
      setHoverWidth(nextWidth);
      wrapper.style.width = nextWidth;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const final = wrapper.style.width || width;
      setDragging(false);
      updateAttributes({ width: final });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper
      as="div"
      className="resizable-image-wrapper"
      style={{
        display: "flex",
        justifyContent: ALIGN_TO_FLEX[align] ?? "flex-start",
        margin: "0.75rem 0",
      }}
    >
      <div
        ref={wrapperRef}
        data-drag-handle
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          display: "inline-block",
          outline:
            selected || dragging ? "2px solid hsl(var(--primary))" : "none",
          outlineOffset: 2,
          borderRadius: "0.75rem",
          cursor: "grab",
        }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          draggable={false}
          className="editor-image"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            borderRadius: "0.75rem",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        {(selected || dragging) && (
          <>
            <ResizeHandle corner="tl" onPointerDown={(e) => startDrag(e, "tl")} />
            <ResizeHandle corner="tr" onPointerDown={(e) => startDrag(e, "tr")} />
            <ResizeHandle corner="bl" onPointerDown={(e) => startDrag(e, "bl")} />
            <ResizeHandle corner="br" onPointerDown={(e) => startDrag(e, "br")} />
            {dragging && hoverWidth && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 500,
                  pointerEvents: "none",
                }}
              >
                {hoverWidth}
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function ResizeHandle({
  corner,
  onPointerDown,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const pos: Record<string, number> = {};
  if (corner.startsWith("t")) pos.top = -7;
  else pos.bottom = -7;
  if (corner.endsWith("l")) pos.left = -7;
  else pos.right = -7;

  const cursor =
    corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        ...pos,
        width: 14,
        height: 14,
        borderRadius: 4,
        background: "hsl(var(--primary))",
        border: "2px solid hsl(var(--background))",
        cursor,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        touchAction: "none",
      } as React.CSSProperties}
    />
  );
}
