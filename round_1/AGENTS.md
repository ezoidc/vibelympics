# Project Dependencies

## Bun
This project uses [Bun](https://bun.sh/) as its runtime and package manager. Make sure you have Bun installed on your system. You can download it from the official website or follow the installation instructions in the Bun documentation.

Do not use node or npm for this project. Just bun.

```
# Install project dependencies
bun install

# Add a new dependency
bun add <package-name>

# Run scripts defined in package.json
bun run <script-name>
```

## Docker

There is a CLI to pin Docker images. Just run `docker-img-digest <image>` to get the pinned image with digest. For example:

```
$ docker-img-digest node:20-alpine
node:20-alpine@sha256:3f4e3c5b6e8...
```
