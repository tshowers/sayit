# Communities on SayIt

**Status:** thinking, not decided (October 2026). Nothing here is built yet.
An earlier design doc for "posting to an org" was lost; this replaces it.

## The ask

Nonprofits and influencers have asked how they can use SayIt as a community:
people with a shared connection to an organization talking to each other,
not followers. SayIt stays geared to buying and selling (Looking for /
Selling), with the organization as the context.

## How orgs work today

There are no org records. An org page exists because people's public
profiles name the same business. The app groups those profiles by a slug of
the name ("Kettle & Co. Bakery" → `kettle-co-bakery`, see
`OrgDirectory.swift` in the iOS app), and the page shows those people and
their posts. Being on a page means "I work there".

That already makes a community for employees. It does not work for a
nonprofit's volunteers and donors or an influencer's audience: they don't
work there, so they can't appear on the page.

## Settled

- **No one owns or moderates a community.** Only the master tenant can
  rename, merge, hide or remove one.
- **A community is created by signing up**, the first time someone names an
  organization that doesn't exist yet ("Welcome to your community"). Naming
  one that exists joins it ("Welcome to the T-Mobile community").
- **The topic is the organization**, not hashtags. Hashtag search keeps
  working.
- **Buying and selling stays the point.** The organization is the context;
  Looking for / Selling is the action.

## Considered and set aside: posting to any org

Anyone could post to any org's page, the post would also appear in the main
feed ("Also posted to T-Mobile"), and the AI moderation step would send
unrelated posts to the regular feed only. Set aside because:

1. **"About T-Mobile" isn't "connected to T-Mobile".** Posts about a company
   are customers' complaints, deals and support questions — Reddit's job,
   and "I'm interested" doesn't fit them. Buying and selling among people
   connected to the company is SayIt's job.
2. **A strict relevance check empties the communities.** In a nonprofit's
   community, "selling my couch" or "need a ride Saturday" isn't about the
   nonprofit but is exactly the activity wanted.
3. **Most buy/sell posts have no company**, so the org can only ever be
   optional context on a post.
4. **With no owner, trust comes from who posted.** Anyone could post to the
   T-Mobile page, so a page full of outsiders' posts tells you nothing.
5. **New communities start empty.** Growth comes from an organization
   sharing a link with its people, not from the page existing.

## Leaning: let people join, not just work there

Keep today's self-organizing pages and add two things:

1. **More than one connection per profile.** Keep "Where you work" and add
   "Communities you're part of" (a nonprofit, a church, an influencer's
   company). Posts from those people show on that org's page, as employees'
   posts do now. The author line already says "at T-Mobile"; a visitor
   badge isn't needed because only connected people appear.
2. **A shareable link with a Join button** on every org page
   (sayit.taliferro.tech/c/your-nonprofit). Joining adds the org to your
   profile. The answer to "how do we use SayIt?" becomes: share your link
   and have your people tap Join.

No posting to arbitrary orgs, no relevance check, no moderators.

## Duplicates and misspellings

Needed whether or not the "Join" idea goes ahead, because signup, "Where
you work" and "Communities you're part of" all create orgs from typed names.

1. **Suggest before creating.** As people type, show existing orgs. Matching
   ignores case, punctuation and endings like Inc, LLC, Co. and tolerates
   small typos, so "T Mobile", "T-Mobile Inc." and "TMobile" all offer
   T-Mobile. (Today's slug handles case and punctuation but not "Inc", so
   "T-Mobile Inc" and "T-Mobile" are separate pages.)
2. **Confirm a new name.** Only when nothing matches: "Start the TMobil
   community?" — a second chance to catch the typo.
3. **AI check on new names.** Compare the new name with existing ones and
   catch what matching misses ("Tmo"), plus offensive or junk names. Unsure
   cases are created and put on a review list.
4. **Master-tenant merge.** Merge a duplicate into the right org; its people
   and posts move over and the old name becomes an alias that matches from
   then on.

## Master-tenant tools

A list of orgs with member and post counts, the review list from step 3,
and merge, rename, hide and remove.

## For org leaders

A short guide on the Help page: "Start your community on SayIt in 3 steps"
— sign up and name your organization, share your community link, ask your
people to tap Join.

## Open questions

- Join "Communities you're part of" from the profile only, or also from the
  org page's link (both, probably)?
- Does an org page split posts into "From the team" and "Community", or show
  them together?
- Turning today's derived orgs into stored records (needed for aliases,
  merges and hiding): when and how to migrate.
- What Claude Design should draw once this is decided: the signup matching
  step, the org page with Join and share link, "Communities you're part of"
  on the profile, and the master-tenant tools.
