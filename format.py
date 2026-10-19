#!/usr/bin/env python3
# Reindent generated HTML in docs/. Runs after build.sh, see `make site`.
# Needs `pip install djhtml` (and lxml is not required).
import glob
import re
from djhtml.modes import DjHTML


def _unescape(m):
    s = m.group(0)
    head, body = s[: s.index(">") + 1], s[s.index(">") + 1 :]
    return head + body.replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", '"')

for path in glob.glob("docs/**/*.html", recursive=True):
    with open(path) as f:
        out = DjHTML(f.read()).indent(tabwidth=2)
    # shortcut: djhtml indents closing-tag lines even inside <pre>, strip it back
    out = re.sub(r"\n[ \t]+(?=</(?:code></pre|pre))", "\n", out)
    # pandoc over-escapes: in text content only &lt; and &amp; are required
    out = re.sub(r"<pre[\s>].*?</pre>", _unescape, out, flags=re.S)
    with open(path, "w") as f:
        f.write(out if out.endswith("\n") else out + "\n")
