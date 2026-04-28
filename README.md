# المساعد الذكي لأطفال الأنابيب — Voice-First IVF Demo

A voice-first, RTL Arabic (Egyptian) demo web app for an IVF / ICSI initial
assessment. Built to **showcase the experience** to doctors without using any
paid AI APIs — everything runs in the browser.

> This is a demo. It is **not** a medical product and does not provide medical
> advice.

## Highlights

- **100% free / offline voice stack**
  - Speech-to-Text: Web Speech API (`SpeechRecognition`)
  - Text-to-Speech: `speechSynthesis`
  - Arabic (`ar-EG`) for both directions, with graceful fallbacks
- **Feels intelligent without any AI calls**
  - Rule-based conversation state machine in `lib/conversation.ts`
  - Rule-based "prediction" with weighted factors in `lib/prediction.ts`
  - Tolerant Arabic NLU (digits, yes/no, PCOS, "مش عارفة", etc.)
- **Voice-first UX**
  - Big central mic orb with pulse + waveform animations
  - Auto-listen after every assistant response
  - Auto-speak every reply
  - Live interim transcript + conversation log
- **Complete IVF intake flow**
  1. Age → 2. Trying duration → 3. Cycle regularity → 4. Hormonal / PCOS →
  5. AMH → 6. Previous IVF attempts → 7. Previous pregnancy → 8. Male factor
- **Clean medical report screen**
  - Summary · contributing factors · prediction range · suggested tests
  - Print / PDF export
  - Consent flow: "تحبي نبعت التقرير للمركز؟" → success state
- **Optional file upload** (shows filenames only — no processing)
- **RTL layout**, soft medical palette, glassmorphism, smooth animations

## Tech

- Next.js 14 (App Router) + TypeScript
- TailwindCSS
- Fully client-side — no backend, no API keys

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

> **Browser support:** Web Speech Recognition works best in **Chrome / Edge**
> on desktop and Android. Safari has partial support. Microphone permission
> is required.

## Project structure

```
app/
  layout.tsx          # RTL + Arabic font
  page.tsx            # Home (voice session)
  report/page.tsx     # Initial IVF Assessment Report
  globals.css
components/
  VoiceSession.tsx    # Main orchestrator (STT + TTS + flow)
  VoiceOrb.tsx        # Mic orb with pulse / waveform
  TranscriptPanel.tsx # Live conversation log
  ProgressSteps.tsx   # Step progress bar
  FileUpload.tsx      # Optional PDF/image uploader
  ReportView.tsx      # Full report UI + consent box
lib/
  speech.ts           # Web Speech API wrappers
  conversation.ts     # State machine (scripted smart flow)
  parsing.ts          # Arabic-aware NLU helpers
  prediction.ts       # Rule-based "fake AI" prediction
  session.ts          # sessionStorage handoff between pages
  types.ts
```

## Demo flow

1. User lands on the home page and clicks the **mic orb**.
2. Assistant greets and asks the first question (Egyptian Arabic).
3. Browser listens, shows interim transcript, detects end-of-speech.
4. Rule engine interprets the answer, updates state, and speaks the next line.
5. Mic re-opens automatically — no clicks required for the rest of the flow.
6. After the 8 questions, the assistant gives a spoken prediction range and
   asks for consent to send the report.
7. App navigates to `/report` with a clean printable summary.

## Customization

- **Change the script / tone**: edit `lib/conversation.ts`.
- **Change the scoring**: edit `lib/prediction.ts`.
- **Change colors / fonts**: edit `tailwind.config.ts` and `app/layout.tsx`.
- **Change language**: swap `ar-EG` in `VoiceSession.tsx` and conversation strings.

## Disclaimer (always spoken)

> "ده تقييم مبدئي فقط ولا يغني عن زيارة الطبيب المختص."
