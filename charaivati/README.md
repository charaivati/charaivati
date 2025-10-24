This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

 🌿 Charaivati

> _"Reviving roots through innovation and community."_

Charaivati is a platform developed using **Next.js + React**, focused on showcasing and managing initiatives related to sustainable development, technology integration, and rural innovation.  
It’s built to grow into a hub connecting projects, people, and purpose — starting from Assam, India.

---

## 🚀 Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/)
- **Frontend:** React + TypeScript
- **UI Components:** Tailwind CSS / ShadCN (if used)
- **Database:** Prisma + SQLite / PostgreSQL
- **API Layer:** Next.js Route Handlers (`/app/api`)
- **Hosting:** [Vercel](https://vercel.com/)
- **Version Control:** Git + GitHub

---

## 📁 Folder Structure (simplified)
charaivati/
├── app/ # Next.js app directory
│ ├── (with-nav)/ # Layouts with navigation
│ ├── api/ # API route handlers
│ ├── self/ # Personal tab and subpages
│ └── page.tsx # Root homepage
├── components/ # Shared React components
├── prisma/ # Prisma schema + migrations
├── public/ # Static assets (images, textures)
├── styles/ # Global CSS
├── package.json
├── .env.local # Environment variables (not tracked)
└── README.md

## 🧠 Features

- 🔐 User-based sections (personalized views)
- 🌐 Modular page structure using Next.js App Router
- 🎨 Dynamic tab layouts and components
- 🪶 Type-safe API using Prisma ORM
- 🌱 Scalable foundation for NGO & social projects
- 🧾 Secure `.env` handling and Git versioning setup

---

## ⚙️ Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/charaivati/charaivati.git
cd charaivati

2. Install dependencies

npm install
or
yarn install

3. Set up environment variables

Create a .env.local file in the root directory:
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
JWT_SECRET="your_secret_here"

4. Run the project locally

npm run dev
Then visit → http://localhost:3000

🧩 Development Guidelines

Create a new branch for each feature:

git checkout -b feature/your-feature-name


Commit and push changes regularly.

Open a Pull Request for code review before merging to main.

📦 Deployment

The project is optimized for deployment on Vercel.

Connect your GitHub repository to Vercel.

Add environment variables under “Project Settings → Environment Variables”.

Every push to main auto-deploys to production.

Feature branches get their own preview deployments.

🧑‍💻 Contributors
Name	Role	Notes
Madhurjya Keot	Founder / Developer	Concept, design, and code

📜 License

This project is part of the Charaivati Initiative
© 2025 Charaivati Foundation. All rights reserved.

💬 Connect

🌐 Website
 (coming soon)

✉️ contact@charaivati.org

🏢 Based in Sivasagar, Assam, India