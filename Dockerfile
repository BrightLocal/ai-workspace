FROM node:20-slim

ARG HOST_UID=1000
ARG HOST_GID=1000

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    jq \
    bash \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI + compose plugin (talks to the host daemon via the mounted socket)
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Server dependencies live outside the (bind-mounted) workspace
COPY agents/jira-to-pr/server/package.json agents/jira-to-pr/server/package-lock.json /opt/server-deps/
RUN cd /opt/server-deps && npm ci --omit=dev
ENV NODE_PATH=/opt/server-deps/node_modules

# Run as the host user so files written to the mounted checkouts stay owned by it.
# Home is the host home path so ~/.claude resolves at the same absolute path.
RUN (id -u node >/dev/null 2>&1 && userdel -r node || true) \
    && (getent group ${HOST_GID} || groupadd -g ${HOST_GID} agent) \
    && useradd -u ${HOST_UID} -g ${HOST_GID} -d /home/lenovo -M -s /bin/bash agent \
    && mkdir -p /home/lenovo && chown ${HOST_UID}:${HOST_GID} /home/lenovo
ENV HOME=/home/lenovo

COPY agents/jira-to-pr/scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint.sh
RUN chmod 0755 /usr/local/bin/container-entrypoint.sh

USER agent
WORKDIR /home/lenovo/brightLocal/ai-workspace

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/local/bin/container-entrypoint.sh"]
CMD ["node", "/home/lenovo/brightLocal/ai-workspace/agents/jira-to-pr/server/index.js"]
