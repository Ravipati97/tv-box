# Changelog

All notable changes to TV Box are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); dates are
`YYYY-MM-DD`.

## [Unreleased]

## [1.1.0] - 2026-08-22

### Added

- Followers/following, replacing the old flat member directory: a Follow
  button everywhere someone's profile shows up, follower/following counts
  and lists on every profile, and a "Follows you" badge.
- Activity now defaults to a Following feed (with a one-tap switch back to
  Everyone), and includes "X started following Y" alongside the usual
  rated/finished events.
- In-app notifications for new followers, with an unread count on a new
  bell icon in the top bar.

### Fixed

- FollowButton no longer gets stuck showing "Unfollow" styling after a tap
  on touch devices (was reacting to a synthetic hover event with no
  matching hover-out).
- Follower/following counts on your own profile now update immediately
  when you follow or unfollow someone from the followers/following list,
  instead of only after a reload.
- Failed follow/unfollow attempts on a profile page now show an error
  message instead of failing silently.
- The bell and bug-report dropdowns in the top bar now close when you
  navigate to a different page, instead of staying open over whatever
  loads next.
- Login no longer hard-crashes if the browser blocks local storage access
  (e.g. some private-browsing modes) -- it now just falls back to a
  logged-out state.

## [1.0.0] - 2026-08-22

First version-tracked release. TV Box has been in daily use by the group
since 2026-08-13 -- this snapshot is everything it does as of today.

### Added

- Simple email + username sign-in, with an optional shared passcode gate.
- Per-episode watch tracking, show and season ratings, and a Now Watching
  home page with per-season progress.
- Watchlist, custom shareable lists, and a yearly recap.
- Diary: a unified, chronological log of everything watched, rated, and
  rewatched.
- Rewatch logging as its own append-only event, separate from first-time
  watch progress.
- Activity feed of what the group's been finishing and rating, plus
  member directory and public profiles.
- Bulk "mark all/season watched" with a date picker, for backfilling shows
  watched before TV Box existed.
- An "Upcoming" section aggregating next air dates across everything
  currently being watched.
- One clear streaming answer per show (where to watch it), correctable by
  anyone in the group.
- Light and dark themes, following system preference by default.
- Installable as a home-screen app on iOS, with a custom app icon that
  adapts to light/dark mode.

### Fixed

Numerous rounds of hardening since launch: timezone-correct air dates and
date pickers, mobile layout/keyboard/scroll bugs, error handling and
optimistic-UI rollback, reduced-motion support, and accessibility
(focus/escape handling, touch targets).

[Unreleased]: https://github.com/thetvbox/thetvbox.github.io/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/thetvbox/thetvbox.github.io/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thetvbox/thetvbox.github.io/releases/tag/v1.0.0
