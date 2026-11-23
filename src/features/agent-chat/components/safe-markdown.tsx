import Markdown, { defaultUrlTransform } from "react-markdown";

// Agent replies are markdown from outside Pioneer. Rendered without any raw HTML (skipHtml), with
// a short list of allowed elements (no images, so no tracking pixels), and links limited to
// http(s)/mailto, opening in a new tab without referrer or opener.
const ALLOWED = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
];

export function safeUrl(url: string): string {
  const cleaned = defaultUrlTransform(url);
  return /^(https?:|mailto:)/i.test(cleaned) ? cleaned : "";
}

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="prose-chat flex flex-col gap-2 [&_a]:underline [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-black/5 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={safeUrl}
        components={{
          a: ({ href, children: label }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {label}
              </a>
            ) : (
              <span>{label}</span>
            ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
