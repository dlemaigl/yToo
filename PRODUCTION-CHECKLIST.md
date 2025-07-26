# Production Deployment Checklist

Use this checklist to ensure your yToo application is ready for production deployment.

## Pre-Deployment Checklist

### Environment Configuration
- [ ] Copy `.env.production` to `.env.production.local`
- [ ] Change default `POSTGRES_PASSWORD` from `CHANGE_THIS_PASSWORD`
- [ ] Generate secure `JWT_SECRET` (32+ characters, random)
- [ ] Update `REACT_APP_API_URL` with your domain
- [ ] Update `REACT_APP_WS_URL` with your domain
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate `LOG_LEVEL` (info/warn/error)

### Security Configuration
- [ ] Review and update CORS settings in backend
- [ ] Configure rate limiting appropriately
- [ ] Set up SSL certificates
- [ ] Review security headers in nginx configuration
- [ ] Ensure all default passwords are changed
- [ ] Configure firewall rules

### Infrastructure Setup
- [ ] Docker and Docker Compose installed
- [ ] Domain name configured and DNS pointing to server
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Sufficient server resources (2GB+ RAM, 10GB+ disk)
- [ ] Backup storage configured

### Database Preparation
- [ ] Database backup strategy planned
- [ ] Migration scripts tested
- [ ] Database connection limits configured
- [ ] Monitoring queries prepared

## Deployment Process

### 1. Initial Deployment
- [ ] Run `npm run deploy:prod` (Linux/Mac) or `npm run deploy:prod:win` (Windows)
- [ ] Verify all services are running: `npm run prod:status`
- [ ] Check application health: `npm run prod:health`
- [ ] Test application functionality manually
- [ ] Verify database migrations: `node scripts/migrate-production.js verify`

### 2. SSL/HTTPS Setup
- [ ] SSL certificates installed in `nginx/ssl/`
- [ ] Nginx HTTPS configuration enabled
- [ ] HTTP to HTTPS redirect configured
- [ ] SSL certificate auto-renewal set up
- [ ] Test HTTPS functionality

### 3. Monitoring Setup
- [ ] Application logs accessible: `npm run prod:logs`
- [ ] Health check endpoint responding: `/health`
- [ ] Metrics endpoint configured: `/metrics`
- [ ] Database monitoring queries working
- [ ] Error logging to database functional

## Post-Deployment Verification

### Functional Testing
- [ ] User registration works
- [ ] User login works
- [ ] Group creation works
- [ ] Group joining via invite link works
- [ ] Activity proposal works (anonymous)
- [ ] Voting works (anonymous)
- [ ] Real-time updates work (WebSocket)
- [ ] Majority calculation works
- [ ] Activity status updates work

### Performance Testing
- [ ] Application responds within acceptable time
- [ ] Database queries perform well
- [ ] WebSocket connections stable
- [ ] Memory usage within limits
- [ ] CPU usage within limits

### Security Testing
- [ ] No sensitive data exposed in API responses
- [ ] Vote anonymity maintained
- [ ] Activity creator anonymity maintained
- [ ] Rate limiting working
- [ ] CORS configured correctly
- [ ] Security headers present

## Monitoring and Maintenance

### Daily Checks
- [ ] Application health check
- [ ] Error log review
- [ ] Resource usage check
- [ ] Backup verification

### Weekly Checks
- [ ] Performance metrics review
- [ ] Security log analysis
- [ ] Disk space monitoring
- [ ] SSL certificate expiry check

### Monthly Checks
- [ ] Dependency updates
- [ ] Security patches
- [ ] Backup restoration test
- [ ] Performance optimization review

## Backup and Recovery

### Backup Strategy
- [ ] Automated daily database backups configured
- [ ] Backup retention policy implemented (30 days recommended)
- [ ] Application configuration backed up
- [ ] SSL certificates backed up
- [ ] Backup monitoring alerts set up

### Recovery Testing
- [ ] Database restoration tested
- [ ] Application recovery procedure documented
- [ ] Recovery time objectives defined
- [ ] Emergency contact list prepared

## Emergency Procedures

### Application Down
1. [ ] Check service status: `docker-compose -f docker-compose.prod.yml ps`
2. [ ] Check logs: `docker-compose -f docker-compose.prod.yml logs`
3. [ ] Restart services: `docker-compose -f docker-compose.prod.yml restart`
4. [ ] Check health endpoint: `curl http://localhost/health`

### Database Issues
1. [ ] Check database logs: `docker-compose -f docker-compose.prod.yml logs postgres`
2. [ ] Check database connections: Monitor connection pool
3. [ ] Restart database if needed: `docker-compose -f docker-compose.prod.yml restart postgres`
4. [ ] Restore from backup if corrupted

### SSL Certificate Expiry
1. [ ] Renew certificate: `certbot renew`
2. [ ] Update certificate files in `nginx/ssl/`
3. [ ] Restart nginx: `docker-compose -f docker-compose.prod.yml restart nginx`
4. [ ] Verify HTTPS functionality

## Performance Optimization

### Database Optimization
- [ ] Monitor slow queries
- [ ] Add indexes for frequent queries
- [ ] Optimize connection pool settings
- [ ] Regular VACUUM and ANALYZE

### Application Optimization
- [ ] Monitor memory usage patterns
- [ ] Optimize WebSocket connection handling
- [ ] Review and adjust rate limiting
- [ ] Implement caching where appropriate

### Infrastructure Optimization
- [ ] Use CDN for static assets
- [ ] Implement load balancing if needed
- [ ] Monitor and scale resources
- [ ] Optimize Docker image sizes

## Documentation Updates

### Keep Updated
- [ ] API documentation
- [ ] Deployment procedures
- [ ] Emergency procedures
- [ ] Configuration changes
- [ ] Performance benchmarks

## Compliance and Legal

### Data Protection
- [ ] Privacy policy updated
- [ ] Data retention policies implemented
- [ ] User data anonymization verified
- [ ] GDPR compliance (if applicable)

### Security Compliance
- [ ] Security audit completed
- [ ] Vulnerability assessment done
- [ ] Penetration testing performed
- [ ] Security incident response plan ready

---

## Sign-off

### Technical Review
- [ ] Code review completed
- [ ] Security review completed
- [ ] Performance review completed
- [ ] Documentation review completed

**Reviewed by:** _________________ **Date:** _________

### Operations Review
- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Emergency procedures tested

**Reviewed by:** _________________ **Date:** _________

### Final Approval
- [ ] All checklist items completed
- [ ] Production deployment approved
- [ ] Go-live date confirmed

**Approved by:** _________________ **Date:** _________

---

**Deployment Date:** _________
**Deployed by:** _________________
**Version:** _________________