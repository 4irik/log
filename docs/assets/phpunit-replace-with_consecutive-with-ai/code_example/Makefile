PHPUNIT10_PHAR=phpunit-10.5.53.phar
PHPUNIT9_PHAR=phpunit-9.6.25.phar
PHP=php:8.3-cli-alpine

help: ## Show this help
	@printf "\033[33m%s:\033[0m\n" 'Available commands'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[32m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Download phpunit-10 and phpunit-9 phar archives
	curl -L -o $(PHPUNIT10_PHAR) https://phar.phpunit.de/$(PHPUNIT10_PHAR)
	curl -L -o $(PHPUNIT9_PHAR) https://phar.phpunit.de/$(PHPUNIT9_PHAR)
	chmod +x $(PHPUNIT10_PHAR) $(PHPUNIT9_PHAR)

unit10: ## Run tests for phpunit-10 with trait
	docker run --rm -v ./:/app -w /app $(PHP) php $(PHPUNIT10_PHAR) TestPhpunit10.php

unit10native: ## Run tests for phpunit-10 with `willReturnCallback`
	docker run --rm -v ./:/app -w /app $(PHP) php $(PHPUNIT10_PHAR) TestPhpunit10Native.php


unit9: ## Run tests for phpunit-9
	docker run --rm -v ./:/app -w /app $(PHP) php $(PHPUNIT9_PHAR) TestPhpunit9.php
