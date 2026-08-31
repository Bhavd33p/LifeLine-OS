Preview build of the React + shadcn/ui rewrite. Served from /preview/ so the
live vanilla app at the root is untouched. No service worker here on purpose,
so every reload fetches the current build.

NOTE: same origin as the live app, so it reads and writes the SAME browser
storage (personalOS.v1). Export a backup from Settings > Data before poking at it.
