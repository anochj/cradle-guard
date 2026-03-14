import type { Hazard, DangerousAction } from '../types'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

async function callGemini(apiKey: string, body: object): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Scan a base64 image and return detected hazards */
export async function scanRoomForHazards(
  imageBase64: string,
  apiKey: string
): Promise<Hazard[]> {
  const text = await callGemini(apiKey, {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: imageBase64,
          },
        },
        {
          text: `You are a child safety expert. Examine this image of a room where a baby lives.
Identify all objects or situations that could be dangerous for a baby or toddler.
Respond ONLY with a valid JSON array, no markdown, no explanation.
Each item must have: id (uuid), name (short label), severity ("low"|"medium"|"high"), description (1 sentence).
Example: [{"id":"...","name":"Electrical outlet","severity":"high","description":"Baby could insert fingers or objects."}]`,
        },
      ],
    }],
    generationConfig: { temperature: 0.2 },
  })

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as Hazard[]
  } catch {
    return []
  }
}

/** Given detected hazards, generate a list of dangerous actions a baby might take */
export async function generateDangerousActions(
  hazards: Hazard[],
  apiKey: string
): Promise<DangerousAction[]> {
  const hazardList = hazards.map(h => h.name).join(', ')
  const text = await callGemini(apiKey, {
    contents: [{
      parts: [{
        text: `You are a child safety expert. A baby's room contains these hazards: ${hazardList}.
Generate a list of specific dangerous actions or situations the baby could get into.
Respond ONLY with a valid JSON array, no markdown, no explanation.
Each item must have: id (uuid), text (action description, e.g. "Baby pulls lamp off nightstand"), source ("generated"), enabled (true).
Generate 8-12 items that are specific and realistic.`,
      }],
    }],
    generationConfig: { temperature: 0.4 },
  })

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as DangerousAction[]
  } catch {
    return []
  }
}

/** Check a single camera frame against a list of danger actions */
export async function checkFrameForDangers(
  imageBase64: string,
  watchActions: string[],
  sensitivity: 'low' | 'medium' | 'high',
  apiKey: string
): Promise<{ triggered: string[]; allClear: boolean }> {
  if (watchActions.length === 0) return { triggered: [], allClear: true }

  const sensitivityNote = {
    low: 'Only flag situations where danger is clearly, definitely occurring.',
    medium: 'Flag situations where danger seems likely or is beginning to happen.',
    high: 'Flag any situation where there is any possibility of danger.',
  }[sensitivity]

  const text = await callGemini(apiKey, {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        {
          text: `You are monitoring a baby's safety. ${sensitivityNote}
Check this image against the following list of dangerous situations:
${watchActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Respond ONLY with a JSON object: {"triggered": [...list of matched situation strings...], "allClear": true|false}
Only include items from the list that are visibly occurring in the image. If nothing is dangerous, return {"triggered":[],"allClear":true}.`,
        },
      ],
    }],
    generationConfig: { temperature: 0.1 },
  })

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { triggered: [], allClear: true }
  }
}
