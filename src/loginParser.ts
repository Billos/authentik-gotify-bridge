/**
 * Login event parsing and formatting utilities
 */

import { LoginEventData } from "./types"

/**
 * Detects if a notification body contains a login event
 */
export function isLoginEvent(body: string): boolean {
  // More specific check: look for "login:" followed by opening brace and containing 'auth_method'
  return /login:\s*\{.*['"]auth_method['"]/.test(body)
}

/**
 * Parses login event data from the body string
 * The body contains a Python dict representation that needs to be converted to JSON
 */
export function parseLoginEvent(body: string): LoginEventData | null {
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
export function formatLoginEvent(loginData: LoginEventData, username?: string, email?: string): string {
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
