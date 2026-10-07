// Renders the GitHub issue thread for a post into <section id="comments">.
// Convention: one open issue per post; the issue body links to the post file
// ("/post/<slug>.md") or repeats the post title. Older posts link the issue
// directly in the text, that link wins.
(function () {
	var section = document.getElementById('comments');
	if (!section) return;

	var m = location.pathname.match(/\/post\/([^/]+)\.html$/);
	if (!m) return;
	var slug = m[1];

	var REPO = '4irik/log';
	var API = 'https://api.github.com/repos/' + REPO;
	var WEB = 'https://github.com/' + REPO;
	var title = (document.querySelector('h1') || {}).textContent || document.title;

	var headers = { Accept: 'application/vnd.github.html+json' };

	function esc(s) {
		return s.replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}

	function issueNumberFromLink() {
		var links = document.querySelectorAll('a[href*="github.com/' + REPO + '/issues/"]');
		for (var i = 0; i < links.length; i++) {
			var n = links[i].href.match(/issues\/(\d+)/);
			if (n) return n[1];
		}
		return null;
	}

	function findIssueNumber() {
		var n = issueNumberFromLink();
		if (n) return Promise.resolve(n);
		return fetch(API + '/issues?state=all&per_page=100', { headers: headers })
			.then(function (r) { return r.json(); })
			.then(function (issues) {
				for (var i = 0; i < issues.length; i++) {
					var it = issues[i];
					if (it.pull_request) continue;
					if ((it.body || '').indexOf('/post/' + slug + '.md') !== -1 ||
						it.title === title) {
						return it.number;
					}
				}
				return null;
			});
	}

	function fmtDate(iso) {
		return new Date(iso).toLocaleDateString('ru-RU', {
			day: 'numeric', month: 'long', year: 'numeric'
		});
	}

	function renderThread(number, comments) {
		var html = '<h2>Комментарии</h2>';
		if (!comments.length) {
			html += '<p>Комментариев пока нет.</p>';
		}
		for (var i = 0; i < comments.length; i++) {
			var c = comments[i];
			html += '<div class="comment">' +
				'<p class="date"><a href="' + c.user.html_url + '">' + esc(c.user.login) + '</a>, ' +
				fmtDate(c.created_at) + '</p>' +
				(c.body_html || '<p>' + esc(c.body || '') + '</p>') +
				'</div>';
		}
		html += '<p><a href="' + WEB + '/issues/' + number + '#new_comment_field">' +
			'Добавить комментарий на GitHub</a></p>';
		section.innerHTML = html;
	}

	function renderNewIssueLink() {
		var url = WEB + '/issues/new?title=' + encodeURIComponent(title) +
			'&body=' + encodeURIComponent('**Пост:** https://github.com/' + REPO + '/blob/main/docs/post/' + slug + '.md');
		section.innerHTML = '<h2>Комментарии</h2>' +
			'<p>Комментариев пока нет. <a href="' + url + '">Обсудить на GitHub</a></p>';
	}

	function renderFallback() {
		section.innerHTML = '<h2>Комментарии</h2>' +
			'<p>Не удалось загрузить комментарии. <a href="' + WEB + '/issues">Смотреть на GitHub</a></p>';
	}

	findIssueNumber()
		.then(function (number) {
			if (number === null) {
				renderNewIssueLink();
				return;
			}
			fetch(API + '/issues/' + number + '/comments?per_page=100', { headers: headers })
				.then(function (r) { return r.json(); })
				.then(function (comments) { renderThread(number, comments); })
				.catch(renderFallback);
		})
		.catch(renderFallback);
})();
