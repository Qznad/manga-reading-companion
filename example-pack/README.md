A music pack is a folder with one JSON file per MangaDex chapter (file names can be anything; subfolders are fine):

```json
{
  "chapterId": "<chapter-uuid>",
  "cues": [
    { "page": 1, "youtubeId": "xxxxxxxxxxx", "startAt": 0 },
    { "page": 5, "youtubeId": "yyyyyyyyyyy", "startAt": 42 }
  ]
}
```

A cue applies from its page until the next cue. `startAt` is in seconds.

`youtubeId` is the 11-character code after `watch?v=` in a YouTube link.
