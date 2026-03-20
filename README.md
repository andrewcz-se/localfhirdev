# Local FHIR & Interface Development Environment

This repository provides a complete local development environment for healthcare interoperability, featuring a **HAPI FHIR Server**, **Mirth Connect** for HL7v2 to FHIR transformation and a **Model Context Protocol (MCP)** server that provides a connection between AI agents and the Mirth Connect REST API. 

## Project Structure

- **`HAPI FHIR Server/`**: Contains the Docker configuration for a HAPI FHIR JPA server backed by PostgreSQL.
- **`Mirth/`**: 
    - **`yaml/`**: Docker configuration for Mirth Connect and its dedicated PostgreSQL database.
    - **`e4x/`**: JavaScript (E4X) mapping logic used within Mirth Connect to transform HL7v2 messages into FHIR resources.
    - **`mirth-mcp-server`**: A Model Context Protocol (MCP) server that provides a connection between AI agents and the Mirth Connect REST API.

## Components

### 1. HAPI FHIR Server
The HAPI FHIR server is the industry-standard open-source FHIR server for Java.
- **Version**: Latest HAPI FHIR
- **Database**: PostgreSQL 14
- **Endpoint**: `http://localhost:8080/fhir`

### 2. Mirth Connect
Mirth Connect is a powerful healthcare integration engine used to route and transform medical data.
- **Version**: 4.5.2
- **Database**: PostgreSQL 14
- **Admin Interface**: `https://localhost:8444` (External port 8444 -> Internal 8443)
- **HTTP Listener**: `http://localhost:8081`

### 3. Mirth MCP Server
A Model Context Protocol (MCP) server that provides a connection between AI agents and the Mirth Connect REST API. It enables autonomous management of the basic Mirth channel lifecycle using a set of MCP tools.

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Deployment

1. **Start the HAPI FHIR Server:**
   ```bash
   cd "HAPI FHIR Server"
   docker-compose up -d
   ```

2. **Start Mirth Connect:**
   ```bash
   cd ../Mirth/yaml
   docker-compose up -d
   ```

## HL7v2 to FHIR Mapping (Observation)

The `Mirth/e4x/mapper.js` is an example script Transformer script that handles the transformation of HL7v2 `ORU^R01` messages into FHIR `Observation` resources bundled in a `transaction`.

### Key Mapping Features:
- **Source**: Automatically generates a source URI from `MSH-3` and `MSH-4`.
- **Patient Mapping**: Extracts the Medical Record Number (MRN) from `PID-3`.
- **Category Mapping**: Converts `OBR-24` codes (e.g., `GENLAB`) to FHIR standard categories (`laboratory`).
- **Date Formatting**: Converts HL7 TS format to ISO 8601 for `effectiveDateTime`.
- **Observation Details**: 
    - Maps `OBX-3` (LOINC) to Observation codes.
    - Handles numerical values and units from `OBX-5` and `OBX-6`.
    - Parses reference ranges from `OBX-7`.
    - Translates interpretation codes (e.g., `H` -> `High`, `L` -> `Low`).

## Usage
Once both services are running, you can configure a Mirth Channel to:
1. Accept HL7v2 messages.
2. Execute the `mapper.js` logic in a JavaScript Transformer.
3. POST the resulting `fhirPayload` (FHIR Bundle) to the HAPI FHIR server at `http://hapi-fhir-server:8080/fhir`.
