# Dwight
A Discord Bot that plays sounds. Fully controlled from within the Discord app.

## Adding Dwight to your server

Use [this link](https://discord.com/api/oauth2/authorize?client_id=609005073531404304&permissions=2184308816&scope=bot%20applications.commands) to add Dwight to your server. All checked permissions are required for Dwight to work.

## Requirements
* Node.js >16.6.0
* npm > 7.0.0
* libsodium-dev
* FFmpeg
* Git

## Running locally
1. Clone the repository
2. Install dependencies with `npm i`
3. Create a `.env` file based on `.sample` and fill in the evnironment variables
4. Build the application with `npm run build`
5. Start Dwight with `npm run start-local`
