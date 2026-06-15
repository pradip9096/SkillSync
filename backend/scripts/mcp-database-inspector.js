#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
const Expert = require('../src/models/Expert');
const Booking = require('../src/models/Booking');
const User = require('../src/models/User');

const server = new Server(
  {
    name: "skillsync-db-inspector",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "inspect_bookings",
        description: "Fetch recent bookings from the database.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max number of bookings to return", default: 10 },
            status: { type: "string", description: "Filter by status (e.g., 'confirmed', 'pending')" }
          }
        }
      },
      {
        name: "query_experts",
        description: "Search for experts in the database.",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Filter by category" }
          }
        }
      }
    ]
  };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "inspect_bookings": {
      const { limit = 10, status } = request.params.arguments || {};
      const query = status ? { status } : {};
      try {
        const bookings = await Booking.find(query).limit(limit).lean();
        return {
          content: [{ type: "text", text: JSON.stringify(bookings, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
    case "query_experts": {
      const { category } = request.params.arguments || {};
      const query = category ? { category: { $regex: category, $options: 'i' } } : {};
      try {
        const experts = await Expert.find(query).limit(10).lean();
        return {
          content: [{ type: "text", text: JSON.stringify(experts, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/expert-booking';
  await mongoose.connect(mongoUri);
  console.error("Connected to MongoDB for DB Inspection");

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SkillSync DB Inspector MCP Server running on stdio");
}

run().catch(console.error);
