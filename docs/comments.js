// Renders the GitHub issue thread for a post into <section id="comments">.
// Convention: one open issue per post; the issue body links to the post file
// ("/post/<slug>.md" or "/post/<slug>.en.md") or repeats the post title.
// Older posts link the issue directly in the text, that link wins.
// <name>.en.html pages share the issue thread of their <name> pair.
(function () {
	var section = document.getElementById('comments');
	if (!section) return;

	var m = location.pathname.match(/\/post\/([^/]+)\.html$/);
	if (!m) return;
	var isEn = /\.en$/.test(m[1]);
	var slug = m[1].replace(/\.en$/, '');
	var postFile = 'docs/post/' + slug + (isEn ? '.en' : '') + '.md';

	var REPO = '4irik/log';
	var API = 'https://api.github.com/repos/' + REPO;
	var WEB = 'https://github.com/' + REPO;
	var title = (document.querySelector('h1') || {}).textContent || document.title;
	var en = (document.documentElement.lang || 'ru').indexOf('en') === 0;
	var t = en ? {
		heading: 'Comments',
		empty: 'No comments yet.',
		add: 'Add a comment on GitHub',
		discuss: 'Discuss on GitHub',
		failed: 'Could not load comments.',
		see: 'View on GitHub'
	} : {
		heading: 'Комментарии',
		empty: 'Комментариев пока нет.',
		add: 'Добавить комментарий на GitHub',
		discuss: 'Обсудить на GitHub',
		failed: 'Не удалось загрузить комментарии.',
		see: 'Смотреть на GitHub'
	};

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
					var body = it.body || '';
					if (body.indexOf('/post/' + slug + '.md') !== -1 ||
						body.indexOf('/post/' + slug + '.en.md') !== -1 ||
						it.title === title) {
						return it.number;
					}
				}
				return null;
			});
	}

	function fmtDate(iso) {
		return new Date(iso).toLocaleDateString(en ? 'en-US' : 'ru-RU', {
			day: 'numeric', month: 'long', year: 'numeric'
		});
	}

	function renderThread(number, comments) {
		var html = '<h2>' + t.heading + '</h2>';
		if (!comments.length) {
			html += '<p>' + t.empty + '</p>';
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
			t.add + '</a></p>';
		section.innerHTML = html;
	}

	function renderNewIssueLink() {
		var url = WEB + '/issues/new?title=' + encodeURIComponent(title) +
			'&body=' + encodeURIComponent('**Пост:** https://github.com/' + REPO + '/blob/main/' + postFile);
		section.innerHTML = '<h2>' + t.heading + '</h2>' +
			'<p>' + t.empty + ' <a href="' + url + '">' + t.discuss + '</a></p>';
	}

	function renderFallback() {
		section.innerHTML = '<h2>' + t.heading + '</h2>' +
			'<p>' + t.failed + ' <a href="' + WEB + '/issues">' + t.see + '</a></p>';
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
