# WBGT-MCP-Server Documentation Index

Welcome to the WBGT-MCP-Server project documentation. This index organizes all documentation by purpose and phase.

---

## 📋 Getting Started

- **[../README.md](../README.md)** - Project overview, setup, and development guide
- **[../plan.md](../plan.md)** - Updated 7-week refactoring roadmap with current progress
- **[../CLAUDE.md](../CLAUDE.md)** - Development configuration and Windows WSL setup

---

## 🏗️ Refactoring Progress & Architecture

### Master Progress Document
- **[REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md)** - **START HERE** - Current project status (75%+ complete)
  - ✅ Phase 1 completion: Foundation & structure
  - 🔧 Phase 2 progress (79% complete): Code duplication elimination
  - ✅ Phase 3 completion: Security enhancements (127 tests)
  - ✅ Phase 4 completion: Testing infrastructure (80%+ coverage)
  - ✅ Enhanced Solar Radiation: Complete 3-tier API system
  - Quality metrics and comprehensive test results

### Enhanced Solar Radiation System
- **Complete 3-Tier API Implementation**
  - Current Day: Satellite API (Himawari → Best model → Archive fallback)
  - Historical Days: Direct Archive API access
  - 28+ tests passing with 92.3% service coverage
  - Default enhanced solar radiation behavior

### Security & Testing Achievements
- **Phase 3 Security Enhancements (95% complete)**
  - 127 security tests passing
  - Input validation with Zod schemas
  - Security headers and error handling middleware
  - CORS middleware implementation

- **Phase 4 Testing Infrastructure (Complete)**
  - 75%+ overall test coverage achieved
  - 100% solar geometry branch coverage
  - Comprehensive integration and API tests

### Phase 2 Detailed Documentation (Archived)
- **[archive/PHASE2_SUMMARY.md](archive/PHASE2_SUMMARY.md)** - Phase 2 completion summary with metrics
  - 434 lines of code duplication eliminated (89% of target)
  - Solar zenith and Kong WBGT pipeline unification

- **[archive/PHASE2_PROGRESS.md](archive/PHASE2_PROGRESS.md)** - Detailed Phase 2 progress tracking
  - WeatherDataExtractor utility implementation
  - Historical fetching consolidation patterns

---

## 🌍 Timezone Handling

- **[TIMEZONE_HANDLING_SUMMARY.md](TIMEZONE_HANDLING_SUMMARY.md)** - **COMPREHENSIVE GUIDE**
  - Complete timezone architecture overview
  - UTC conversion logic with DST awareness
  - Sydney (UTC+10/+11 with DST) vs Tokyo (UTC+9 no DST) examples
  - Data flow through all 4 processing stages:
    1. API fetching and data normalization
    2. Solar zenith angle calculation
    3. WBGT formula calculations (Kong method)
    4. Output formatting and result assembly
  - Extension guide for adding new timezones/regions
  - BOM data special considerations and frequency handling
  - **1000+ lines with detailed examples**

---

## 🔬 Technical Details

### Data Processing
- **[RADIATION_FIELDS_STANDARDIZATION.md](RADIATION_FIELDS_STANDARDIZATION.md)** - Solar radiation field standardization
  - Unified field naming (`*_instant` fields)
  - Open-Meteo API field mapping
  - Consistency improvements

### API Endpoints
- **[HTTP_ENDPOINTS.md](HTTP_ENDPOINTS.md)** - HTTP API endpoint documentation
  - Available endpoints and request/response formats
  - Parameter specifications
  - Error handling

---

## 📦 Archived Documentation

Files documenting completed phases are archived for historical reference:

- **[archive/PHASE1_PROGRESS.md](archive/PHASE1_PROGRESS.md)** - Phase 1 completion details (Foundation & Structure)
  - Directory structure created
  - Extraction complete
  - Type safety improvements
  - Constants extracted

---

## 🎯 Quick Navigation by Task

### For New Developers
1. Start with [../README.md](../README.md) for project overview
2. Read [TIMEZONE_HANDLING_SUMMARY.md](TIMEZONE_HANDLING_SUMMARY.md) for timezone architecture
3. Review [REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md) for current state and roadmap

### For Code Reviews
1. Check [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md) for recent consolidations
2. Reference [TIMEZONE_HANDLING_SUMMARY.md](TIMEZONE_HANDLING_SUMMARY.md) for timezone-related code
3. See [RADIATION_FIELDS_STANDARDIZATION.md](RADIATION_FIELDS_STANDARDIZATION.md) for data field naming

### For Architecture Decisions
1. Review [../plan.md](../plan.md) for overall refactoring strategy
2. Check [REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md) for completed patterns
3. Reference [TIMEZONE_HANDLING_SUMMARY.md](TIMEZONE_HANDLING_SUMMARY.md) for extension patterns

### For API Integration
1. See [HTTP_ENDPOINTS.md](HTTP_ENDPOINTS.md) for endpoint specifications
2. Review [TIMEZONE_HANDLING_SUMMARY.md](TIMEZONE_HANDLING_SUMMARY.md) for timezone parameter handling

---

## 📊 Current Status

**Overall Progress:** 75%+ Complete
**Tests Passing:** 28+ ✅
**Regressions:** 0 ✅
**Test Coverage:** 75%+ overall, 92.3% services, 100% solar geometry branches

**Major Achievements:**
- ✅ Phase 1: Foundation & Structure - Complete modular architecture
- ✅ Phase 3: Security Enhancements - 95% complete (127 security tests)
- ✅ Phase 4: Testing Infrastructure - Complete with 80%+ coverage
- ✅ Enhanced Solar Radiation - Complete 3-tier API system
- 🔧 Phase 2: Code Duplication Elimination - 79% complete (434 lines eliminated)

**Current Capabilities:**
- Enhanced solar radiation with Himawari satellite data preference
- Comprehensive security middleware and input validation
- Timezone-aware calculations for Sydney and Tokyo
- High test coverage with zero regressions
- Production-ready error handling and logging

**Next Steps:**
- Complete Phase 2 code duplication elimination (21% remaining)
- Phase 5: Domain objects and code quality
- Phase 6: API evolution (versioning, OpenAPI spec)

---

## 📝 Last Updated

**Date:** 2025-10-27
**Status:** Documentation consolidated to reflect 75%+ project completion
**Major Updates:** Phase 3 & 4 completion, Enhanced Solar Radiation system, comprehensive testing

For questions or contributions, refer to the updated README.md or the current progress in REFACTORING_PROGRESS.md.
