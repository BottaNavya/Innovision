const express = require('express')
const nodemailer = require('nodemailer')
const crypto = require('crypto')
require('dotenv').config()

const app = express()

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.use(express.json())

const otpStore = new Map()
const OTP_TTL_MS = 5 * 60 * 1000

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000))
}

function getTransporter() {
  const emailUser = process.env.EMAIL_USER
  const emailPass = process.env.EMAIL_PASS

  if (!emailUser || !emailPass) {
    throw new Error('Missing EMAIL_USER or EMAIL_PASS in environment variables.')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  })
}

app.post('/send-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email)

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.',
      })
    }

    const otp = generateOtp()
    const expiresAt = Date.now() + OTP_TTL_MS

    otpStore.set(email, { otp, expiresAt })

    const transporter = getTransporter()
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your TinyBheema OTP',
      text: `Your OTP is: ${otp}\nValid for 5 minutes.\n\n- LokGuard Team`,
    })

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully.',
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : 'Failed to send OTP.',
    })
  }
})

app.post('/verify-otp', (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email)
    const otp = String(req.body && req.body.otp ? req.body.otp : '').trim()

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.',
      })
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be a 6-digit code.',
      })
    }

    const record = otpStore.get(email)
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'OTP not found. Please request a new OTP.',
      })
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email)
      return res.status(410).json({
        success: false,
        message: 'OTP expired. Please request a new OTP.',
      })
    }

    if (record.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
      })
    }

    otpStore.delete(email)
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : 'Failed to verify OTP.',
    })
  }
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  })
})

const port = Number(process.env.PORT || 5000)
app.listen(port, () => {
  console.log(`Email OTP API running on http://localhost:${port}`)
})
