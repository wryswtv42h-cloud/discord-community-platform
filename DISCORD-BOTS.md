# Single-repository deployment

The website and the four Discord bot clients are deployed from this repository and one Railway service.

```env
DISCORD_GUILD_ID=your_server_id
GROUPS_BOT_TOKEN=groups_bot_token
TICKETS_BOT_TOKEN=tickets_bot_token
APPLICATIONS_BOT_TOKEN=applications_bot_token
PRIVATE_MESSAGES_BOT_TOKEN=private_messages_bot_token
ADMIN_USERNAME=owner_username
ADMIN_PASSWORD=strong_owner_password
JWT_SECRET=long_random_secret
```

The four bots are separate Discord applications but are started by the same `npm start` process. No external bot repository or `DISCORD_API_URL` is required. Do not put tokens in GitHub.
