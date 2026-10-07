FILES ?= /app
CONTAINER ?= podman

.PHONY: help check fix site serve

help: ## Show this help
	@printf "\033[33m%s:\033[0m\n" 'Available commands'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[32m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: ## Check markdonw files to compliance with rules
	$(CONTAINER) run --rm \
		-v ./:/app:Z \
		-w /app \
    	avtodev/markdown-lint:v1.5.0 \
    	$(FILES)

fix: ## Fix markup in markdown files
	$(CONTAINER) run --rm \
		-v ./:/app:Z \
		-w /app \
		-e INPUT_FIX=true \
    	avtodev/markdown-lint:v1.5.0 \
    	$(FILES)

site: ## Build the static site into docs/ (GitHub Pages source)
	@for f in docs/post/*.md; do \
		d=$$(git log --follow --diff-filter=A --format=%cd --date=short -- "$$f" | tail -1); \
		printf '%s %s\n' "$$d" "$$f"; \
	done > docs/.dates
	$(CONTAINER) run --rm \
		-v ./:/app:Z \
		-w /app \
		--entrypoint sh \
		docker.io/pandoc/core:3 \
		build.sh

serve: site ## Build the site and preview it at http://localhost:8000
	python3 -m http.server 8000 -d docs
