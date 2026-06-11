import {app} from './app'

// Read the listen port from the environment, defaulting to 3000.
const port = Number(process.env.PORT ?? 3000)

// Start the Bun HTTP server.
app.listen(port)

console.log(`doors server listening on http://localhost:${port}`)
