# yToo Production Deployment Guide

This guide covers deploying the yToo group activity voting application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [SSL/HTTPS Configuration](#ssl-https-configuration)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- Docker and Docker Compose installed
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Node.js 18+ (for development/testing)
- At least 2GB RAM and 10GB disk space
- SSL certificates (for HTTPS)

### Domain and DNS

- Domain name configured and pointing to your server
- SSL certificate (Let's Encrypt recommended)

## Environment Setup

### 1. Clone and Prepare Repository

```bash
git clone <your-repository-url>
cd ytoo-app
```

### 2. Configure Environment Variables

Copy the production environment template:

```bash
cp .env.production .env.production.local
```

Edit `.env.production.local` with your production values:

```bash
# Database Configuration
DATABASE_URL=postgresql://ytoo_user:YOUR_SECURE_PASSWORD@postgres:5432/ytoo_prod
POSTGRES_DB=ytoo_prod
POSTGRES_USER=ytoo_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD

# JWT Configuration - CRITICAL: Change this!
JWT_SECRET=YOUR_VERY_SECURE_RANDOM_STRING_AT_LEAST_32_CHARACTERS
JWT_EXPIRES_IN=24h

# Frontend Configuration
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_WS_URL=wss://yourdomain.com

# Server Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### 3. Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT secret (32+ characters)
- [ ] Configure proper domain names
- [ ] Set up SSL certificates
- [ ] Review and update CORS settings
- [ ] Configure rate limiting appropriately

## Database Setup

### 1. Initialize Database

Run the production migration script:

```bash
# Load environment variables
export $(cat .env.production.local | xargs)

# Run migrations with backup
node scripts/migrate-production.js migrate
```

### 2. Verify Database Setup

```bash
# Verify migrations
node scripts/migrate-production.js verify

# Check database health
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM users;"
```

## Application Deployment

### 1. Build and Start Services

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 2. Verify Deployment

```bash
# Check application health
curl http://localhost/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 3. Service Management

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service-name]

# Scale services (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale backend=2
```

## SSL/HTTPS Configuration

### 1. Obtain SSL Certificate

Using Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com
```

### 2. Configure SSL in Nginx

Create SSL directory and copy certificates:

```bash
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
```

Update `nginx/nginx.conf` to enable HTTPS:

```nginx
# Uncomment and configure the HTTPS server block
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Include all location blocks from HTTP server
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. Auto-renewal Setup

```bash
# Add cron job for certificate renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /path/to/ytoo-app/docker-compose.prod.yml restart nginx
```

## Monitoring and Logging

### 1. Log Management

Logs are stored in:
- Application logs: `backend/logs/`
- Nginx logs: Docker volume `nginx_logs`
- Container logs: Docker logging driver

View logs:

```bash
# Application logs
docker-compose -f docker-compose.prod.yml exec backend ls -la logs/
docker-compose -f docker-compose.prod.yml exec backend tail -f logs/all.log

# Container logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100 backend
```

### 2. Health Monitoring

Health check endpoints:

- Application: `https://yourdomain.com/health`
- Metrics: `https://yourdomain.com/metrics` (production only)

Set up monitoring alerts:

```bash
# Example health check script
#!/bin/bash
HEALTH_URL="https://yourdomain.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed: HTTP $RESPONSE"
    # Send alert (email, Slack, etc.)
fi
```

### 3. Database Monitoring

Monitor database performance:

```bash
# Check database connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM pg_stat_activity;"

# Check table sizes
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## Backup and Recovery

### 1. Database Backups

Automated backup script:

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ytoo_backup_$DATE.sql"

# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "ytoo_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Set up daily backups:

```bash
# Add to crontab
0 2 * * * /path/to/backup-database.sh
```

### 2. Application Backup

```bash
# Backup application files and configuration
tar -czf ytoo_app_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=.git \
  .
```

### 3. Recovery Procedures

Database recovery:

```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore database
gunzip -c backup_file.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Start application
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT NOW();"
```

#### 2. Application Won't Start

```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs backend

# Check environment variables
docker-compose -f docker-compose.prod.yml exec backend env | grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV)"

# Restart services
docker-compose -f docker-compose.prod.yml restart backend
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL configuration
curl -I https://yourdomain.com

# Check nginx configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

#### 4. Performance Issues

```bash
# Check resource usage
docker stats

# Check database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check application metrics
curl https://yourdomain.com/metrics
```

### Log Analysis

Important log locations:

- Application errors: `backend/logs/error.log`
- All application logs: `backend/logs/all.log`
- Nginx access logs: Docker volume
- Database logs: Docker logs

### Performance Tuning

1. **Database Optimization**:
   - Monitor slow queries
   - Adjust connection pool settings
   - Add indexes for frequent queries

2. **Application Optimization**:
   - Monitor memory usage
   - Adjust rate limiting
   - Optimize WebSocket connections

3. **Infrastructure Optimization**:
   - Use CDN for static assets
   - Implement caching strategies
   - Scale horizontally if needed

## Security Maintenance

### Regular Security Tasks

1. **Update Dependencies**:
   ```bash
   # Update Docker images
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   
   # Update application dependencies
   cd backend && npm audit fix
   cd frontend && npm audit fix
   ```

2. **Monitor Security Logs**:
   ```bash
   # Check for suspicious activity
   docker-compose -f docker-compose.prod.yml logs backend | grep -i "security\|error\|fail"
   ```

3. **Review Access Logs**:
   ```bash
   # Analyze nginx access logs
   docker-compose -f docker-compose.prod.yml logs nginx | grep -E "(40[0-9]|50[0-9])"
   ```

## Support and Maintenance

### Maintenance Schedule

- **Daily**: Check health endpoints, review error logs
- **Weekly**: Review performance metrics, check disk space
- **Monthly**: Update dependencies, review security logs
- **Quarterly**: Full security audit, backup testing

### Emergency Contacts

Document your emergency procedures and contacts:

- System administrator: [contact info]
- Database administrator: [contact info]
- Application developer: [contact info]
- Hosting provider support: [contact info]

---

For additional support or questions about deployment, please refer to the project documentation or contact the development team.