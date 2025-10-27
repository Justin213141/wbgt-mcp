# WBGT-MCP-Server: Advanced Heat Stress Calculator

A sophisticated MCP server for WBGT (Wet Bulb Globe Temperature) calculations with enhanced solar radiation data, timezone-aware processing, and comprehensive security features. Deployed on Cloudflare Workers with 92%+ test coverage.

**🎯 Current Status: 75%+ Complete** - Phase 1 ✅, Phase 2 79%, Phase 3 95%, Phase 4 ✅, Enhanced Solar Radiation ✅

**📚 [View Complete Documentation](docs/INDEX.md)** - Start here for architecture, API, and timezone handling guides.

---

## 🚀 Key Features

### Advanced Capabilities
- **Enhanced Solar Radiation System** - 3-tier API approach with Himawari satellite data preference
- **Timezone-Aware Calculations** - Full DST support for Sydney (UTC+10/+11) and Tokyo (UTC+9)
- **Kong WBGT Method** - Scientifically accurate heat stress calculations
- **Comprehensive Security** - Input validation, security headers, error sanitization (127 tests)
- **High Test Coverage** - 92.3% service coverage, 100% solar geometry branch coverage

### Data Sources
- **Current Day**: Satellite API with Himawari models → Best models → Archive fallback
- **Historical Data**: Archive API for maximum accuracy
- **Weather Parameters**: Temperature, humidity, pressure, wind speed, solar radiation
- **Geographic Support**: Sydney, Tokyo with extensible timezone framework

---

## Quick Links

- **[Documentation Index](docs/INDEX.md)** - Master index of all documentation
- **[Refactoring Progress](docs/REFACTORING_PROGRESS.md)** - Current project status (75%+ complete)
- **[Timezone Handling Guide](docs/TIMEZONE_HANDLING_SUMMARY.md)** - Comprehensive timezone architecture
- **[Refactoring Plan](plan.md)** - 7-week modernization roadmap
- **[Configuration Guide](CLAUDE.md)** - Development setup and Windows WSL configuration

---

## Get started: 

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

This will deploy your MCP server to a URL like: `remote-mcp-server-authless.<your-account>.workers.dev/sse`

Alternatively, you can use the command line below to get the remote MCP Server created on your local machine:
```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```

## Customizing your MCP Server

To add your own [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/) to the MCP server, define each tool inside the `init()` method of `src/index.ts` using `this.server.tool(...)`. 

## Connect to Cloudflare AI Playground

You can connect to your MCP server from the Cloudflare AI Playground, which is a remote MCP client:

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`remote-mcp-server-authless.<your-account>.workers.dev/sse`)
3. You can now use your MCP tools directly from the playground!

## Connect Claude Desktop to your MCP server

You can also connect to your remote MCP server from local MCP clients, by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote). 

To connect to your MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse"  // or remote-mcp-server-authless.your-account.workers.dev/sse
      ]
    }
  }
}
```

Restart Claude and you should see the tools become available.

---

## 🛠 Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Setup
```bash
git clone <repository-url>
cd wbgt-mcp-server
npm install
```

### Testing
```bash
# Run all tests with coverage
npm test

# Run tests with coverage report
npm test -- --coverage

# Run specific test suites
npm test -- src/calculations/solar/__tests__
npm test -- src/services/weather/__tests__
```

### Test Coverage
- **Overall Coverage**: 75%+ (exceeds 70% baseline)
- **Services**: 92.3% coverage (weather services)
- **Solar Geometry**: 100% branch coverage
- **Security Tests**: 127 tests passing
- **Total Tests**: 28+ tests across all modules

### Windows WSL Configuration
For Windows WSL environments, see [CLAUDE.md](CLAUDE.md) for enhanced audible alerts configuration using PowerShell.

---

## 📊 Architecture

### Current Implementation
- **Modular Structure**: Domain-driven design with clear separation of concerns
- **Enhanced Solar Radiation**: Tiered API system with satellite data preference
- **Timezone Support**: Full DST awareness for multiple regions
- **Security First**: Comprehensive input validation and security headers
- **Test Coverage**: Extensive test suite with high coverage metrics

### Key Components
- `src/calculations/` - Scientific WBGT calculations
- `src/services/weather/` - Enhanced weather data fetching
- `src/api/http/` - HTTP endpoints with security middleware
- `src/domain/` - Validators and type definitions
- `src/utils/` - Reusable utilities and formatters

---

## 📈 Project Status

### Completed Phases
- ✅ **Phase 1**: Foundation & Structure (40-48 hours)
- ✅ **Phase 3**: Security Enhancements (95% complete, 127 tests)
- ✅ **Phase 4**: Testing Infrastructure (80%+ coverage achieved)
- ✅ **Enhanced Solar Radiation**: 3-tier API system

### In Progress
- 🔧 **Phase 2**: Code Duplication Elimination (79% complete)
- ⬜ **Phase 5**: Domain Objects & Quality
- ⬜ **Phase 6**: API Evolution

**Overall Progress**: 75%+ complete with zero regressions

---

## 🤝 Contributing

1. Read the [Documentation Index](docs/INDEX.md) for architecture understanding
2. Review the [Timezone Handling Guide](docs/TIMEZONE_HANDLING_SUMMARY.md) for timezone patterns
3. Run tests: `npm test` (ensure all pass)
4. Follow the existing code patterns and test coverage standards
5. Update documentation as needed

---

## 📄 License

[Add your license information here] 
