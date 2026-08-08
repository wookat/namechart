# Email lifecycle templates (NOT ACTIVE — red line)

Status: templates only. No sending until (a) Resend (or equivalent) key provisioned, (b) double opt-in confirmation flow built, (c) one-click unsubscribe + `List-Unsubscribe` header implemented. Current subscribe box only stores addresses (D1 `subscribers`).

Sender: NameChart <hello@zalize.com> · plain, warm tone per brand guide · footer on every mail: "You're receiving this because you confirmed your subscription at namechart.zalize.com · [Unsubscribe]".

## 0. Double opt-in confirmation (sent immediately on signup, prerequisite for everything else)
Subject: Confirm your NameChart subscription
> You (or someone with this address) asked for name-trend updates from NameChart. Click to confirm: {confirm_url}
> If this wasn't you, ignore this email — you won't be subscribed.

## 1. Welcome (after confirmation)
Subject: Welcome — here's how to get the most from NameChart
> Thanks for confirming! Three things people love:
> 1) Every name's full 146-year chart — try your own: {site}/search
> 2) Save names with ♡ and share the shortlist with your partner: {site}/favorites
> 3) Naming a sibling? The Matcher finds names that fit: {site}/matcher
> We'll email at most once a month with real data trends. — NameChart

## 2. Monthly trends letter (template)
Subject: {Month}'s name trends: {headline_name} keeps climbing
> This month in the data: {3 short data-verified bullets from /trending}
> Rising: {names} · Falling: {names} · Name of the month: {name} ({one-line data fact})
> Explore the full charts: {site}/trending

## 3. Win-back / re-engagement (≥90 days inactive; only if engagement tracking exists — currently it does not, so N/A)

Compliance checklist before first send: double opt-in ✅ required · unsubscribe link + List-Unsubscribe header ✅ required · physical/operator identification in footer · no purchased lists ever.
