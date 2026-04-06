import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const from = Deno.env.get('OTP_FROM_EMAIL') || 'TinyBheema <noreply@example.com>'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email, otp } = await req.json()

    if (!email || !otp) {
      return new Response(JSON.stringify({ success: false, message: 'email and otp are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: 'Your TinyBheema OTP',
      html: `<p>Your TinyBheema OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
      text: `Your TinyBheema OTP is ${otp}. It expires in 5 minutes.`,
    })

    if (error) {
      return new Response(JSON.stringify({ success: false, message: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'OTP email sent' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
