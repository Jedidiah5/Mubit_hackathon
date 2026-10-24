Here's a prompt you can paste into a new agent as it is. Fill in the **Current status** section first, because it doesn't know what you've done since last night.

```markdown
# Context: BriefToFloor — Night Shift hackathon (Mubit), London

You're helping a 2-person team at Night Shift, a 42-hour hackathon run by Mubit.

https://luma.com/nightshift-london

 It's Saturday morning. Code freeze is **Sunday 25 Oct, 5:00am London**; judging starts 10:30, and finalists demo on stage at 12:30. The demo is about 3 minutes and must be live. Be direct: if something in this plan is wrong or won't work, say so plainly instead of going along with it.

## The hackathon brief
Build a product that routes its LLM calls through Mubit and turns human corrections into model updates for a recurring task. We're on the "Recurring tasks" track. Every LLM call in the project must go through Mubit.

Four criteria, weighted equally:
1. **Use of Mubit**: show a correction turning into a model update in the demo.
2. **Usefulness**: a real recurring task someone would want handled.
3. **Technical execution**: it works and holds up under questions.
4. **Demo**: clear, live, under the time limit.

## The problem we're solving
Hotels, wedding venues and conference centres get event enquiry emails all day. Before a coordinator can send a quote, she has to turn each vague email into a room setup by hand: which layout, how many tables, stage or not, dance floor, bar, step-free access. It's slow, and slow quotes lose bookings.

Example email: "Wedding for about 120, speeches then dancing, my gran uses a wheelchair."
→ banquet layout, 120 guests, stage, dance floor, step-free access.

## What we're building
**BriefToFloor**: paste an enquiry email, and the venue's hall is laid out in 3D in seconds. The coordinator checks it, fixes anything wrong with one click, and every fix makes the model better at this venue's habits.

The user is the venue's coordinator, not the person who sent the email.

## How it works
1. **Email in.** The coordinator pastes the enquiry (forwarding from an inbox is out of scope).
2. **One LLM call, through Mubit:** the email goes in, a short JSON form comes out. This is the ONLY AI job in the product, and it's the recurring task.
3. **Plain code, no AI:** Three.js places the furniture in a fixed hall from that JSON. The AI never outputs positions.
4. **Correction:** the coordinator changes a field (e.g. banquet → cabaret), the room rearranges, and the correction is saved.
5. **Learning loop:** saved corrections are fed back so later answers come out right, and Mubit trains a small model (an "adapter") on those correct answers.
6. **Optional, only if time allows:** a price quote computed in code from a venue price list.

## The hall (fixed, defined in a config file, not by AI)
One invented venue, "The Grand Hall": about 32 m × 22 m, stage on the back wall centre, bar on the right wall, main doors front centre, step-free exit on the left wall near the front. Same hall every time; only the furniture changes.

## Output schema (freeze this)
```json
{
  "layout": "banquet | cabaret | theatre | reception",
  "guests": 120,
  "stage": true,
  "dance_floor": true,
  "bar": true,
  "step_free": true
}
```
Keep the output short. Table types and counts are computed in code from the layout and guest count.

## Venue house rules (the thing a generic model can't know)
These make the task need learning. Without them, GPT gets everything right, Mubit has nothing to learn, and the version may come back "Prompt only".
- Awards nights are always cabaret.
- AGMs and shareholder meetings are theatre.
- Over 150 seated guests means long banquet tables, because rounds don't fit.
- Any wheelchair or mobility mention means step_free = true and accessible tables near the step-free exit.
- "Networking" means reception with poseur tables.
- (Add 3–5 more of the same kind.)

**These rules must NOT be in the system prompt.** The venue's knowledge arrives only through corrections. "GPT with the rules in the prompt" is a baseline we measure against.

## Mubit facts (from docs.mubit.ai; these constrain the design)
- **Connecting:** OpenAI SDK with `base_url="https://api.mubit.ai/openai/v1"` and a Mubit key (`mbt_...`). Keep normal model IDs.
- **Call from the server only** (a Next.js API route). Mubit doesn't answer CORS preflight, so browser calls fail.
- **A "task"** is calls sharing the same model, system prompt, tools, tool choice and output format. Changing any word in the system prompt (other than numbers, dates or IDs) starts a new task and resets the example count. **The system prompt, model and output format are frozen.** Everything that varies goes in the user message.
- **Training:** first trains at 25 *kept* examples (not every call is kept). Daily training limit resets 00:00 UTC (01:00 London). There's a pause between trainings. Expect only 2–3 versions all weekend.
- **Grading:** each adapter version is graded on how closely it matches GPT's answers. Results: Passed / Below target / Prompt only / Malformed tool calls / Not tested. Only Passed versions can be tried.
- **No correction API.** You can't submit a corrected answer. The only human feedback is a manual Good/Bad button on each call in the console's Requests page; the docs don't say what it does.
- **The app can't call the adapter.** There's no Mubit model ID. Adapters can only be tried in the console's "Try models" page: a daily call limit, 3 adapter starts per UTC day, and the first start takes minutes.
- **Eval calls:** send header `x-middleware-record: off` so they never become training data.
- **Sessions:** send a unique `metadata.session_id` per enquiry. Mubit holds back test cases by session.
- **Long examples can fail training.** Keep inputs and outputs short.

## The correction workaround (our core design decision)
Because Mubit only learns to copy GPT, the plan is to make GPT answer correctly and let Mubit copy it:
1. Store each correction in our backend (e.g. "Annual staff awards dinner, 90 guests" → cabaret).
2. For each new enquiry, put the 5–8 most relevant past corrections as short notes in the **user message**, above the email.
3. GPT applies the house rule, Mubit keeps that correct answer as an example, and v2 trains on it.

Pitch line: the coordinator teaches GPT instantly, and Mubit turns that into a smaller, cheaper model the venue owns.

Known weakness: a judge may say the fix comes from the prompt notes, not from Mubit. Our answer depends on whether v2 passes, and on whether v2 applies the rules without the notes (test that in Try models).

## Data
No real emails, so generate about 150 synthetic enquiries. Write them backwards: pick the correct JSON answer first, then write an email that implies it without stating it. Vary tone, length, typos, vague counts ("about 100, maybe a few more") and hidden clues ("my nan uses a walker", "there'll be a DJ"). Make about a third of them hit a house rule. Generate them with GPT through Mubit too (a different system prompt, so it's a separate task). Hold out about 40 for evaluation, and hand-write the 3–4 trickiest for the live demo.

## Evaluation (the slide that wins "Use of Mubit")
On held-out enquiries, using a ±5% tolerance on guest counts:
| Model | Accuracy | Cost | Latency |
|---|---|---|---|
| GPT, plain prompt | | | |
| GPT, house rules in the prompt | | | |
| Adapter v1 | | | |
| Adapter v2 (after corrections) | | | |

Adapter rows have to be run by hand in Try models, so keep that set to about 15. If v2 doesn't beat "rules in the prompt" on accuracy, the claim becomes "same accuracy, cheaper and faster, on a model the venue owns". Only claim that if measured.

## Scope cuts (do not expand)
- 4 layouts, 1 fixed hall, no dragging furniture, no floor-plan uploads, no inbox integration.
- Pricing only after the core loop works.

## Stack
Next.js + TypeScript (the team's strength), an API route for the Mubit call, Three.js (plain or react-three-fiber) for the hall.

## Demo flow (~3 min)
1. The pain: coordinators draw floor plans by hand before every quote.
2. Paste an enquiry, and the hall builds.
3. A prepared tricky enquiry that breaks a house rule; GPT gets it wrong.
4. One click fixes it, and the room rearranges.
5. A similar enquiry now comes back right.
6. v1 → v2 in Mubit's adapter History, then the eval table.
7. A judge types their own enquiry.
8. Close: "Prismm draws the plan, iVvy writes the proposal; we read the brief and do both instantly, on our own model."

## Open questions for the Mubit team
1. Does rating a call Bad drop it from training?
2. Is there any way (hackathon-only or not) to submit a corrected answer?
3. Can a passing adapter serve live calls? (The Requests page has a "Served by" column.)
4. What are our Try models and training limits?

## Fallback
If the loop can't produce a passing version by Saturday noon, switch to "Mark-alike" (short-answer marking that learns a teacher's standards). It's the same architecture and eval with a simpler front end. Don't switch after noon.

## Current status (FILL IN)
- Mubit account, key, Adapters page visible?: 
- System prompt frozen? (paste it):
- Calls sent so far / kept examples / any version trained?:
- What's built:
- Answers from the Mubit team:

## What I need from you now
[Write the specific job, e.g. "Build the Three.js hall that takes the JSON above and places furniture for all 4 layouts", or "Write the synthetic data generator".]
```

The last two sections matter most. Without the current status, a new agent will start planning from zero, and you can't afford that this morning.