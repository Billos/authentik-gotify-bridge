/**
 * Panoptikauth
 * Entry point for the application
 */

import { IncomingWebhookSendArguments } from "@slack/webhook"
import express, { Request, Response } from "express"

import { formatDefaultEvent, formatLoginEvent, formatLoginFailedEvent, formatUserWriteEvent } from "./formatters"
import { Gotify } from "./gotify"
import { isLoginEvent, isLoginFailedEvent, isUserWriteEvent, parseLoginEvent, parseLoginFailedEvent, parseUserWriteEvent } from "./parsers"
import { AuthentikNotification, FormattedEvent } from "./types"

const app = express()

// Configuration from environment variables
const PORT = process.env.PORT || 3000
const GOTIFY_URL = process.env.GOTIFY_URL || ""
const GOTIFY_TOKEN_AUTHENTIK = process.env.GOTIFY_TOKEN_AUTHENTIK || ""
const GOTIFY_TOKEN_SLACK = process.env.GOTIFY_TOKEN_SLACK || ""
const NOTIFICATION_SLACK_TITLE = process.env.NOTIFICATION_SLACK_TITLE || "Slack Notification"

// Middleware to parse text/json content type
app.use(express.json())

// POST endpoint to receive Authentik notifications
app.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if Authentik endpoint is configured
    if (!GOTIFY_TOKEN_AUTHENTIK) {
      console.warn("Authentik endpoint is not configured (GOTIFY_TOKEN_AUTHENTIK not set)")
      res.status(503).json({ error: "Authentik endpoint not configured" })
      return
    }

    console.log("Received notification from Authentik")
    // Parse the JSON from text body
    let notification: AuthentikNotification
    try {
      notification = typeof req.body === "string" ? JSON.parse(req.body) : req.body
    } catch (parseError) {
      console.error("Failed to parse notification:", parseError)
      res.status(400).json({ error: "Invalid JSON payload" })
      return
    }

    console.log("Parsed notification:", notification)

    // Extract IP address from headers
    const ipAddress = req.headers["ip"] as string

    // Validate required fields
    if (!notification.body) {
      res.status(400).json({ error: "Missing required field: body" })
      return
    }

    // Prepare message for Gotify
    let formattedEvent: FormattedEvent

    if (isLoginEvent(notification.body)) {
      const loginData = parseLoginEvent(notification.body)
      formattedEvent = formatLoginEvent(ipAddress, loginData, notification.event_user_username, notification.event_user_email)
    } else if (isLoginFailedEvent(notification.body)) {
      const failedData = parseLoginFailedEvent(notification.body)
      formattedEvent = formatLoginFailedEvent(ipAddress, failedData)
    } else if (isUserWriteEvent(notification.body)) {
      const userData = parseUserWriteEvent(notification.body)
      formattedEvent = formatUserWriteEvent(ipAddress, userData)
    } else {
      formattedEvent = formatDefaultEvent(ipAddress, notification.event_user_username, notification.event_user_email, notification.body)
    }

    // Map severity to priority (1-10, where 10 is highest)
    const priorityMap: { [key: string]: number } = { low: 2, normal: 5, medium: 5, high: 8, critical: 10 }
    const severityLower = notification.severity?.toLowerCase()
    const priority = severityLower ? priorityMap[severityLower] || 5 : 5

    // Send to Gotify
    const gotify = new Gotify(GOTIFY_URL, GOTIFY_TOKEN_AUTHENTIK)
    await gotify.sendMessage(formattedEvent.title, formattedEvent.message, priority)

    console.log("Notification forwarded to Gotify successfully")
    res.status(200).json({ success: true, message: "Notification forwarded to Gotify" })
  } catch (error) {
    console.error("Error processing notification:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "panoptikauth" })
})

app.post("/slack", async (req: Request<{}, {}, IncomingWebhookSendArguments>, res: Response) => {
  try {
    // Check if Slack endpoint is configured
    if (!GOTIFY_TOKEN_SLACK) {
      console.warn("Slack endpoint is not configured (GOTIFY_TOKEN_SLACK not set)")
      res.status(503).json({ error: "Slack endpoint not configured" })
      return
    }

    console.log("Received Slack test notification:", req.body)
    const formattedEvent: FormattedEvent = {
      title: NOTIFICATION_SLACK_TITLE,
      message: req.body.text || "Empty notification from Panoptikauth.",
    }
    const priority = 5 // Normal priority
    const gotify = new Gotify(GOTIFY_URL, GOTIFY_TOKEN_SLACK)
    await gotify.sendMessage(formattedEvent.title, formattedEvent.message, priority)
    res.status(200).json({ status: "ok", service: "panoptikauth" })
  } catch (error) {
    console.error("Error processing Slack notification:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

/**
 * Send notification to Gotify using multipart/form-data
 */
function main(): void {
  if (!GOTIFY_URL) {
    console.error("GOTIFY_URL environment variable not set")
    process.exit(1)
  }

  // Check which endpoints are configured
  const authentikConfigured = !!GOTIFY_TOKEN_AUTHENTIK
  const slackConfigured = !!GOTIFY_TOKEN_SLACK

  if (!authentikConfigured && !slackConfigured) {
    console.warn("WARNING: No endpoint tokens configured. At least one of GOTIFY_TOKEN_AUTHENTIK or GOTIFY_TOKEN_SLACK should be set.")
    console.warn("The service will start but endpoints will return 503 errors.")
  }

  console.log("Panoptikauth starting...")
  console.log("Environment:", process.env.NODE_ENV || "development")
  console.log("Gotify URL:", GOTIFY_URL)
  console.log("Endpoint configurations:")
  console.log(`  - Authentik (/webhook): ${authentikConfigured ? "Enabled" : "Disabled"}`)
  console.log(`  - Slack (/slack): ${slackConfigured ? "Enabled" : "Disabled"}`)

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook ${authentikConfigured ? "" : "(not configured)"}`)
    console.log(`Slack endpoint: http://localhost:${PORT}/slack ${slackConfigured ? "" : "(not configured)"}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
  })
}

main()
