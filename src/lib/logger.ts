import pino from 'pino';
import logtailTransport from '@logtail/pino';
import os from 'os';

// Initialize username
let username;
try {
  username = os.userInfo().username;
} catch (error) {
  username = process.env.USER || process.env.USERNAME || 'unknown';
}

// Initialize basic logger
const logger = pino({
  base: {
    user: username,
    hostname: os.hostname(),
    env: process.env.NODE_ENV || 'development',
  },
  level: 'info'
});

// Configure logtail transport separately if needed
if (typeof logtailTransport == 'function')
  if (process.env.LOGTAIL_SOURCE_TOKEN) {
    logtailTransport({
      sourceToken: process.env.LOGTAIL_SOURCE_TOKEN,
      options: {
        endpoint: process.env.LOGTAIL_ENDPOINT || 'https://s1214463.eu-nbg-2.betterstackdata.com'
      }
    }).then(transport => {
      // Transport will be configured externally
      console.log('Logtail transport configured');
    }).catch(err => {
      console.error('Failed to configure Logtail transport:', err);
    });
  }

export default logger;