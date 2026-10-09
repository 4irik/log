#!/bin/sh
# Builds the static site into docs/ (GitHub Pages source).
# Sources live in docs/ itself: docs/post/*.md, docs/assets/.
# Runs inside the pandoc container, see `make site`.
set -eu

SITE_URL="${SITE_URL:-https://4irik.github.io/log}"
TITLE='Б_лог'
DESC='Технический блог: посты — markdown-файлы, комментарии — GitHub issues.'
CONTACTS='[тг](https://t.me/jAa1l), [блог в тг](https://t.me/stdi0_h), [LinkedIn](https://www.linkedin.com/in/kirill-cherednichenko), CV: [ru](assets/cv/resume-ru.pdf), [en](assets/cv/resume-en.pdf)'

OUT=docs

# remove only generated files: docs/post/*.md, docs/assets/, docs/style.css are sources
rm -f "$OUT"/post/*.html "$OUT"/index.html "$OUT"/llms.txt \
	"$OUT"/llms-full.txt "$OUT"/.index.md "$OUT"/.entries

# docs/.dates is generated on the host by `make site`:
# "<commit-date> docs/post/<name>.md" per post, absent means not committed yet
dates="$OUT/.dates"
index="$OUT/.index.md"
entries="$OUT/.entries"
printf '# %s\n\nКонтакты: %s\n\n## Посты\n\n' "$TITLE" "$CONTACTS" > "$index"
printf '# %s\n\n> Контакты: %s\n\n## Посты\n\n' "$TITLE" "$CONTACTS" > "$OUT/llms.txt"
printf '# %s\n\n%s\n' "$TITLE" "$DESC" > "$OUT/llms-full.txt"
: > "$entries"

for src in "$OUT"/post/*.md; do
	name="$(basename "$src" .md)"
	title="$(sed -n 's/^#\+ *//p' "$src" | head -n1)"
	[ -n "$title" ] || title="$name"

	date="$(awk -v s="$src" '$2==s {print $1; exit}' "$dates" 2>/dev/null)"
	[ -n "$date" ] || date="$(date +%F)"

	{
		awk -v d="$date" '
			!done && /^#+ / {
				print
				print ""
				print "<p class=\"date\">" d "</p>"
				print ""
				done = 1
				next
			}
			{ print }
		' "$src"
		printf '\n\n<section id="comments">\n<h2>Комментарии</h2>\n<p><a href="https://github.com/4irik/log/issues">Комментарии на GitHub</a></p>\n</section>\n<script src="../comments.js"></script>\n'
	} | pandoc --standalone --from gfm --syntax-highlighting=none \
		--metadata lang=ru --metadata document-css=false \
		--metadata pagetitle="$title" --css ../style.css \
		--output "$OUT/post/$name.html"

	printf '%s|%s|%s\n' "$date" "$title" "$name" >> "$entries"
done

# newest posts first
sort -r "$entries" | while IFS='|' read -r date title name; do
	printf -- '- %s — [%s](post/%s.html)\n' "$date" "$title" "$name" >> "$index"
	printf -- '- [%s](%s/post/%s.md) — %s\n' "$title" "$SITE_URL" "$name" "$date" >> "$OUT/llms.txt"
	{
		printf '\n\n---\n\n<%s/post/%s.md> (%s)\n\n' "$SITE_URL" "$name" "$date"
		cat "$OUT/post/$name.md"
	} >> "$OUT/llms-full.txt"
done

pandoc --standalone --from gfm --syntax-highlighting=none \
	--metadata lang=ru --metadata document-css=false \
	--metadata pagetitle="$TITLE" --css style.css \
	--output "$OUT/index.html" "$index"
rm "$index" "$entries" "$dates"

# drop the leftover inline <style> block from pandoc's default template:
# document-css=false does not cover a few unconditional rules, we use external css only
sed -i '/<style>/,/<\/style>/d' "$OUT"/post/*.html "$OUT"/index.html

touch "$OUT/.nojekyll"
