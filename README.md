# GOAT ARENA Backend Documentation

This guide provides detailed instructions for setting up, configuring, and managing the GOAT ARENA backend.

---

## 📦 Installation

1. **Clone the repository:**

   ```bash
   git clone [repo]
   cd path-to-cloned-repo
   ```

2. **Install dependencies:**
   ```bash
   npm i -f
   ```

---

## ⚙️ Setup

1. **Configure environment variables:**

   Copy the example `.env` file:

   ```bash
   cp .env.example .env
   ```

   Open the `.env` file with your favorite text editor and update the necessary configurations (e.g., database URL, API keys, etc.).

2. **Run database migrations:**

   To initialize or update the database schema, execute:

   ```bash
   ROLE=api node ace migration:run
   ```

---

## 🚀 Running the Server

### Start the Server Manually

To start the server manually (useful for development environments):

```bash
node ace serve
```

### Start the Server with PM2

For production environments, it is recommended to use **PM2** for process management:

```bash
pm2 start --name 'goat-arena' 'node ace serve'
```

---

## 🔄 Updating & Restarting

1. **Apply updates or patches:**

   After making changes to the codebase, restart the server:

   ```bash
   pm2 restart goat-arena
   ```

2. **Monitor the server (optional):**

   To view logs and monitor the server's performance:

   ```bash
   pm2 logs goat-arena
   pm2 list
   ```

---

## 📘 Additional Notes

- Ensure your `.env` file contains accurate configuration values for your database, API, and other environment-specific variables.
- Use `pm2 save` to persist the process list so that it restarts automatically after a server reboot:
  ```bash
  pm2 save
  ```

---

Enjoy managing your GOAT ARENA backend! 🐐🎮
