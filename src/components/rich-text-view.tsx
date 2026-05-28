import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

export function RichTextView({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
  return (
    <div
      className={cn("prose prose-sm max-w-none break-words [&_a]:text-primary [&_a]:underline", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}