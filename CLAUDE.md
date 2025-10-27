# Claude Configuration and Instructions

## Environment-Specific Configuration

### Windows WSL Audible Alerts

For Windows WSL environments where standard terminal bells fail to work properly, Claude should use PowerShell to generate system sounds for better audible alerts when:

- Tasks complete successfully
- Permission prompts require user attention
- Long-running operations finish
- Error conditions occur that need immediate attention

**Command to execute for audible alerts:**
```bash
powershell.exe -c "[System.Media.SystemSounds]::Question.Play()"
```

**Usage Examples:**
- When task completes: `echo "Task completed. Playing notification sound..." && powershell.exe -c "[System.Media.SystemSounds]::Question.Play()"`
- For permission prompts: Include the PowerShell command as part of the notification workflow
- For error conditions: Add the sound command to error handling procedures

**Alternative System Sounds:**
- `Question.Play()` - Default question sound
- `Exclamation.Play()` - Alert/exclamation sound
- `Information.Play()` - Information notification sound
- `Hand.Play()` - Critical error/stop sound

### Development Environment Settings

Enhanced solar radiation notifications are configured via environment variable:
```bash
CLAUDE_PREFERRED_NOTIF_CHANNEL=terminal_bell
```

## Project-Specific Instructions

### Enhanced Solar Radiation System

This project implements a sophisticated 3-tier solar radiation system with intelligent data source selection:

#### Current Day Solar Radiation (3-Tier Approach)
1. **Tier 1**: satellite-api.open-meteo.com with Himawari models (`jma_jaxa_himawari`)
   - Highest accuracy satellite observations
   - Real-time Himawari satellite data
   - Validated for daytime radiation quality

2. **Tier 2**: satellite-api.open-meteo.com with best model (`best_match`)
   - Fallback when Himawari data unavailable
   - High-quality model predictions
   - Still uses satellite API infrastructure

3. **Tier 3**: archive-api.open-meteo.com (standard archive data)
   - Final fallback for current day
   - Historical archive API with proven reliability

#### Historical Day Solar Radiation
- **Direct Access**: archive-api.open-meteo.com (maximum accuracy for historical dates)
- No tiered approach needed for historical data

### Key Implementation Features
- **Default Behavior**: Enhanced solar radiation enabled by default
- **Data Validation**: Quality checks for valid daytime radiation data
- **Graceful Fallbacks**: Automatic progression through tiers when data invalid
- **Smart API Selection**: Different endpoints and parameters per tier
- **URL Encoding**: Proper handling of API parameters (e.g., comma encoding in model lists)

### Timezone-Aware Architecture
- **Sydney Support**: UTC+10/UTC+11 with full DST awareness
- **Tokyo Support**: UTC+9 with no DST complications
- **Solar Geometry**: 100% branch coverage including leap year edge cases
- **UTC Conversion**: Critical for accurate solar calculations

### Security & Testing Infrastructure
- **Comprehensive Security**: 127 security tests with input validation
- **Error Handling**: Sanitized client responses with server-side logging
- **High Coverage**: 75%+ overall, 92.3% services, 100% solar geometry branches
- **Zero Regressions**: All 28+ tests passing consistently

## Testing & Development

### Test Commands
```bash
# Run all tests with coverage
npm test

# Generate coverage report
npm test -- --coverage

# Run specific test suites
npm test -- src/calculations/solar/__tests__
npm test -- src/services/weather/__tests__
npm test -- src/api/http/middleware/__tests__
```

### Test Coverage Achievements
- **Solar Geometry**: 100% branch coverage (30 tests)
- **Weather Services**: 92.3% coverage (28 tests)
- **Security Middleware**: 95%+ coverage (127 tests)
- **Overall Project**: 75%+ coverage exceeding targets

### Development Workflow
- Tests validate tiered API behavior with URL encoding scenarios
- Error handling tests ensure graceful degradation
- Security tests cover all input validation scenarios
- Integration tests verify end-to-end functionality

## API Configuration Notes

### Solar Radiation API Endpoints
- **Satellite API**: `https://satellite-api.open-meteo.com/v1/archive`
- **Archive API**: `https://archive-api.open-meteo.com/v1/archive`
- **Model Parameters**: Properly encoded for HTTP requests
- **Data Fields**: Standardized on `*_instant` radiation fields

### Key Files for Implementation
- `src/services/weather/solar-radiation.service.ts` - Tiered API logic
- `src/services/weather/weather-fetcher.service.ts` - Integration layer
- `src/calculations/solar/solar-geometry.ts` - Timezone-aware calculations
- `src/api/http/middleware/` - Security and validation middleware

## Architecture Highlights

- **Modular Design**: Clear separation of concerns across domains
- **Type Safety**: Comprehensive TypeScript interfaces and validation
- **Test-Driven**: Extensive test coverage driving development decisions
- **Production Ready**: Security headers, error handling, and logging implemented