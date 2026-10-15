// docx-preview copies a document's hyperlink targets straight into href
// attributes, and a resume is untrusted input, so a link like javascript:... would
// otherwise land in the page. Run this over the rendered output: only web and
// mail links (and in-document anchors) keep their href, and real links open in a
// new tab without handing the page to the destination.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function sanitizeLinks(root: ParentNode) {
  for (const link of root.querySelectorAll("a[href]")) {
    const href = (link.getAttribute("href") ?? "").trim();

    if (href.startsWith("#")) continue;

    let protocol: string | null = null;
    try {
      protocol = new URL(href).protocol;
    } catch {
      // Relative or malformed: nothing sensible to link to from a preview.
    }

    if (protocol && ALLOWED_PROTOCOLS.has(protocol)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.removeAttribute("href");
      link.removeAttribute("target");
    }
  }
}
