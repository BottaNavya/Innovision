const crypto = require('crypto')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions')

setGlobalOptions({ maxInstances: 10 })

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const otpsCollection = db.collection('emailOtps')
const otpTtlMs = 10 * 60 * 1000

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
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    return null
  }

  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  }
}

exports.sendEmailOtp = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to request email OTP.')
  }

  const email = normalizeEmail(request.data && request.data.email)
  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please provide a valid email address.')
  }

  const mailer = getMailer()
  if (!mailer) {
    throw new HttpsError(
      'failed-precondition',
      'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM for Functions.'
    )
  }

  const otp = generateOtp()
  const codeHash = hashOtp(otp)
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + otpTtlMs)

  await otpsCollection.doc(email).set(
    {
      uid: request.auth.uid,
      email,
      codeHash,
      expiresAt,
      attempts: 0,
      verified: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  await mailer.transport.sendMail({
    from: mailer.from,
    to: email,
    subject: 'LokGuard AI email OTP',
    text: `Your LokGuard AI verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your LokGuard AI verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
  })

  return {
    success: true,
    expiresInSeconds: Math.floor(otpTtlMs / 1000),
  }
})

exports.verifyEmailOtp = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to verify email OTP.')
  }

  const email = normalizeEmail(request.data && request.data.email)
  const otp = String(request.data && request.data.otp ? request.data.otp : '').trim()

  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please provide a valid email address.')
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new HttpsError('invalid-argument', 'OTP must be 6 digits.')
  }

  const otpDoc = await otpsCollection.doc(email).get()
  if (!otpDoc.exists) {
    throw new HttpsError('not-found', 'OTP not found. Please request a new code.')
  }

  const data = otpDoc.data() || {}
  if (data.uid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'This OTP does not belong to the current user.')
  }

  const now = Date.now()
  const expiresAt = data.expiresAt && typeof data.expiresAt.toMillis === 'function' ? data.expiresAt.toMillis() : 0
  if (!expiresAt || now > expiresAt) {
    throw new HttpsError('deadline-exceeded', 'OTP expired. Please request a new code.')
  }

  if (data.verified) {
    return { success: true, alreadyVerified: true }
  }

  const nextAttempts = Number(data.attempts || 0) + 1
  if (hashOtp(otp) !== data.codeHash) {
    await otpDoc.ref.set(
      {
        attempts: nextAttempts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    throw new HttpsError('invalid-argument', 'Incorrect OTP.')
  }

  await otpDoc.ref.set(
    {
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  await db.collection('users').doc(request.auth.uid).set(
    {
      email,
      verification: {
        emailVerified: true,
        emailVerificationStatus: 'verified',
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  return { success: true }
})
