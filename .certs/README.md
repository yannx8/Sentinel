Optional extra root certificates for Docker builds.

Machines behind TLS inspection (corporate proxy, antivirus HTTPS scanning)
can drop the inspecting root CA here as a `.pem` file. The build stages of
`Dockerfile.api` and `Dockerfile.web` trust it while downloading packages.
Runtime images never include it. `.pem` files here are gitignored.
