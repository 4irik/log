FILES ?= /app

help: ## Show this help
	@printf "\033[33m%s:\033[0m\n" 'Available commands'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[32m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: ## Check markdonw files to compliance with rules
	docker run --rm \
		-v ./:/app \
		-w /app \
    	-e INPUT_RULES=/lint/rules/changelog.js \
    	-e INPUT_CONFIG=/lint/config/changelog.yml \
    	avtodev/markdown-lint:v1.5.0 \
    	$(FILES)

fix: ## Fix markup in markdown files
	docker run --rm \
		-v ./:/app \
		-w /app \
    	-e INPUT_RULES=/lint/rules/changelog.js \
    	-e INPUT_CONFIG=/lint/config/changelog.yml \
		-e INPUT_FIX=true \
    	avtodev/markdown-lint:v1.5.0 \
    	$(FILES)
