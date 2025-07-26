# yToo Production Deployment Script (PowerShell)
# This script automates the deployment process for production on Windows

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "backup", "migrate", "verify", "status", "cleanup")]
    [string]$Command = "deploy"
)

# Configuration
$COMPOSE_FILE = "docker-compose.prod.yml"
$ENV_FILE = ".env.production.local"
$BACKUP_DIR = "backups"

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    try {
        $null = docker --version
        $null = docker info
    }
    catch {
        Write-Error "Docker is not installed or not running"
        exit 1
    }
    
    # Check if Docker Compose is available
    try {
        $null = docker-compose --version
    }
    catch {
        Write-Error "Docker Compose is not installed"
        exit 1
    }
    
    # Check if environment file exists
    if (-not (Test-Path $ENV_FILE)) {
        Write-Error "Environment file $ENV_FILE not found"
        Write-Info "Please copy .env.production to $ENV_FILE and configure it"
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

function Test-Environment {
    Write-Info "Validating environment configuration..."
    
    # Read environment file
    $envVars = @{}
    Get-Content $ENV_FILE | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        $envVars[$key] = $value
    }
    
    # Check critical environment variables
    $requiredVars = @(
        "DATABASE_URL",
        "JWT_SECRET",
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "NODE_ENV"
    )
    
    foreach ($var in $requiredVars) {
        if (-not $envVars.ContainsKey($var) -or [string]::IsNullOrEmpty($envVars[$var])) {
            Write-Error "Required environment variable $var is not set"
            exit 1
        }
    }
    
    # Check if JWT_SECRET is secure (at least 32 characters)
    if ($envVars["JWT_SECRET"].Length -lt 32) {
        Write-Error "JWT_SECRET must be at least 32 characters long"
        exit 1
    }
    
    # Check if default passwords are changed
    if ($envVars["POSTGRES_PASSWORD"] -eq "CHANGE_THIS_PASSWORD") {
        Write-Error "Please change the default POSTGRES_PASSWORD"
        exit 1
    }
    
    if ($envVars["JWT_SECRET"] -like "*CHANGE_THIS*") {
        Write-Error "Please change the default JWT_SECRET"
        exit 1
    }
    
    Write-Success "Environment validation passed"
}

function New-Backup {
    Write-Info "Creating database backup..."
    
    # Create backup directory
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }
    
    # Check if database is running
    $postgresStatus = docker-compose -f $COMPOSE_FILE ps postgres
    if ($postgresStatus -match "Up") {
        # Create backup using the migration script
        try {
            node scripts/migrate-production.js backup
            Write-Success "Database backup created"
        }
        catch {
            Write-Warning "Failed to create database backup, continuing anyway..."
        }
    }
    else {
        Write-Info "Database not running, skipping backup"
    }
}

function Start-Deployment {
    Write-Info "Building and deploying application..."
    
    # Pull latest images
    Write-Info "Pulling latest base images..."
    docker-compose -f $COMPOSE_FILE pull postgres redis nginx
    
    # Build application images
    Write-Info "Building application images..."
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache
    
    # Start services
    Write-Info "Starting services..."
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
    
    Write-Success "Application deployed"
}

function Start-Migrations {
    Write-Info "Running database migrations..."
    
    # Wait for database to be ready
    Write-Info "Waiting for database to be ready..."
    Start-Sleep -Seconds 10
    
    # Run migrations
    try {
        node scripts/migrate-production.js migrate
        Write-Success "Database migrations completed"
    }
    catch {
        Write-Error "Database migrations failed"
        exit 1
    }
}

function Test-Deployment {
    Write-Info "Verifying deployment..."
    
    # Wait for services to start
    Start-Sleep -Seconds 15
    
    # Check service status
    Write-Info "Checking service status..."
    docker-compose -f $COMPOSE_FILE ps
    
    # Check health endpoint
    Write-Info "Checking application health..."
    $healthCheckPassed = $false
    
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Success "Application health check passed"
                $healthCheckPassed = $true
                break
            }
        }
        catch {
            # Continue trying
        }
        
        Write-Info "Waiting for application to start... (attempt $i/30)"
        Start-Sleep -Seconds 2
    }
    
    if (-not $healthCheckPassed) {
        Write-Error "Application health check failed after 30 attempts"
        Write-Info "Checking application logs..."
        docker-compose -f $COMPOSE_FILE logs --tail=50 backend
        exit 1
    }
    
    # Verify database migrations
    try {
        node scripts/migrate-production.js verify
        Write-Success "Database verification passed"
    }
    catch {
        Write-Error "Database verification failed"
        exit 1
    }
    
    Write-Success "Deployment verification completed"
}

function Show-Status {
    Write-Info "Deployment Status:"
    Write-Host "===================="
    
    # Show service status
    docker-compose -f $COMPOSE_FILE ps
    
    Write-Host ""
    Write-Info "Application URLs:"
    Write-Host "Health Check: http://localhost/health"
    Write-Host "Application: http://localhost/"
    
    if (Test-Path "nginx/ssl/cert.pem") {
        Write-Host "HTTPS Application: https://localhost/"
    }
    
    Write-Host ""
    Write-Info "Useful Commands:"
    Write-Host "View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
    Write-Host "Stop services: docker-compose -f $COMPOSE_FILE down"
    Write-Host "Restart service: docker-compose -f $COMPOSE_FILE restart [service]"
}

function Remove-OldImages {
    Write-Info "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    Write-Success "Docker cleanup completed"
}

# Main deployment function
function Start-FullDeployment {
    Write-Info "Starting yToo production deployment..."
    Write-Host "========================================"
    
    Test-Prerequisites
    Test-Environment
    New-Backup
    Start-Deployment
    Start-Migrations
    Test-Deployment
    Remove-OldImages
    Show-Status
    
    Write-Host ""
    Write-Success "🎉 Deployment completed successfully!"
    Write-Host "========================================"
}

# Handle command line arguments
switch ($Command) {
    "deploy" {
        Start-FullDeployment
    }
    "backup" {
        New-Backup
    }
    "migrate" {
        Start-Migrations
    }
    "verify" {
        Test-Deployment
    }
    "status" {
        Show-Status
    }
    "cleanup" {
        Remove-OldImages
    }
    default {
        Write-Host "Usage: .\deploy.ps1 [deploy|backup|migrate|verify|status|cleanup]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  deploy   - Full deployment (default)"
        Write-Host "  backup   - Create database backup only"
        Write-Host "  migrate  - Run database migrations only"
        Write-Host "  verify   - Verify deployment only"
        Write-Host "  status   - Show deployment status"
        Write-Host "  cleanup  - Clean up old Docker images"
        exit 1
    }
}