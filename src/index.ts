import express, { Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import prisma from "./prisma"
import { requireAuth, AuthRequest } from "./middleware/auth"

const app = express()
app.use(express.json())

// ─────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────

// POST /auth/signup
app.post("/auth/signup", async (req: Request, res: Response) => {
  // req.body is typed as "any" by default in Express
  // we destructure and TypeScript infers from usage
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" })
    return
  }

  const existing = await prisma.user.findUnique({
    where: { username }
  })

  if (existing) {
    res.status(400).json({ error: "Username already taken" })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      balance: {
        create: {
          INRTotal: 0,
          INRLocked: 0
        }
      }
    }
  })

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  )

  res.status(201).json({ token })
})

// POST /auth/signin
app.post("/auth/signin", async (req: Request, res: Response) => {
  const { username, password } = req.body

  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" })
    return
  }

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" })
    return
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  )

  res.json({ token })
})

// ─────────────────────────────────────────
// BALANCE ROUTES (protected)
// ─────────────────────────────────────────

// POST /balance/deposit
app.post("/balance/deposit", requireAuth, async (req: AuthRequest, res: Response) => {
  //                         ↑
  //              middleware runs first, adds userId to req

  const { amount } = req.body
  const userId = req.userId!
  //                      ↑
  // ! is "non-null assertion"
  // tells TypeScript: I know this isn't undefined here
  // safe because requireAuth already guaranteed it exists

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" })
    return
  }

  const balance = await prisma.balance.update({
    where: { userId },
    data: {
      INRTotal: { increment: amount }
      //         ↑ prisma helper — adds to existing value
    }
  })

  res.json({ balance })
})

// GET /balance
app.get("/balance", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!

  const balance = await prisma.balance.findUnique({
    where: { userId }
  })

  res.json({ balance })
})

// ─────────────────────────────────────────
app.listen(3000, () => {
  console.log("Server running on port 3000")
})