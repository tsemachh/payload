import type { PayloadRequest } from 'payload'

export interface SlackMessage {
  channel: string
  text: string
  username?: string
  icon_emoji?: string
  attachments?: SlackAttachment[]
}

export interface SlackAttachment {
  color?: 'good' | 'warning' | 'danger' | string
  title?: string
  text?: string
  fields?: SlackField[]
  footer?: string
  ts?: number
}

export interface SlackField {
  title: string
  value: string
  short?: boolean
}

export class SlackNotificationService {
  private botToken: string
  private defaultChannel: string
  private enabled: boolean

  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN || ''
    this.defaultChannel = process.env.SLACK_CHANNEL_EMDA_PROD || '#emda-prod'
    this.enabled = process.env.SLACK_ENABLED === 'true'
  }

  async sendMessage(message: SlackMessage): Promise<boolean> {
    if (!this.enabled || !this.botToken) {
      console.log('Slack notifications disabled or bot token not configured')
      return false
    }

    try {
      const payload = {
        channel: message.channel || this.defaultChannel,
        text: message.text,
        username: message.username || 'EMDA System',
        icon_emoji: message.icon_emoji || ':warning:',
        attachments: message.attachments || [],
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.botToken}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!result.ok) {
        console.error('Failed to send Slack message:', result.error)
        return false
      }

      console.log('Slack message sent successfully')
      return true
    } catch (error) {
      console.error('Error sending Slack message:', error)
      return false
    }
  }

  async sendDataMissingAlert(
    type: 'meetings' | 'holdings',
    details: {
      expectedDate?: string
      lastReceived?: string
      missingDays?: number
    },
    _req?: PayloadRequest,
  ): Promise<boolean> {
    const typeEnglish = type === 'meetings' ? 'Meetings' : 'stocks'
    const environment = process.env.ENV || 'unknown'
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://staging.emda-test.shefing.com/'

    let detailsText = `Environment: ${environment}\nLink: ${serverUrl}`

    if (
      details.lastReceived &&
      details.lastReceived !== 'Unknown' &&
      details.lastReceived !== 'Never'
    ) {
      detailsText += `\nLast received: ${details.lastReceived}`
    }

    const message: SlackMessage = {
      channel: this.defaultChannel,
      text: `⚠️ Missing ${typeEnglish} Feed`,
      attachments: [
        {
          color: 'warning',
          text: detailsText,
          footer: 'EMDA System',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    return this.sendMessage(message)
  }
}

// Singleton instance
export const slackService = new SlackNotificationService()

// Helper function for missing data notifications
export async function notifyDataMissing(
  type: 'meetings' | 'holdings',
  details: {
    expectedDate?: string
    lastReceived?: string
    missingDays?: number
  },
  _req?: PayloadRequest,
): Promise<boolean> {
  return slackService.sendDataMissingAlert(type, details, _req)
}
