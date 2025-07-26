#!/bin/bash

# yToo Production Deployment Script
# This script automates the deployment process for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production.local"
BACKUP_DIR="backups"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found"
        log_info "Please copy .env.production to $ENV_FILE and configure it"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

validate_environment() {
    log_info "Validating environment configuration..."
    
    # Source environment file
    export $(cat $ENV_FILE | grep -v '^#' | xargs)
    
    # Check critical environment variables
    REQUIRED_VARS=(
        "DATABASE_URL"
        "JWT_SECRET"
        "POSTGRES_DB"
        "POSTGRES_USER"
        "POSTGRES_PASSWORD"
        "NODE_ENV"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check if JWT_SECRET is secure (at least 32 characters)
    if [ ${#JWT_SECRET} -lt 32 ]; then
        log_error "JWT_SECRET must be at least 32 characters long"
        exit 1
    fi
    
    # Check if default passwords are changed
    if [[ "$POSTGRES_PASSWORD" == "CHANGE_THIS_PASSWORD" ]]; then
        log_error "Please change the default POSTGRES_PASSWORD"
        exit 1
    fi
    
    if [[ "$JWT_SECRET" == *"CHANGE_THIS"* ]]; then
        log_error "Please change the default JWT_SECRET"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

create_backup() {
    log_info "Creating database backup..."
    
    # Create backup directory
    mkdir -p $BACKUP_DIR
    
    # Check if database is running
    if docker-compose -f $COMPOSE_FILE ps postgres | grep -q "Up"; then
        # Create backup using the migration script
        if node scripts/migrate-production.js backup; then
            log_success "Database backup created"
        else
            log_warning "Failed to create database backup, continuing anyway..."
        fi
    else
        log_info "Database not running, skipping backup"
    fi
}

build_and_deploy() {
    log_info "Building and deploying application..."
    
    # Pull latest images
    log_info "Pulling latest base images..."
    docker-compose -f $COMPOSE_FILE pull postgres redis nginx
    
    # Build application images
    log_info "Building application images..."
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
    
    log_success "Application deployed"
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    if node scripts/migrate-production.js migrate; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        exit 1
    fi
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for services to start
    sleep 15
    
    # Check service status
    log_info "Checking service status..."
    docker-compose -f $COMPOSE_FILE ps
    
    # Check health endpoint
    log_info "Checking application health..."
    for i in {1..30}; do
        if curl -f http://localhost/health &> /dev/null; then
            log_success "Application health check passed"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "Application health check failed after 30 attempts"
            log_info "Checking application logs..."
            docker-compose -f $COMPOSE_FILE logs --tail=50 backend
            exit 1
        fi
        
        log_info "Waiting for application to start... (attempt $i/30)"
        sleep 2
    done
    
    # Verify database migrations
    if node scripts/migrate-production.js verify; then
        log_success "Database verification passed"
    else
        log_error "Database verification failed"
        exit 1
    fi
    
    log_success "Deployment verification completed"
}

show_status() {
    log_info "Deployment Status:"
    echo "===================="
    
    # Show service status
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    log_info "Application URLs:"
    echo "Health Check: http://localhost/health"
    echo "Application: http://localhost/"
    
    if [ -f "nginx/ssl/cert.pem" ]; then
        echo "HTTPS Application: https://localhost/"
    fi
    
    echo ""
    log_info "Useful Commands:"
    echo "View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
    echo "Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "Restart service: docker-compose -f $COMPOSE_FILE restart [service]"
}

cleanup_old_images() {
    log_info "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old application images (keep last 3)
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | \
    grep "ytoo" | \
    tail -n +4 | \
    awk '{print $3}' | \
    xargs -r docker rmi -f
    
    log_success "Docker cleanup completed"
}

# Main deployment function
deploy() {
    log_info "Starting yToo production deployment..."
    echo "========================================"
    
    check_prerequisites
    validate_environment
    create_backup
    build_and_deploy
    run_migrations
    verify_deployment
    cleanup_old_images
    show_status
    
    echo ""
    log_success "🎉 Deployment completed successfully!"
    echo "========================================"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "backup")
        create_backup
        ;;
    "migrate")
        run_migrations
        ;;
    "verify")
        verify_deployment
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup_old_images
        ;;
    *)
        echo "Usage: $0 [deploy|backup|migrate|verify|status|cleanup]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  backup   - Create database backup only"
        echo "  migrate  - Run database migrations only"
        echo "  verify   - Verify deployment only"
        echo "  status   - Show deployment status"
        echo "  cleanup  - Clean up old Docker images"
        exit 1
        ;;
esac