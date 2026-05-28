import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Heading2 } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[120px] focus:outline-none px-3 py-2",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || "") !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const btn = "h-8 w-8";
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
      <Button type="button" size="icon" variant={editor.isActive("bold") ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("italic") ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("underline") ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("bulletList") ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("orderedList") ? "secondary" : "ghost"} className={btn} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={editor.isActive("link") ? "secondary" : "ghost"} className={btn} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}