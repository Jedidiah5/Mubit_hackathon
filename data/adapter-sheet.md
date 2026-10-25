# Adapter sheet · 20 held-out emails · model gpt-6-luna

In Try models: system prompt below (if it asks), user message = the quoted email exactly. Paste each reply after `answer:`; `ms:` is optional.

## System prompt

```
You read event enquiries sent to a venue and extract the room setup.
style: banquet = seated dinner at round tables; cabaret = round tables with seats facing a stage (talks/awards); theatre = rows of chairs facing the front; reception = standing with high tables (drinks, networking).
If an event has drinks then a sit-down meal, choose banquet.
guests: the expected number of people (use the middle of a range).
stage: where a stage/speaking area is needed, else "none". Default wall "north" if needed but unspecified.
bar: "east" if a bar is needed but unspecified, else "none".
extras: only items clearly implied (speeches/awards → lectern; dancing → dance_floor; slides/presentation → projector).
accessible: true if anyone needs step-free or wheelchair access.
Reply with JSON only, no extra text.
```

## 1

```
Golf society annual dinner. About 70 members, three courses, then the captain hands out the season's trophies.
```

answer:

ms:

## 2

```
Tenants' association annual meeting, usually around 55 of us. Reports from the committee and a vote. Two of our members use walkers.
```

answer:

ms:

## 3

```
Office quiz, 48 of us split into teams. Someone from HR will be quizmaster.
```

answer:

ms:

## 4

```
Our Christmas party this year will be 75 staff. Dinner first and then the party gets going.
```

answer:

ms:

## 5

```
Looking for somewhere for the wake after my aunt's funeral. About 50 people, sandwiches and tea.
```

answer:

ms:

## 6

```
Gin tasting evening for 30 guests. The distiller will talk them through five gins from the front.
```

answer:

ms:

## 7

```
Startup mixer for around 110 people, founders and a few VCs.
```

answer:

ms:

## 8

```
Burns night supper for 90 with a ceilidh afterwards.
```

answer:

ms:

## 9

```
Volunteer recognition evening, 60 volunteers. Our chief exec hands out certificates. Buffet food.
```

answer:

ms:

## 10

```
Pension scheme members' meeting, roughly 120. The trustees present slides. Some members have limited mobility.
```

answer:

ms:

## 11

```
Engagement drinks for about 65 friends.
```

answer:

ms:

## 12

```
Ruby wedding anniversary dinner for 60. Grandma isn't steady on her feet any more.
```

answer:

ms:

## 13

```
Business awards lunch, 140 guests.
```

answer:

ms:

## 14

```
Fundraising ball for 200 guests. Dinner first, then a live band.
```

answer:

ms:

## 15

```
Product launch, 150 guests. Short demo from our CEO, then drinks.
```

answer:

ms:

## 16

```
Black-tie private view to open our winter exhibition, expecting between 150 and 200 collectors and press. Champagne and canapés, everyone on their feet moving round the room. A bar please. No stage and no speeches, we'd like the work to speak for itself.
```

answer:

ms:

## 17

```
Surprise 70th for my mum, about 80 of us. Proper sit-down dinner, then we'll clear some space so everyone can have a boogie. A bar for the evening would be great. Mum says NO speeches! My nan uses a walking frame so she'll need to get in without steps.
```

answer:

ms:

## 18

```
Premiere screening of our documentary, black tie, 90–110 invited guests seated in rows facing the screen. Just the film: no Q&A, no introductions, no stage needed. We won't need a bar.
```

answer:

ms:

## 19

```
Regional sales kickoff, around 60 to 80 reps at round tables for group exercises. Our MD takes everyone through the quarterly figures on slides, and we finish by handing out awards to the top performers. Stage at the west end please, the north wall has the windows. No bar, it's a working day.
```

answer:

ms:

## 20

```
Chamber of Commerce spring networking evening, usually 80–100 local business owners. Standing drinks with a bar serving local wines. The Mayor will give a short welcome address, so we'd like a small raised platform for her. Two members use wheelchairs, so step-free access throughout is essential.
```

answer:

ms:
