# Discord services

The web app now exposes queues for the two integrations:

- `POST /api/cinema/sessions` creates a cinema request for a separate cinema bot.
- `POST /api/control/downloads` creates a download request for a separate, authorized media worker.

Connect Discord bots through a private worker using `INTERNAL_API_URL` and `BOT_SHARED_SECRET`. The cinema bot must be granted access to the selected Discord voice channel and screen-share permission. The media worker must only process public content you have permission to download and must respect each platform's terms; do not bypass DRM, privacy controls, login walls, or rate limits.

A real Discord integration also needs OAuth2/Discord identity linking and a persistent PostgreSQL/Redis setup before production launch.
