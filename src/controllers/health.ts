import { Request, Response } from "express"

export function handleHealthCheck(_req: Request, res: Response) {
  return res.status(200).json({ status: "ok", service: "panoptikauth" })
}
