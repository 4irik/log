#!/bin/sh
# Builds the static site into docs/ (GitHub Pages source).
# Sources live in docs/ itself: docs/post/*.md (ru), docs/post/*.en.md (en), docs/assets/.
# Post pair convention: <name>.en.md is the English version of <name>.md.
# Runs inside the pandoc container, see `make site`.
set -eu

SITE_URL="${SITE_URL:-https://4irik.github.io/log}"
TITLE='0blog'
DESC='Технический блог: посты — markdown-файлы, комментарии — GitHub issues.'
CONTACTS_RU='Связь: [Telegram](https://t.me/jAa1l), [LinkedIn](https://www.linkedin.com/in/kirill-cherednichenko)\
Почитать: [Блог в ТГ](https://t.me/stdi0_h)\
Резюме: [RU](assets/cv/resume-ru.pdf) · [EN](assets/cv/resume-en.pdf)'
CONTACTS_EN='Contact: [Telegram](https://t.me/jAa1l), [LinkedIn](https://www.linkedin.com/in/kirill-cherednichenko)\
Read: [Telegram blog](https://t.me/stdi0_h) (in Russian)\
CV: [RU](assets/cv/resume-ru.pdf) · [EN](assets/cv/resume-en.pdf)'

OUT=docs

# remove only generated files: docs/post/*.md, docs/assets/, docs/style.css are sources
rm -f "$OUT"/post/*.html "$OUT"/index.html "$OUT"/en.html "$OUT"/llms.txt \
	"$OUT"/llms-full.txt "$OUT"/.index.md "$OUT"/.index-en.md \
	"$OUT"/.entries "$OUT"/.entries-en "$OUT"/.merged

# docs/.dates is generated on the host by `make site`:
# "<commit-date> docs/post/<name>.md" per post, absent means not committed yet
dates="$OUT/.dates"
index="$OUT/.index.md"
index_en="$OUT/.index-en.md"
entries="$OUT/.entries"
entries_en="$OUT/.entries-en"
merged="$OUT/.merged"
printf '# <span class="mono">0b</span>log <a href="en.html" class="lang">[en]</a>\n\n' > "$index"
[ ! -f "$OUT/about.md" ] || { cat "$OUT/about.md"; printf '\n'; } >> "$index"
printf '\n%s\n\n## Посты\n\n' "$CONTACTS_RU" >> "$index"
printf '# <span class="mono">0b</span>log <a href="index.html" class="lang">[ru]</a>\n\n' > "$index_en"
[ ! -f "$OUT/about.en.md" ] || { cat "$OUT/about.en.md"; printf '\n'; } >> "$index_en"
printf '\n%s\n\n## Posts\n\n' "$CONTACTS_EN" >> "$index_en"
printf '# %s\n\n' "$TITLE" > "$OUT/llms.txt"
[ ! -f "$OUT/about.md" ] || { cat "$OUT/about.md"; printf '\n'; } >> "$OUT/llms.txt"
printf '\n%s\n\n## Посты\n\n' "$CONTACTS_RU" >> "$OUT/llms.txt"
printf '# %s\n\n%s\n\n' "$TITLE" "$DESC" > "$OUT/llms-full.txt"
[ ! -f "$OUT/about.md" ] || cat "$OUT/about.md" >> "$OUT/llms-full.txt"
printf '\n%s\n' "$CONTACTS_RU" >> "$OUT/llms-full.txt"
: > "$entries"
: > "$entries_en"

comments_footer_ru='\n\n<section id="comments">\n<h2>Комментарии</h2>\n<p><a href="https://github.com/4irik/log/issues">Комментарии на GitHub</a></p>\n</section>\n<script src="../comments.js"></script>\n'
comments_footer_en='\n\n<section id="comments">\n<h2>Comments</h2>\n<p><a href="https://github.com/4irik/log/issues">Comments on GitHub</a></p>\n</section>\n<script src="../comments.js"></script>\n'

for src in "$OUT"/post/*.md; do
	case "$src" in *.en.md) continue;; esac
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
		printf "$comments_footer_ru"
	} | pandoc --standalone --from gfm --syntax-highlighting=none \
		--metadata lang=ru --metadata document-css=false \
		--metadata pagetitle="$title" --css ../style.css \
		--output "$OUT/post/$name.html"

	printf '%s|%s|%s|ru\n' "$date" "$title" "$name" >> "$entries"
done

for src in "$OUT"/post/*.en.md; do
	[ -e "$src" ] || continue
	name="$(basename "$src" .en.md)"
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
		printf "$comments_footer_en"
	} | pandoc --standalone --from gfm --syntax-highlighting=none \
		--metadata lang=en --metadata document-css=false \
		--metadata pagetitle="$title" --css ../style.css \
		--output "$OUT/post/$name.en.html"

	printf '%s|%s|%s|en\n' "$date" "$title" "$name" >> "$entries_en"
done

# llms.txt stays ru-only
sort -r "$entries" | while IFS='|' read -r date title name lang; do
	printf -- '- [%s](%s/post/%s.md) — %s\n' "$title" "$SITE_URL" "$name" "$date" >> "$OUT/llms.txt"
	{
		printf '\n\n---\n\n<%s/post/%s.md> (%s)\n\n' "$SITE_URL" "$name" "$date"
		cat "$OUT/post/$name.md"
	} >> "$OUT/llms-full.txt"
done

# merge both languages into "date|name|ru_title|en_title", ru date wins for a pair
cat "$entries" "$entries_en" | awk -F'|' '
	{
		name = $3
		if (!(name in date) || $4 == "ru") date[name] = $1
		if ($4 == "ru") ru[name] = $2; else en[name] = $2
	}
	END {
		for (n in date)
			printf "%s|%s|%s|%s\n", date[n], n, ru[n], en[n]
	}
' | sort -r > "$merged"

# newest posts first; [en]/[ru] marks the version in the other language
while IFS='|' read -r date name rt et; do
	if [ -n "$rt" ]; then
		printf -- '- %s — [%s](post/%s.html)' "$date" "$rt" "$name" >> "$index"
	else
		printf -- '- %s — [%s](post/%s.en.html)' "$date" "$et" "$name" >> "$index"
	fi
	if [ -n "$et" ]; then
		printf -- '- %s — [%s](post/%s.en.html)' "$date" "$et" "$name" >> "$index_en"
	else
		printf -- '- %s — [%s](post/%s.html)' "$date" "$rt" "$name" >> "$index_en"
	fi
	if [ -n "$rt" ] && [ -n "$et" ]; then
		printf ' [[en]](post/%s.en.html)' "$name" >> "$index"
		printf ' [[ru]](post/%s.html)' "$name" >> "$index_en"
	fi
	printf '\n' >> "$index"
	printf '\n' >> "$index_en"
done < "$merged"

pandoc --standalone --from gfm --syntax-highlighting=none \
	--metadata lang=ru --metadata document-css=false \
	--metadata pagetitle="$TITLE" --css style.css \
	--output "$OUT/index.html" "$index"

pandoc --standalone --from gfm --syntax-highlighting=none \
	--metadata lang=en --metadata document-css=false \
	--metadata pagetitle="$TITLE" --css style.css \
	--output "$OUT/en.html" "$index_en"

rm "$index" "$index_en" "$entries" "$entries_en" "$merged" "$dates"

# drop the leftover inline <style> block from pandoc's default template:
# document-css=false does not cover a few unconditional rules, we use external css only
sed -i '/<style>/,/<\/style>/d' "$OUT"/post/*.html "$OUT"/index.html "$OUT"/en.html

touch "$OUT/.nojekyll"
