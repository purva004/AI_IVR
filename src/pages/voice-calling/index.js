import { useCallback, useEffect, useRef, useState } from 'react'

import ActiveCallDetail from '../../@core/layouts/components/ActiveCallDetail'
import Button from '../../@core/layouts/components/base/Button'
import Vapi from '@vapi-ai/web'
import { isPublicKeyMissingError } from '../../utils'

const vapi = new Vapi('9a05e800-6a2e-456b-a8c3-270f0495a201')

const defaultAssistantOptions = {
  id: '5b0e2245-21dd-4dbf-98e7-226f80dec5e7',
  orgId: 'b79af8ae-3adf-461a-a7d1-44ce44d4fd7e',
  name: 'Airio',
  voice: {
    voiceId: 'Rohan',
    provider: 'vapi'
  },
  createdAt: '2025-10-29T12:06:51.996Z',
  updatedAt: '2025-10-29T13:14:21.282Z',
  model: {
    model: 'gpt-4.1',
    messages: [
      {
        role: 'system',
        content: `[Identity]  
You are a male multilingual customer support voice assistant for Airio, an Indian telecom company. Your role is to assist users with queries related to balance, validity, data balance, and available recharge facilities. You support all 22 Indian languages along with English.

[Style]  
- Greet the user in a gender-neutral manner and ask for the user's language preference or name to determine the initial spoken language.
- Use a warm, friendly tone that resonates with users of all ages.
- Speak clearly and naturally, emphasizing simplicity to ensure understanding.
- Include localized expressions or cultural references to make interactions more relatable when suitable.

[Response Guidelines]  
- Maintain a conversational and approachable manner, adapting language formality based on user's preference for any of the supported Indian languages or English.
- Address one query at a time to ensure clarity.
- Continue responding in the language the user initially requested without switching languages.
- Confirm important information explicitly when necessary.
- Avoid technical jargon unless the user indicates familiarity.

[Task & Goals]  
1. Greet the user and inquire about their registration status.  
   - If not registered, guide them on how to obtain a new connection and provide details for available recharge plans, mentioning only 3-4 plans briefly.
   - If registered, ask for their phone number to fetch and present their basic details concisely.

2. Once registration status is confirmed, inquire about their preferred language for the conversation.  
   - Use this language for the rest of the interaction.

3. Address the user's query by identifying the type of information they are seeking:  
   - Balance, validity, data balance, or recharge details.  
   - < wait for user response >

4. Provide accurate information and support based on the user's request:  
   - Use specific tools like 'checkBalance', 'checkValidity', 'dataUsage', or 'rechargeOptions' as needed.

5. Ensure understanding and offer additional assistance if required.

[Error Handling / Fallback]  
- If the user's input is unclear, ask a clarifying question to guide them: "Can you please clarify your request concerning balance, data, or recharges?"
- If certain information is unavailable, apologize and provide an alternative solution or resource: "I'm sorry, that information is not currently available. Please check our app or website for more details or contact customer support."`
      }
    ],
    provider: 'openai',
    maxTokens: 400,
    knowledgeBase: {
      fileIds: ['e56059ee-678e-4497-a7f5-e80bf92b823a'],
      provider: 'google'
    }
  },
  forwardingPhoneNumber: '+918766295908',
  firstMessage: 'Hi there, this is saarthi from Airio customer support. How can I help you today?',
  voicemailMessage:
    "Hello, this is Alex from TechSolutions customer support. I'm sorry we missed your call. Please call us back so we can help resolve your issue.",
  endCallFunctionEnabled: true,
  endCallMessage: "Thank you for choosing TechSolutions. I'm glad I could help you today. Have a great day!",
  transcriber: {
    model: 'gemini-2.0-flash',
    language: 'Multilingual',
    provider: 'google'
  },
  silenceTimeoutSeconds: 179,
  firstMessageMode: 'assistant-speaks-first-with-model-generated-message',
  backgroundDenoisingEnabled: true,
  artifactPlan: {
    transcriptPlan: {
      enabled: false
    },
    recordingEnabled: false,
    loggingEnabled: false
  },
  stopSpeakingPlan: {
    numWords: 6,
    voiceSeconds: 0.5
  },
  compliancePlan: {
    hipaaEnabled: false,
    pciEnabled: false
  },
  isServerUrlSecretSet: false
}

const buildAssistantPayload = options => {
  const payload = {
    name: options?.name,
    firstMessage: options?.firstMessage,
    voice: options?.voice ? { ...options.voice } : undefined,
    model: options?.model ? { ...options.model } : undefined,
    transcriber: options?.transcriber ? { ...options.transcriber } : undefined,
    endCallFunctionEnabled: options?.endCallFunctionEnabled,
    endCallMessage: options?.endCallMessage,
    backgroundDenoisingEnabled: options?.backgroundDenoisingEnabled,
    silenceTimeoutSeconds: options?.silenceTimeoutSeconds,
    artifactPlan: options?.artifactPlan
      ? {
          ...options.artifactPlan,
          transcriptPlan: options.artifactPlan?.transcriptPlan
            ? { ...options.artifactPlan.transcriptPlan }
            : undefined
        }
      : undefined
  }

  if (!payload.voice) delete payload.voice
  if (!payload.model) delete payload.model
  if (!payload.transcriber) delete payload.transcriber
  if (typeof payload.endCallFunctionEnabled !== 'boolean') delete payload.endCallFunctionEnabled
  if (!payload.endCallMessage) delete payload.endCallMessage
  if (typeof payload.backgroundDenoisingEnabled !== 'boolean') delete payload.backgroundDenoisingEnabled
  if (typeof payload.silenceTimeoutSeconds !== 'number') delete payload.silenceTimeoutSeconds
  if (!payload.artifactPlan) delete payload.artifactPlan

  return payload
}

const VoiceConsole = () => {
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [assistantOptionsState, setAssistantOptionsState] = useState(defaultAssistantOptions)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [hasCallEnded, setHasCallEnded] = useState(false)
  const [callRetryCount, setCallRetryCount] = useState(0)
  const [callError, setCallError] = useState(null)
  const [outboundNumber, setOutboundNumber] = useState('')
  const [placingOutboundCall, setPlacingOutboundCall] = useState(false)
  const [outboundFeedback, setOutboundFeedback] = useState(null)
  const retryTimeoutRef = useRef(null)

  const { showPublicKeyInvalidMessage, setShowPublicKeyInvalidMessage } = usePublicKeyInvalid()

  useEffect(() => {
    let mounted = true

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/vapi_profiles/latest')
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`)
        }

        const profile = await res.json()
        if (!mounted || !profile) return

        setAssistantOptionsState(prev => ({
          ...prev,
          id: profile.id ?? prev.id,
          orgId: profile.orgId ?? prev.orgId,
          createdAt: profile.createdAt ?? prev.createdAt,
          updatedAt: profile.updatedAt ?? prev.updatedAt,
          name: profile.name ?? prev.name,
          firstMessage: profile.firstMessage ?? prev.firstMessage,
          voice: {
            provider: profile.voice?.provider ?? prev.voice?.provider,
            voiceId: profile.voice?.voiceId ?? prev.voice?.voiceId,
            model: profile.voice?.model ?? prev.voice?.model
          },
          model: {
            provider: profile.model?.provider ?? prev.model?.provider,
            model: profile.model?.model ?? prev.model?.model,
            messages: profile.model?.messages?.length ? profile.model.messages : prev.model?.messages,
            maxTokens: profile.model?.maxTokens ?? prev.model?.maxTokens,
            knowledgeBase: profile.model?.knowledgeBase ?? prev.model?.knowledgeBase
          },
          forwardingPhoneNumber: profile.forwardingPhoneNumber ?? prev.forwardingPhoneNumber,
          voicemailMessage: profile.voicemailMessage ?? prev.voicemailMessage,
          transcriber: {
            provider: profile.transcriber?.provider ?? prev.transcriber?.provider,
            model: profile.transcriber?.model ?? prev.transcriber?.model,
            language: profile.transcriber?.language ?? prev.transcriber?.language
          },
          endCallFunctionEnabled: profile.endCallFunctionEnabled ?? prev.endCallFunctionEnabled,
          endCallMessage: profile.endCallMessage ?? prev.endCallMessage,
          backgroundDenoisingEnabled: profile.backgroundDenoisingEnabled ?? prev.backgroundDenoisingEnabled,
          firstMessageMode: profile.firstMessageMode ?? prev.firstMessageMode,
          artifactPlan: profile.artifactPlan
            ? {
                transcriptPlan: {
                  enabled:
                    profile.artifactPlan?.transcriptPlan?.enabled ??
                    prev.artifactPlan?.transcriptPlan?.enabled
                },
                recordingEnabled:
                  profile.artifactPlan?.recordingEnabled ?? prev.artifactPlan?.recordingEnabled,
                loggingEnabled:
                  profile.artifactPlan?.loggingEnabled ?? prev.artifactPlan?.loggingEnabled
              }
            : prev.artifactPlan,
          stopSpeakingPlan: profile.stopSpeakingPlan ?? prev.stopSpeakingPlan,
          compliancePlan: profile.compliancePlan ?? prev.compliancePlan,
          isServerUrlSecretSet: profile.isServerUrlSecretSet ?? prev.isServerUrlSecretSet,
          silenceTimeoutSeconds: profile.silenceTimeoutSeconds ?? prev.silenceTimeoutSeconds
        }))

        setProfileError(null)
      } catch (err) {
        console.error('Failed to fetch vapi profile', err)
        if (mounted) {
          setProfileError('Unable to load assistant configuration.')
        }
      } finally {
        if (mounted) {
          setProfileLoading(false)
        }
      }
    }

    fetchProfile()

    return () => {
      mounted = false
    }
  }, [])

  const startCall = useCallback(
    async (isRetry = false) => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      if (!isRetry) {
        setCallError(null)
        setHasCallEnded(false)
        setCallRetryCount(0)
      }

      setConnecting(true)

      try {
        const assistantId = assistantOptionsState?.id
        if (assistantId) {
          await vapi.start(assistantId)
        } else {
          const assistantPayload = buildAssistantPayload(assistantOptionsState)
          await vapi.start(assistantPayload)
        }
      } catch (error) {
        console.error('Failed to start call', error)

        const issueMessages = Array.isArray(error?.error?.errors)
          ? error.error.errors
              .map(issue => {
                if (typeof issue === 'string') {
                  return issue
                }

                if (typeof issue?.message === 'string') {
                  return issue.message
                }

                if (typeof issue?.error === 'string') {
                  return issue.error
                }

                return null
              })
              .filter(Boolean)
              .join(', ')
          : ''

        const detailedMessage =
          issueMessages ||
          (typeof error?.error?.message === 'string' && error.error.message) ||
          (typeof error?.errorMsg === 'string' && error.errorMsg) ||
          (typeof error?.message === 'string' && error.message) ||
          'Unable to start the call. Please try again.'

        if (!isRetry) {
          setCallError(detailedMessage)
        }
        setConnecting(false)
      }
    },
    [assistantOptionsState]
  )

  const endCall = useCallback(() => {
    vapi.stop()
  }, [])

  const handleOutboundCall = useCallback(async () => {
    const trimmed = outboundNumber.trim()

    setOutboundFeedback(null)

    if (!trimmed) {
      setOutboundFeedback({ type: 'error', message: 'Enter a phone number with country code.' })

      return
    }

    const normalized = trimmed.replace(/\s+/g, '')

    if (!/^[+][0-9]{8,15}$/.test(normalized)) {
      setOutboundFeedback({
        type: 'error',
        message: 'Use the international format, for example +14155552671.'
      })

      return
    }

    setPlacingOutboundCall(true)

    try {
      const response = await fetch('/api/vapi/calls/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: normalized
        })
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof result?.message === 'string'
            ? result.message
            : typeof result?.error === 'string'
            ? result.error
            : 'Unable to start the outbound call.'
        )
      }

      setOutboundNumber('')
      setOutboundFeedback({
        type: 'success',
        message: result?.message || 'Outbound call initiated. The assistant will dial shortly.'
      })
    } catch (error) {
      console.error('Failed to initiate outbound call', error)
      setOutboundFeedback({
        type: 'error',
        message:
          typeof error?.message === 'string'
            ? error.message
            : 'Failed to start the outbound call. Please try again.'
      })
    } finally {
      setPlacingOutboundCall(false)
    }
  }, [outboundNumber])

  useEffect(() => {
    const handleCallStart = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      setConnecting(false)
      setConnected(true)
      setHasCallEnded(false)
      setShowPublicKeyInvalidMessage(false)
      setCallError(null)
      setCallRetryCount(0)
    }

    const handleCallEnd = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      setConnecting(false)
      setConnected(false)
      setShowPublicKeyInvalidMessage(false)
      setHasCallEnded(true)
    }

    const handleError = error => {
      console.error(error)
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      setConnecting(false)

      const message =
        (typeof error?.errorMsg === 'string' && error.errorMsg) ||
        (typeof error?.message === 'string' && error.message) ||
        (typeof error?.error?.error === 'string' && error.error.error) ||
        ''

      const fallbackMessage = message || 'Call ended unexpectedly. Please try again.'
      const normalizedMessage = message.toLowerCase()

      const shouldRetry =
        !connected &&
        !hasCallEnded &&
        callRetryCount < 1 &&
        (normalizedMessage.includes('meeting has ended') ||
          normalizedMessage.includes('signaling connection interrupted'))

      if (shouldRetry) {
        setCallRetryCount(prev => prev + 1)
        retryTimeoutRef.current = setTimeout(() => {
          startCall(true)
        }, 600)
      } else {
        if (!connected) {
          setHasCallEnded(true)
          setCallError(fallbackMessage)
        }

        if (isPublicKeyMissingError({ vapiError: error })) {
          setShowPublicKeyInvalidMessage(true)
        }
      }
    }

    vapi.on('call-start', handleCallStart)
    vapi.on('call-end', handleCallEnd)
    vapi.on('speech-start', () => {
      setAssistantIsSpeaking(true)
    })
    vapi.on('speech-end', () => {
      setAssistantIsSpeaking(false)
    })
    vapi.on('volume-level', level => {
      setVolumeLevel(level)
    })
    vapi.on('function-call', payload => {
      if (payload?.name === 'endCall') {
        vapi.stop()
      }
    })
    vapi.on('error', handleError)

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      vapi.removeAllListeners?.()
    }
  }, [callRetryCount, connected, hasCallEnded, setShowPublicKeyInvalidMessage, startCall])

  const showStartButton = !connected

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a'
      }}
    >
      <div style={{ width: 'min(540px, 100%)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section
          style={{
            padding: '32px',
            borderRadius: '24px',
            background: '#111c44',
            boxShadow: '0 24px 50px rgba(15, 23, 42, 0.45)',
            color: '#f8fafc',
            textAlign: 'center',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px' }}>Customer Support</h1>
          <p style={{ marginBottom: '24px', opacity: 0.8 }}>
            {connected
              ? 'You are talking to the Airio assistant.'
              : 'Start a call to speak with the Airio voice assistant.'}
          </p>

          {profileLoading && <p style={{ marginBottom: '16px', opacity: 0.7 }}>Loading assistant profile…</p>}
          {profileError && (
            <p style={{ marginBottom: '16px', color: '#f87171' }}>{profileError}</p>
          )}

          {showStartButton ? (
            <Button
              label={connecting ? 'Connecting…' : 'Start Voice Call'}
              onClick={startCall}
              isLoading={connecting}
              disabled={profileLoading || Boolean(profileError)}
            />
          ) : (
            <ActiveCallDetail
              assistantIsSpeaking={assistantIsSpeaking}
              volumeLevel={volumeLevel}
              onEndCallClick={endCall}
              endCallEnabled={assistantOptionsState.endCallFunctionEnabled}
            />
          )}

          {callError ? (
            <p style={{ marginTop: '16px', color: '#f87171', fontSize: '0.9rem' }}>{callError}</p>
          ) : null}

          {!connected && hasCallEnded && !callError ? (
            <p style={{ marginTop: '16px', fontSize: '0.85rem', opacity: 0.7 }}>
              Your call has ended. Start a new call when you are ready.
            </p>
          ) : null}

          {showPublicKeyInvalidMessage ? <PleaseSetYourPublicKeyMessage /> : null}
        </section>
        <section
          style={{
            padding: '28px',
            borderRadius: '20px',
            background: '#0d1535',
            boxShadow: '0 20px 36px rgba(8, 15, 35, 0.4)',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '12px' }}>Make a call now to your customer</h2>
          <p style={{ fontSize: '0.95rem', opacity: 0.8, marginBottom: '18px' }}>
            Enter a customer phone number (including the + country code) and the Airio assistant will
            call them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type='tel'
              placeholder='+14155552671'
              value={outboundNumber}
              onChange={event => setOutboundNumber(event.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
            <Button
              label={placingOutboundCall ? 'Dialing…' : 'Make Call'}
              onClick={handleOutboundCall}
              isLoading={placingOutboundCall}
              disabled={placingOutboundCall}
            />
          </div>
          {outboundFeedback ? (
            <p
              style={{
                marginTop: '16px',
                fontSize: '0.9rem',
                color: outboundFeedback.type === 'error' ? '#f87171' : '#34d399'
              }}
            >
              {outboundFeedback.message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  )
}

const usePublicKeyInvalid = () => {
  const [showPublicKeyInvalidMessage, setShowPublicKeyInvalidMessage] = useState(false)

  useEffect(() => {
    if (!showPublicKeyInvalidMessage) return undefined

    const timer = setTimeout(() => {
      setShowPublicKeyInvalidMessage(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [showPublicKeyInvalidMessage])

  return {
    showPublicKeyInvalidMessage,
    setShowPublicKeyInvalidMessage
  }
}

const PleaseSetYourPublicKeyMessage = () => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '25px',
        padding: '10px',
        color: '#fff',
        backgroundColor: '#f03e3e',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}
    >
      Is your Vapi Public Key missing? (recheck your code)
    </div>
  )
}

export default VoiceConsole
