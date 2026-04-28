import DOMPurify from "dompurify";
import { useMemo } from "react";

interface Props {
  html: string;
  className?: string;
}

const PURIFY_CONFIG = {
  ADD_TAGS: ["video"],
  ADD_ATTR: ["controls", "playsinline", "data-align", "target", "rel"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

export function RichContent({ html, className }: Props) {
  const safe = useMemo(() => DOMPurify.sanitize(html, PURIFY_CONFIG), [html]);
  return (
    <div
      className={className ?? "rich-content"}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
