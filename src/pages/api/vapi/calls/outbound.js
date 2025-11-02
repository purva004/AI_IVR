const VAPI_BASE_URL = 'https://api.vapi.ai';
const OUTBOUND_ASSISTANT_ID = '5b0e2245-21dd-4dbf-98e7-226f80dec5e7';
const OUTBOUND_PHONE_NUMBER_ID = '1e92e17f-b3a1-4d3a-8940-39ce879c7d81';

const respondWithError = (res, status, message) => {
  return res.status(status).json({ message });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);

    return respondWithError(res, 405, 'Method Not Allowed');
  }

  const { phoneNumber } = req.body ?? {};

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return respondWithError(res, 400, 'A phone number with country code is required.');
  }

  const apiKey = process.env.VAPI_PRIVATE_KEY;

  if (!apiKey) {
    return respondWithError(res, 500, 'Vapi API key is not configured on the server.');
  }

  const payload = {
    assistantId: OUTBOUND_ASSISTANT_ID,
    phoneNumberId: OUTBOUND_PHONE_NUMBER_ID,
    customer: {
      number: phoneNumber.trim()
    }
  };

  try {
    const response = await fetch(`${VAPI_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        result?.message ||
        result?.error ||
        result?.errors?.map?.(err => err?.message || err)?.filter(Boolean)?.join(', ') ||
        'Failed to initiate outbound call.';

      return respondWithError(res, response.status, message);
    }

    return res.status(200).json({
      message: 'Outbound call initiated.',
      call: result
    });
  } catch (error) {
    console.error('Failed to create outbound call with Vapi:', error);

    return respondWithError(res, 502, 'Unable to reach Vapi. Please try again.');
  }
}
