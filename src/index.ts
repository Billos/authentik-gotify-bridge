/**
 * Authentik-Gotify Bridge
 * Entry point for the application
 */

import express, { Request, Response } from "express"

import { Gotify } from "./gotify"

const app = express()

// Configuration from environment variables
const PORT = process.env.PORT || 3000
const GOTIFY_URL = process.env.GOTIFY_URL || "https://push.example.de"
const GOTIFY_TOKEN = process.env.GOTIFY_TOKEN || ""

// Interface for Authentik notification payload
interface AuthentikNotification {
  body: string
  severity?: string
  user_email?: string
  user_username?: string
  event_user_email?: string
  event_user_username?: string
}

// Interface for parsed login event data
interface LoginEventData {
  auth_method?: string
  http_request?: {
    args?: { next?: string }
    path?: string
    method?: string
    request_id?: string
    user_agent?: string
  }
  auth_method_args?: {
    mfa_devices?: Array<{ pk: number; app: string; name: string; model_name: string }>
    known_device?: boolean
  }
}

// Middleware to parse text/json content type
app.use(express.json())

/**
 * Detects if a notification body contains a login event
 */
function isLoginEvent(body: string): boolean {
  // More specific check: look for "login:" followed by opening brace and containing 'auth_method'
  return /login:\s*\{.*['"]auth_method['"]/.test(body)
}

/**
 * Parses login event data from the body string
 * The body contains a Python dict representation that needs to be converted to JSON
 */
function parseLoginEvent(body: string): LoginEventData | null {
  try {
    // Extract the login data part after "login:"
    const loginPrefix = "login:"
    const loginIndex = body.indexOf(loginPrefix)
    if (loginIndex === -1) {
      return null
    }

    // Find the matching closing brace for the dictionary
    let loginDataStr = body.substring(loginIndex + loginPrefix.length).trim()
    let braceCount = 0
    let endIndex = -1
    let inString = false
    let stringChar = ""

    for (let i = 0; i < loginDataStr.length; i++) {
      const char = loginDataStr[i]
      const prevChar = i > 0 ? loginDataStr[i - 1] : ""

      // Track string boundaries to ignore braces inside strings
      if ((char === "'" || char === "\"") && prevChar !== "\\") {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
          stringChar = ""
        }
      }

      // Only count braces outside of strings
      if (!inString) {
        if (char === "{") {
          braceCount++
        } else if (char === "}") {
          braceCount--
          if (braceCount === 0) {
            endIndex = i + 1
            break
          }
        }
      }
    }

    if (endIndex === -1) {
      return null
    }

    loginDataStr = loginDataStr.substring(0, endIndex)

    // Convert Python dict format to JSON with more careful replacements
    // Replace True/False/None only when they are not part of a string
    let jsonStr = loginDataStr
    
    // Replace Python boolean and None values (using word boundaries)
    jsonStr = jsonStr.replace(/\bTrue\b/g, "true")
    jsonStr = jsonStr.replace(/\bFalse\b/g, "false")
    jsonStr = jsonStr.replace(/\bNone\b/g, "null")
    
    // Replace single quotes with double quotes (this is still imperfect but works for most cases)
    jsonStr = jsonStr.replace(/'/g, "\"")

    const loginData = JSON.parse(jsonStr) as LoginEventData
    return loginData
  } catch (error) {
    console.error("Failed to parse login event:", error)
    return null
  }
}

/**
 * Formats a login event into a human-readable message
 */
function formatLoginEvent(loginData: LoginEventData, username?: string, email?: string): string {
  const lines: string[] = []

  lines.push("🔐 **Login Event**\n")

  // User information
  if (username || email) {
    lines.push(`**User:** ${username || "N/A"}${email ? ` (${email})` : ""}`)
  }

  // Authentication method
  if (loginData.auth_method) {
    lines.push(`**Authentication Method:** ${loginData.auth_method}`)
  }

  // Known device status
  if (loginData.auth_method_args?.known_device !== undefined) {
    const deviceStatus = loginData.auth_method_args.known_device ? "✅ Known device" : "⚠️ Unknown device"
    lines.push(`**Device Status:** ${deviceStatus}`)
  }

  // MFA information
  if (loginData.auth_method_args?.mfa_devices && loginData.auth_method_args.mfa_devices.length > 0) {
    const mfaDevices = loginData.auth_method_args.mfa_devices.map((d) => d.name).join(", ")
    lines.push(`**MFA Devices:** ${mfaDevices}`)
  }

  // Request details
  if (loginData.http_request) {
    lines.push("\n**Request Details:**")
    if (loginData.http_request.method && loginData.http_request.path) {
      lines.push(`- Path: \`${loginData.http_request.method} ${loginData.http_request.path}\``)
    }
    if (loginData.http_request.user_agent) {
      // Simplify user agent display - be more flexible with browser detection
      const ua = loginData.http_request.user_agent
      
      // Try to extract browser information
      const browserMatch = ua.match(/(Firefox|Chrome|Safari|Edge|Opera|Brave|Vivaldi|Chromium)\/[\d.]+/i)
      
      // Try to extract OS information
      const osMatch = ua.match(/\((.*?)\)/)
      
      if (browserMatch) {
        lines.push(`- Browser: ${browserMatch[0]}`)
      }
      
      if (osMatch) {
        const os = osMatch[1].split(";")[0].trim()
        lines.push(`- OS: ${os}`)
      }
      
      // If we couldn't extract browser info, just show it's a browser-based login
      if (!browserMatch && !osMatch) {
        lines.push(`- User Agent: ${ua.substring(0, 50)}${ua.length > 50 ? "..." : ""}`)
      }
    }
  }

  return lines.join("\n")
}

// POST endpoint to receive Authentik notifications
app.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Received notification from Authentik")
    console.log("Content-Type:", req.get("content-type"))

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

    // Validate required fields
    if (!notification.body) {
      res.status(400).json({ error: "Missing required field: body" })
      return
    }

    // Check if Gotify URL and token are configured
    if (!GOTIFY_TOKEN) {
      console.error("GOTIFY_TOKEN environment variable not set")
      res.status(500).json({ error: "Gotify token not configured" })
      return
    }

    // Prepare message for Gotify
    let title: string
    let message: string

    // Check if this is a login event and format accordingly
    if (isLoginEvent(notification.body)) {
      const loginData = parseLoginEvent(notification.body)
      if (loginData) {
        title = `Login: ${notification.event_user_username || notification.user_username || "User"}`
        message = formatLoginEvent(loginData, notification.event_user_username, notification.event_user_email)
      } else {
        // Fallback to default formatting if parsing fails
        title = `Notification from ${notification.event_user_username || "System"}`
        message =
          `${notification.body}\n\n` +
          `User: ${notification.user_username || "N/A"} (${notification.user_email || "N/A"})\n` +
          `Event User: ${notification.event_user_username || "N/A"} (${notification.event_user_email || "N/A"})`
      }
    } else {
      // Default formatting for non-login events
      title = `Notification from ${notification.event_user_username || "System"}`
      message =
        `${notification.body}\n\n` +
        `User: ${notification.user_username || "N/A"} (${notification.user_email || "N/A"})\n` +
        `Event User: ${notification.event_user_username || "N/A"} (${notification.event_user_email || "N/A"})`
    }

    // Map severity to priority (1-10, where 10 is highest)
    const priorityMap: { [key: string]: number } = { low: 2, normal: 5, medium: 5, high: 8, critical: 10 }
    const severityLower = notification.severity?.toLowerCase()
    const priority = severityLower ? priorityMap[severityLower] || 5 : 5

    // Send to Gotify
    const gotify = new Gotify()
    await gotify.sendMessage(title, message, priority)

    console.log("Notification forwarded to Gotify successfully")
    res.status(200).json({ success: true, message: "Notification forwarded to Gotify" })
  } catch (error) {
    console.error("Error processing notification:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "authentik-gotify-bridge" })
})

/**
 * Send notification to Gotify using multipart/form-data
 */
function main(): void {
  console.log("Authentik-Gotify Bridge starting...")
  console.log("Environment:", process.env.NODE_ENV || "development")
  console.log("Gotify URL:", GOTIFY_URL)
  console.log("Gotify Token configured:", GOTIFY_TOKEN ? "Yes" : "No")

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`)
    console.log(`Health check: http://localhost:${PORT}/health`)
  })
}

main()
