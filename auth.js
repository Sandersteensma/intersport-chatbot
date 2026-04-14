{
  "name": "intersport-chatbot",
  "version": "2.0.0",
  "description": "AI chatbot widget voor Intersport Roden - Magento 2 webshop (Claude + FAQ + tool use)",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "netlify dev",
    "build": "echo 'No build step required'",
    "db:init": "node db/init.js",
    "deploy": "netlify deploy --prod"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.1",
    "@netlify/functions": "^2.8.0",
    "pg": "^8.13.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "netlify-cli": "^17.37.0"
  }
}
