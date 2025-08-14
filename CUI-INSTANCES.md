# CUI Instance Quick Reference

## Active Instances

### oppie-thunder
- **URL**: http://5.78.76.207:3001
- **Token**: `b345ec2c92899a87079666668406c8e1`
- **Port**: 3001
- **Project**: `/home/dev/workspace/oppie-thunder`

### cui  
- **URL**: http://5.78.76.207:3002
- **Token**: `37fd6fc7885f2985eb1809f6327d44a5`
- **Port**: 3002
- **Project**: `/home/dev/workspace/cui`

### oppie-growth-hacking
- **URL**: http://5.78.76.207:3003
- **Token**: `00b91af9dead3cc956afc83cf1becc4c`
- **Port**: 3003
- **Project**: `/home/dev/workspace/oppie-growth-hacking`

## Management Commands

```bash
# View all instances with tokens
/home/dev/workspace/cui/cui-manager.sh list

# Show URLs and tokens
/home/dev/workspace/cui/cui-manager.sh urls

# Start all instances
/home/dev/workspace/cui/cui-manager.sh start-all

# Stop all instances
/home/dev/workspace/cui/cui-manager.sh stop-all

# Restart all instances
/home/dev/workspace/cui/cui-manager.sh restart-all
```

## Individual Project Management

Each project has its own control scripts in `~/.cui-instances/{project-name}/`:
- `stop.sh` - Stop this instance
- `restart.sh` - Restart this instance
- `cui.log` - View logs for this instance

## Adding New Projects

From any project directory:
```bash
/home/dev/workspace/cui/setup-project-cui.sh
```

This will:
1. Auto-assign a port (or use predefined for known projects)
2. Generate a unique auth token
3. Create isolated configuration
4. Start the instance
5. Display access information including the token

## API Access

To access the API endpoints, include the auth token in the header:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://5.78.76.207:PORT/api/config
```

## Notes

- Each instance runs independently with its own configuration
- Auth tokens are randomly generated for security
- Instances persist their state in project directories
- Logs are stored in `~/.cui-instances/{project-name}/cui.log`