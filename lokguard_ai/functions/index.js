const crypto = require('crypto')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions')

setGlobalOptions({ maxInstances: 10 })

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const otpsCollection = db.collection('emailOtps')
const otpTtlMs = 5 * 60 * 1000
const maxAttempts = 5

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex')
}

function getMailer() {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS
  const from = process.env.GMAIL_FROM || process.env.EMAIL_FROM || user

  if (!user || !pass || !from) {
    return null
  }

  return {
    from,
    transport: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    }),
  }
}

async function sendOtpToEmail(email) {
  const mailer = getMailer()
  if (!mailer) {
    throw new Error('Gmail SMTP is not configured. Set GMAIL_USER, GMAIL_APP_PASSWORD, and optional GMAIL_FROM.')
  }

  const otp = generateOtp()
  const codeHash = hashOtp(otp)
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + otpTtlMs)

  await otpsCollection.doc(email).set(
    {
      email,
      codeHash,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  await mailer.transport.sendMail({
    from: mailer.from,
    to: email,
    subject: 'TinyBheema email OTP',
    text: `Your TinyBheema verification OTP is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your TinyBheema verification OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
  })

  return {
    success: true,
    message: 'OTP sent successfully.',
    expiresInSeconds: Math.floor(otpTtlMs / 1000),
  }
}

async function verifyOtpForEmail(email, otp) {
  const otpDoc = await otpsCollection.doc(email).get()
  if (!otpDoc.exists) {
    return {
      success: false,
      statusCode: 404,
      message: 'OTP not found. Please request a new code.',
    }
  }

  const data = otpDoc.data() || {}
  const now = Date.now()
  const expiresAt = data.expiresAt && typeof data.expiresAt.toMillis === 'function'
    ? data.expiresAt.toMillis()
    : 0

  if (!expiresAt || now > expiresAt) {
    return {
      success: false,
      statusCode: 410,
      message: 'OTP expired. Please request a new code.',
    }
  }

  const attempts = Number(data.attempts || 0)
  if (attempts >= maxAttempts) {
    return {
      success: false,
      statusCode: 429,
      message: 'Too many invalid attempts. Request a new OTP.',
    }
  }

  if (data.verified) {
    return {
      success: true,
      statusCode: 200,
      message: 'OTP already verified.',
      alreadyVerified: true,
    }
  }

  if (hashOtp(otp) !== data.codeHash) {
    await otpDoc.ref.set(
      {
        attempts: attempts + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return {
      success: false,
      statusCode: 400,
      message: 'Invalid OTP.',
    }
  }

  await otpDoc.ref.set(
    {
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  return {
    success: true,
    statusCode: 200,
    message: 'OTP verified successfully.',
  }
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return {}
}

exports.emailOtpApi = onRequest({ cors: true }, async (req, res) => {
  res.set('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' })
    return
  }

  const body = parseRequestBody(req)
  const email = normalizeEmail(body.email)

  if (req.path === '/send-otp') {
    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Valid email is required.' })
      return
    }

    try {
      const result = await sendOtpToEmail(email)
      res.status(200).json(result)
      return
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error && error.message ? error.message : 'Failed to send OTP.',
      })
      return
    }
  }

  if (req.path === '/verify-otp') {
    const otp = String(body.otp || '').trim()

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Valid email is required.' })
      return
    }

    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ success: false, message: 'OTP must be 6 digits.' })
      return
    }

    try {
      const result = await verifyOtpForEmail(email, otp)
      res.status(result.statusCode || 200).json({
        success: result.success,
        message: result.message,
        alreadyVerified: Boolean(result.alreadyVerified),
      })
      return
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error && error.message ? error.message : 'Failed to verify OTP.',
      })
      return
    }
  }

  res.status(404).json({
    success: false,
    message: 'Route not found. Use POST /send-otp or POST /verify-otp.',
  })
})

exports.sendEmailOtp = onCall(async (request) => {
  const email = normalizeEmail(request.data && request.data.email)
  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please provide a valid email address.')
  }

  try {
    return await sendOtpToEmail(email)
  } catch (error) {
    throw new HttpsError('internal', error && error.message ? error.message : 'Failed to send OTP.')
  }
})

exports.verifyEmailOtp = onCall(async (request) => {
  const email = normalizeEmail(request.data && request.data.email)
  const otp = String(request.data && request.data.otp ? request.data.otp : '').trim()

  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please provide a valid email address.')
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new HttpsError('invalid-argument', 'OTP must be 6 digits.')
  }

  const result = await verifyOtpForEmail(email, otp)
  if (!result.success) {
    throw new HttpsError('invalid-argument', result.message)
  }

  return {
    success: true,
    alreadyVerified: Boolean(result.alreadyVerified),
    message: result.message,
  }
})
