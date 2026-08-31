# Personal OS

A local-first personal tracker, installable to a phone home screen.
Live at **https://bhavd33p.github.io/LifeLine-OS/**

Workspaces (Timetable, Tasks, Health, CP/DSA, Skincare, Gym, Meals, Stats, plus
any you add), tasks with labels and P1–P4 priorities, a time-blocked timetable
whose blocks can run past midnight, and a rolling seven-day meal planner.
Everything is stored in the browser; optional Firebase sync keeps devices in step.

## Layout

- `app/` — the source: React + Vite + Tailwind v4 + shadcn/ui.
- repository root — the built output, which is what GitHub Pages serves.

## Working on it

```sh
cd app
npm install
npm run dev      # local dev server
npm run build    # type-check and build into app/dist
npm run deploy   # build, then copy the output to the repository root
```

After `npm run deploy`, commit the repository root and push to publish.

Sync setup is described in `FIREBASE_SETUP.md`.
