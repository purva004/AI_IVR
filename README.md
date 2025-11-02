## Quick start

Run everything in one line:

```bash
bash scripts/bootstrap.sh
```

The script will:

- verify you have Node.js 18+ and npm installed
- install all project dependencies
- create `.env.local` with the public development credentials, 
- launch the Next.js development server on <http://localhost:3000>

> Tip: make the script executable once (`chmod +x scripts/bootstrap.sh`) so you can rerun it with `./scripts/bootstrap.sh`.

### Configure secrets

The project calls Groq for text responses. Add your private key to `.env.local` (the bootstrap script creates the file if it does not exist):



Never commit this value—GitHub push protection will block pushes when it detects real keys. If you regenerate the key, update the environment file locally and restart the dev server.
