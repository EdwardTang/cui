#!/usr/bin/env node

import fetch from 'node-fetch';
import { ConfigService } from './services/config-service.js';
import { createLogger } from './services/logger.js';

const logger = createLogger('ClaunchCLI');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Get configuration
  const configService = ConfigService.getInstance();
  await configService.initialize();
  const config = configService.getConfig();

  const baseURL = `http://${config.server.host}:${config.server.port}`;
  const headers: Record<string, string> = config.authToken
    ? { Authorization: `Bearer ${config.authToken}` }
    : {};

  try {
    switch (command) {
      case 'status':
        const statusResponse = await fetch(`${baseURL}/api/claunch/status`, { headers });
        const statusData = await statusResponse.json();
        console.log('\n📊 Claunch Service Status');
        console.log('------------------------');
        console.log(`Enabled: ${statusData.enabled ? '✅' : '❌'}`);
        console.log(`\nConfiguration:`);
        console.log(`  Keep-alive interval: ${statusData.config.intervalMs / 1000}s`);
        console.log(`  Inactivity timeout: ${statusData.config.inactivityTimeoutMs / 1000}s`);
        console.log(`  Auto-reconnect: ${statusData.config.autoReconnect ? 'Yes' : 'No'}`);
        console.log(`  Max reconnect attempts: ${statusData.config.maxReconnectAttempts}`);

        if (statusData.sessions.length > 0) {
          console.log(`\nMonitored Sessions (${statusData.sessions.length}):`);
          statusData.sessions.forEach((session: any) => {
            const inactiveSec = Math.floor(session.inactiveMs / 1000);
            const status = session.isActive ? '🟢 Active' : '🔴 Inactive';
            console.log(`  ${session.streamingId}: ${status} (idle: ${inactiveSec}s)`);
          });
        } else {
          console.log('\nNo sessions currently being monitored.');
        }
        break;

      case 'enable':
        await fetch(`${baseURL}/api/claunch/config`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        });
        console.log('✅ Claunch service enabled');
        break;

      case 'disable':
        await fetch(`${baseURL}/api/claunch/config`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        });
        console.log('❌ Claunch service disabled');
        break;

      case 'config':
        if (args.length < 3) {
          console.error('Usage: claunch config <key> <value>');
          console.error(
            'Available keys: intervalMs, inactivityTimeoutMs, autoReconnect, maxReconnectAttempts',
          );
          process.exit(1);
        }

        const key = args[1];
        const value = args[2];
        const configUpdate: any = {};

        switch (key) {
          case 'intervalMs':
          case 'inactivityTimeoutMs':
          case 'maxReconnectAttempts':
            configUpdate[key] = parseInt(value, 10);
            if (isNaN(configUpdate[key])) {
              console.error(`Invalid value for ${key}: must be a number`);
              process.exit(1);
            }
            break;
          case 'autoReconnect':
            configUpdate[key] = value === 'true';
            break;
          default:
            console.error(`Unknown configuration key: ${key}`);
            process.exit(1);
        }

        await fetch(`${baseURL}/api/claunch/config`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(configUpdate),
        });
        console.log(`✅ Updated ${key} to ${value}`);
        break;

      case 'help':
      default:
        console.log(`
Claunch - Claude Session Keep-Alive Manager

Usage:
  claunch <command> [options]

Commands:
  status              Show current status and monitored sessions
  enable              Enable the claunch service
  disable             Disable the claunch service
  config <key> <val>  Update configuration
  help                Show this help message

Configuration Keys:
  intervalMs              Keep-alive interval in milliseconds (default: 30000)
  inactivityTimeoutMs     Inactivity timeout in milliseconds (default: 300000)
  autoReconnect          Enable auto-reconnect (true/false, default: false)
  maxReconnectAttempts    Maximum reconnect attempts (default: 3)

Examples:
  claunch status                              # Check service status
  claunch enable                              # Enable keep-alive service
  claunch config intervalMs 60000            # Set keep-alive to 60 seconds
  claunch config autoReconnect true          # Enable auto-reconnect
`);
        break;
    }
  } catch (error: any) {
    console.error('Error: Could not connect to CUI server. Is it running?');
    console.error(`Details: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unexpected error', error);
  console.error('Unexpected error:', error);
  process.exit(1);
});
