import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImageView } from "./ResizableImageView";

export const ResizableImage = Image.extend({
  name: "resizableImage",
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (el) => el.getAttribute("width") || el.style.width || "100%",
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}` };
        },
      },
      align: {
        default: "left",
        parseHTML: (el) => el.getAttribute("data-align") || "left",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "editor-image" } });

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      width: {
        default: "100%",
        parseHTML: (el) => el.getAttribute("width") || el.style.width || "100%",
        renderHTML: (attrs) => ({ width: attrs.width, style: `width: ${attrs.width}` }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        playsinline: "true",
        class: "editor-video",
      }),
    ];
  },
});

const FONT_SIZE_REGEX = /^\d+(\.\d+)?(px|rem|em)$/;

export const FontSize = TextStyle.extend({
  name: "fontSize",
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (size: string) =>
        ({ chain }) => {
          if (size && !FONT_SIZE_REGEX.test(size)) return false;
          return chain().setMark("textStyle", { fontSize: size }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}
