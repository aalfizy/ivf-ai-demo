import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

interface TTSBody {
  text?: string;
  voiceId?: string;
}

/**
 * Server-side proxy to ElevenLabs.
 * The API key is read from process.env.ELEVENLABS_API_KEY and never
 * sent to the browser.
 *
 * Body: { text: string, voiceId?: string }
 * Response: audio/mpeg stream
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return jsonError("missing_api_key", 500);
  }

  let body: TTSBody;
  try {
    body = (await req.json()) as TTSBody;
  } catch {
    return jsonError("invalid_body", 400);
  }

  const text = (body.text ?? "").trim();
  if (!text) return jsonError("empty_text", 400);
  if (text.length > 1500) return jsonError("text_too_long", 413);

  const voiceId =
    body.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    "EXAVITQu4vr4xnSDxMaL";
  const modelId =
    process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  // Add a tiny pre-pause and slow the cadence by leveraging punctuation.
  // ElevenLabs models respect <break time="..."/> tags within the text.
  const enriched = enrichForNaturalPauses(text);

  let elRes: Response;
  try {
    elRes = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: enriched,
          model_id: modelId,
          // Warmer, slightly more emotional voice settings.
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.78,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      }
    );
  } catch (err) {
    return jsonError("upstream_unreachable", 502, String(err).slice(0, 200));
  }

  if (!elRes.ok) {
    let detail = "";
    try {
      detail = (await elRes.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    return jsonError("elevenlabs_error", 502, detail, elRes.status);
  }

  return new Response(elRes.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

function jsonError(
  code: string,
  status: number,
  detail?: string,
  upstreamStatus?: number
) {
  return Response.json(
    { error: code, detail, upstreamStatus },
    { status }
  );
}

/**
 * Insert subtle SSML-style breaks for more natural cadence in Arabic.
 * Multilingual_v2 + eleven_v3 understand <break time="X.Xs" />.
 */
function enrichForNaturalPauses(text: string): string {
  return (
    text
      // Long pause after sentence enders
      .replace(/([.؟!])\s+/g, '$1 <break time="0.45s" /> ')
      // Short pause after Arabic and Latin commas
      .replace(/([،,])\s+/g, '$1 <break time="0.25s" /> ')
      // Tiny breath before the closing disclaimer phrase
      .replace(/(تقييم مبدئي)/g, '<break time="0.2s" /> $1')
      .trim()
  );
}
