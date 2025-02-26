# Apple MCP tools

This is a collection of apple-native tools for the [MCP protocol](https://modelcontextprotocol.com/docs/mcp-protocol).

Here's a step-by-step video about how to set this up, with a demo. - https://x.com/DhravyaShah/status/1892694077679763671

## Features

- Send and retrieve messages from Apple Messages app
- Search and open notes in Apple Notes app
- Search and open contacts in Apple Contacts app
- Manage reminders in Apple Reminders app
- Manage calendar events in Apple Calendar app
- TODO: Search and open photos in Apple Photos app
- TODO: Search and open music in Apple Music app



### Installation

You just need bun, install with `brew install oven-sh/bun/bun`

Now, edit your `claude_desktop_config.json` with this:

```claude_desktop_config.json
{
  "mcpServers": {
    "apple-mcp": {
      "command": "bunx",
      "args": ["@dhravya/apple-mcp@latest"]
    }
  }
}
```

Now, ask Claude to use the `apple-mcp` tool.

```
Can you send a message to John Doe?
```

```
find all the notes related to AI and send it to my girlfriend
```

```
create a reminder to buy groceries tomorrow
```

```
list my calendar events for next week
```

## Local Development

```bash
git clone https://github.com/dhravya/apple-mcp.git
cd apple-mcp
bun install
bun run index.ts
```

enjoy!
