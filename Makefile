# Sonaryx Bot Makefile

.PHONY: help start stop build up down logs check-releases setup db-setup clean install dump-artists load-artists

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

up: ## Start Docker containers with auto-load of latest artist backup
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

daily-check: ## Manually trigger daily release check (for testing)
	@echo "📅 Triggering manual daily release check..."
	docker exec sonaryx-server node scripts/testDailyCheck.js

# Utility commands
clean: ## Clean up generated files and containers
	docker-compose down --volumes --remove-orphans 2>/dev/null || true
	docker system prune -f 2>/dev/null || true
	rm -rf node_modules generated data/dev.db
	@echo "✅ Cleanup completed!"

# Database management
db-reset: ## Reset database (WARNING: This will delete all data!)
	@echo "⚠️  This will delete all subscribed artists!"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		[Yy]*) rm -f data/dev.db; npx prisma db push; echo "✅ Database reset completed!" ;; \
		*) echo "❌ Database reset cancelled." ;; \
	esac

db-studio: ## Open Prisma Studio to view database
	npx prisma studio

# Artist backup and restore
dump-artists: ## Create a backup dump of all subscribed artists
	@echo "📦 Creating artist subscription backup..."
	docker exec sonaryx-server node scripts/dumpArtists.js

dump-artists-local: ## Create artist backup using local database (for development)
	@echo "📦 Creating artist subscription backup (local)..."
	node scripts/dumpArtists.js

load-artists: ## Load artists from the most recent backup dump
	@echo "📥 Loading artists from backup dump..."
	@echo "⚠️  This will subscribe to all artists in the dump file."
	@printf "Continue? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		[Yy]*) docker exec sonaryx-server node scripts/loadArtists.js ;; \
		*) echo "❌ Artist load cancelled." ;; \
	esac

load-artists-file: ## Load artists from a specific dump file (Usage: make load-artists-file FILE=path/to/dump.json)
	@echo "📥 Loading artists from specified file..."
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Please specify a file: make load-artists-file FILE=path/to/dump.json"; \
	else \
		docker exec sonaryx-server node scripts/loadArtists.js $(FILE); \
	fi

load-artists-local: ## Load artists using local database (for development)
	@echo "📥 Loading artists from backup dump (local)..."
	@echo "⚠️  This will subscribe to all artists in the dump file."
	@printf "Continue? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		[Yy]*) node scripts/loadArtists.js ;; \
		*) echo "❌ Artist load cancelled." ;; \
	esac

dry-run-load: ## Preview what would be loaded from the most recent backup (no changes made)
	@echo "🧪 Dry run: previewing artist load..."
	docker exec sonaryx-server node scripts/loadArtists.js --dry-run

# Quick shortcuts
bot: start ## Alias for 'start'
releases: check-releases ## Alias for 'check-releases'
studio: db-studio ## Alias for 'db-studio'
dump: dump-artists ## Alias for 'dump-artists'
load: load-artists ## Alias for 'load-artists'

# Docker database management
docker-db-studio: ## Open Prisma Studio for Docker database
	docker exec -it sonaryx-server npx prisma studio