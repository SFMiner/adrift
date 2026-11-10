# Adrift playtest sheet

One full run, headphones on. Start the server (`python -m http.server 8765` in this folder), open
<http://localhost:8765/>, and play without `?debug`. Jot answers under each heading; short is fine.

Browser used (Chrome / Vivaldi / other):

Start time:            End time:

## 1. Did anything break?

Anything stuck, overlapping, unreadable, or silent that should not be.

## 2. The light

- Did you feel the world darkening before you noticed it? Or did you notice nothing until late?
- The far water goes black at half spent, the sand goes cold at a quarter left, and only the memories
  give light under a tenth. Which of those did you see happen? Too abrupt, too faint, right?
- At full light, is the shore too dark to enjoy, or about right?

## 3. Walking and gathering

- Walking speed: too slow, too fast, right?
- Did you hear a fragment before you saw it at least once?
- Thirty fragments on the shore: too many, too few?

## 4. Holding, keeping, and asking

- Was it clear how to keep a fragment (the dark above) and how to set one down (the sand)?
- Did placing feel weighted? Did you ever place something by accident?
- Press and hold to answer: right length (0.9 s), too long, too short?
- Could you tell some questions cost more than others (the size of the small light)? Should you be able to?
- Questions can only be answered once a fragment is in a memory. Did you want to answer while holding?

## 4b. Portraits

- Was it clear that the dark above begins a portrait, and that a frame can take more?
- Arranging the pictures: enough control (move, size, turn)? Did you want layering or colour as in the last screen?
- Writing how they belong together: right moment, right length (256 characters)? Should it be required?
- Setting: did the hold feel like the right weight? Did the stars coming out read as the portrait?
- After setting, questions can still be answered. Should setting close them?
- The light waits while any portrait is open. Right, or should it go out regardless?
- Pictures: which ones are wrong for their fragment, or unreadable? (`tests/web/shots/symbols-sheet.png` shows all.)

## 5. Fragments and questions

List ids if you play with `?debug=1` afterwards, or just quote a few words.

- Your own fragments: which of the questions I wrote for them are wrong, dull, or leading?
- Draft fragments (the longer ones with people in them): which read false, or give away what they are?
- Short fragments beside long ones in the final reading: does the mix work?

## 6. Sound

- Shore bed: too loud, too quiet, too busy, right?
- Echoes: which sounded wrong or silly? These are the ones most likely to need a real recording:
  birds, woodpecker, duck, chickens, turkeys, eagle, crow, raven, dog bark, dog growl, cat, wolf,
  farm animals, horses, frogs, peepers, tree frogs, and the human ones (laugh, murmur, hum).
- Any echo that explained too much?

## 7. The ending

- The reading: right pace? Did the soft type for open questions read as intended?
- Rating chart: did the empty axes make sense? Did you use a suggested pair?
- Symbol builder: enough control, too much, anything missing? Which drawings should be redone?
- Gallery: with one mark in it, does it promise anything?

## 8. Length

The GDD wants one to two hours. How long was this run, and did it feel short, long, or right?

## 9. Decisions to revisit

All in `js/config.js`: question costs, certainty range, fragments per run, hand size, thresholds.
Change any?
