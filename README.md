# Chirpy

Chirpy is a REST API for a simple social media platform where users can create, view, and delete short messages called chirps.

## Features

- User registration and login
- Password hashing
- JWT-based authentication
- Refresh token and token revocation
- Create, list, and delete chirps
- Filter chirps by author
- Sort chirps by creation time
- User account updates
- Chirpy Red membership upgrades through webhooks
- PostgreSQL database integration

## Tech Stack

- TypeScript
- Node.js
- Express
- PostgreSQL
- Drizzle ORM
- JWT authentication

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL

### Installation

Clone the repository and install dependencies:

```bash
git clone YOUR_REPOSITORY_URL
cd web-server
npm install
```

Create a `.env` file in the project root and configure the required environment variables:

- `PORT`
- `PLATFORM`
- `JWT_SECRET`
- `DB_URL`
- `POLKA_KEY`

Use your own local values for these variables. Do not commit secrets or your `.env` file to GitHub.

### Run the Project

Start the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

## API

The API supports user authentication, chirp management, filtering, sorting, and webhook processing.

Chirps can be filtered by author using the `authorId` query parameter and sorted by creation time using the `sort` query parameter.

Example:

```text
GET /api/chirps?sort=desc
GET /api/chirps?authorId=USER_ID
GET /api/chirps?authorId=USER_ID&sort=desc
```

## Purpose

This project was built as part of the [Boot.dev](https://boot.dev) backend development curriculum to practice building REST APIs, working with databases, and implementing authentication.

