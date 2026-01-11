import { useEffect } from "react";

type PageMetaProps = {
  title: string;
  description?: string;
};

function setMetaTag({
  selector,
  attribute,
  content,
}: {
  selector: string;
  attribute: "name" | "property";
  content: string;
}) {
  const existing = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${selector}"]`);
  if (existing) {
    existing.setAttribute("content", content);
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute(attribute, selector);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

export function PageMeta({ title, description }: PageMetaProps) {
  useEffect(() => {
    document.title = title;
    if (description) {
      setMetaTag({ selector: "description", attribute: "name", content: description });
      setMetaTag({ selector: "og:title", attribute: "property", content: title });
      setMetaTag({ selector: "og:description", attribute: "property", content: description });
    } else {
      setMetaTag({ selector: "og:title", attribute: "property", content: title });
    }
  }, [title, description]);

  return null;
}
