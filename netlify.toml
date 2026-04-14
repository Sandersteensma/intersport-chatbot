[build]
  publish = "public"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/widget/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Cache-Control = "public, max-age=300"

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization"

[dev]
  port = 8888
