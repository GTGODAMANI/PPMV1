# Property Management App - Quick Start Guide

This is a simple guide to help you get this app properly running on your computer.

---

## 🛑 Step 1: Install Required Software (Node.js)

You need **Node.js** to run this app. If you don't have it, the commands won't work.

1.  Download Node.js here: [https://nodejs.org/](https://nodejs.org/)
2.  Choose the **LTS Version** (Green button, Recommended for Most Users).
3.  Install it like a normal program.
4.  **Important**: After installing, **restart your computer** (or at least close and reopen all terminal windows).

---

## 🚀 Step 2: Open Terminal in This Folder

1.  Open the folder containing these files.
2.  **Right-click** anywhere in the empty space of the folder window.
3.  Look for an option like **"Open in Terminal"** or **"Open in Command Prompt"**.
    - *Mac Users*: You can also search for "Terminal", open it, type `cd ` (with a space), drag the folder onto the terminal window, and press Enter.

---

## 📦 Step 3: Install Dependencies (Do this once)

In the terminal window that opened, copy and paste this command and press **Enter**:

```bash
npm install
```

Wait until it finishes. You might see some warnings (yellow text), which is fine. As long as there are no red "Errors", you are good.

---

## ▶️ Step 4: Run the App

Whenever you want to use the app, run this command:

```bash
npm run dev
```

You will see a message saying something like:
`  ➜  Local:   http://localhost:5173/`

---

## 🌐 Step 5: Open in Browser

1.  Open your web browser (Chrome, Edge, Safari).
2.  Type this address into the top bar: **`http://localhost:5173`**
3.  Press Enter. The app should load!

---

## 🔑 Login Credentials

The app requires a login. Use these details:

- **Username**: `admin`
- **Password**: `admin123`

---

## 💡 First Time Setup (Add Demo Data)

To see the app in action immediately:

1.  Log in as `admin`.
2.  Click the **Gear Icon** (Admin Settings) in the bottom right (if on mobile view) or navigate to Admin.
3.  Click the button **"Generate Sample Portfolio"**.
4.  Go back to the **Dashboard** (Home icon).
5.  You will now see graphs, payments, and activity!
