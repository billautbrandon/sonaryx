# Sonaryx Bot Makefile

.PHONY: help start stop build up down logs check-releases setup db-setup clean install

# Default target
help: ## Show this help message
	@echo "🎵 Sonaryx Bot Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Development commands
install: ## Install dependencies
	npm install

setup: install db-setup ## Complete setup (install + database)
	@echo "✅ Setup completed!"

db-setup: ## Setup database (generate Prisma client and push schema)
	npx prisma generate
	npx prisma db push
	@echo "✅ Database setup completed!"

start: ## Start the Discord bot locally
	npm start

# Docker commands
build: ## Build Docker image
	npm run docker:build

up: ## Start Docker containers
	npm run docker:up

down: ## Stop Docker containers
	npm run docker:down

logs: ## View Docker container logs
	npm run docker:logs

# Release checking
check-releases: ## Check latest releases for all subscribed artists (sends to Discord)
	@echo "🔍 Checking releases for all subscribed artists..."
	docker exec sonaryx-server node scripts/checkReleases.js --discord

check-releases-console: ## Check releases (console output only)
	@echo "🔍 Checking releases (console only)..."
	docker exec sonaryx-server node scripts/checkReleases.js

check-releases-local: ## Check releases using local database (for development)
	@echo "🔍 Checking releases using local database..."
	node scripts/checkReleases.js

# Utility commands
clean: ## Clean up generated files and containers
	docker-compose down --volumes --remove-orphans 2>/dev/null || true
	docker system prune -f 2>/dev/null || true
	rm -rf node_modules generated data/dev.db
	@echo "✅ Cleanup completed!"

# Database management
db-reset: ## Reset database (WARNING: This will delete all data!)
	@echo "⚠️  This will delete all subscribed artists!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		rm -f data/dev.db; \
		npx prisma db push; \
		echo "✅ Database reset completed!"; \
	else \
		echo "❌ Database reset cancelled."; \
	fi

db-studio: ## Open Prisma Studio to view database
	npx prisma studio

# Quick shortcuts
bot: start ## Alias for 'start'
releases: check-releases ## Alias for 'check-releases'
studio: db-studio ## Alias for 'db-studio'

# Docker database management
docker-db-studio: ## Open Prisma Studio for Docker database
	docker exec -it sonaryx-server npx prisma studio