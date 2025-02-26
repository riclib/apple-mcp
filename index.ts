#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import contacts from "./utils/contacts";
import notes from "./utils/notes";
import message from "./utils/message";
import reminders from "./utils/reminders";
import calendar from "./utils/calendar";

const CONTACTS_TOOL: Tool = {
  name: "contacts",
  description: "Search and retrieve contacts from Apple Contacts app",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name to search for (optional - if not provided, returns all contacts). Can be partial name to search."
      }
    }
  }
};

const NOTES_TOOL: Tool = {
  name: "notes", 
  description: "Search and retrieve notes from Apple Notes app",
  inputSchema: {
    type: "object",
    properties: {
      searchText: {
        type: "string",
        description: "Text to search for in notes (optional - if not provided, returns all notes)"
      }
    }
  }
};

const MESSAGES_TOOL: Tool = {
  name: "messages",
  description: "Interact with Apple Messages app - send, read, schedule messages and check unread messages",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform: 'send', 'read', 'schedule', or 'unread'",
        enum: ["send", "read", "schedule", "unread"]
      },
      phoneNumber: {
        type: "string",
        description: "Phone number to send message to (required for send, read, and schedule operations)"
      },
      message: {
        type: "string",
        description: "Message to send (required for send and schedule operations)"
      },
      limit: {
        type: "number",
        description: "Number of messages to read (optional, for read and unread operations)"
      },
      scheduledTime: {
        type: "string",
        description: "ISO string of when to send the message (required for schedule operation)"
      }
    },
    required: ["operation"]
  }
};

const REMINDERS_TOOL: Tool = {
  name: "reminders",
  description: "Interact with Apple Reminders app - get, find, create, and complete reminders",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform: 'list', 'find', 'create', or 'complete'",
        enum: ["list", "find", "create", "complete"]
      },
      searchText: {
        type: "string",
        description: "Text to search for in reminder titles and notes (required for find operation)"
      },
      title: {
        type: "string",
        description: "Title of the reminder (required for create operation)"
      },
      notes: {
        type: "string",
        description: "Notes/description for the reminder (optional for create operation)"
      },
      dueDate: {
        type: "string",
        description: "ISO string of when the reminder is due (optional for create operation)"
      },
      id: {
        type: "string",
        description: "ID of the reminder to complete (required for complete operation)"
      }
    },
    required: ["operation"]
  }
};

const CALENDAR_TOOL: Tool = {
  name: "calendar",
  description: "Interact with Apple Calendar app - get, find, and create calendar events",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform: 'list', 'find', or 'create'",
        enum: ["list", "find", "create"]
      },
      searchText: {
        type: "string",
        description: "Text to search for in event titles, descriptions, or locations (required for find operation)"
      },
      startDate: {
        type: "string",
        description: "ISO string of when to start searching for events, or event start time (for find or create operations)"
      },
      endDate: {
        type: "string",
        description: "ISO string of when to end searching for events (optional for find operation)"
      },
      title: {
        type: "string",
        description: "Title of the event (required for create operation)"
      },
      description: {
        type: "string",
        description: "Description of the event (optional for create operation)"
      },
      location: {
        type: "string",
        description: "Location of the event (optional for create operation)"
      },
      duration: {
        type: "number",
        description: "Duration of the event in minutes (required for create operation)"
      }
    },
    required: ["operation"]
  }
};

const server = new Server(
  {
    name: "Apple MCP tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function isContactsArgs(args: unknown): args is { name?: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    (!("name" in args) || typeof (args as { name: string }).name === "string")
  );
}

function isNotesArgs(args: unknown): args is { searchText?: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    (!("searchText" in args) || typeof (args as { searchText: string }).searchText === "string")
  );
}

function isMessagesArgs(args: unknown): args is {
  operation: "send" | "read" | "schedule" | "unread";
  phoneNumber?: string;
  message?: string;
  limit?: number;
  scheduledTime?: string;
} {
  if (typeof args !== "object" || args === null) return false;
  
  const { operation, phoneNumber, message, limit, scheduledTime } = args as any;
  
  if (!operation || !["send", "read", "schedule", "unread"].includes(operation)) {
    return false;
  }
  
  // Validate required fields based on operation
  switch (operation) {
    case "send":
    case "schedule":
      if (!phoneNumber || !message) return false;
      if (operation === "schedule" && !scheduledTime) return false;
      break;
    case "read":
      if (!phoneNumber) return false;
      break;
    case "unread":
      // No additional required fields
      break;
  }
  
  // Validate field types if present
  if (phoneNumber && typeof phoneNumber !== "string") return false;
  if (message && typeof message !== "string") return false;
  if (limit && typeof limit !== "number") return false;
  if (scheduledTime && typeof scheduledTime !== "string") return false;
  
  return true;
}

function isRemindersArgs(args: unknown): args is {
  operation: "list" | "find" | "create" | "complete";
  searchText?: string;
  title?: string;
  notes?: string;
  dueDate?: string;
  id?: string;
} {
  if (typeof args !== "object" || args === null) return false;
  
  const { operation, searchText, title, notes, dueDate, id } = args as any;
  
  if (!operation || !["list", "find", "create", "complete"].includes(operation)) {
    return false;
  }
  
  // Validate required fields based on operation
  switch (operation) {
    case "find":
      if (!searchText) return false;
      break;
    case "create":
      if (!title) return false;
      break;
    case "complete":
      if (!id) return false;
      break;
    case "list":
      // No additional required fields
      break;
  }
  
  // Validate field types if present
  if (searchText && typeof searchText !== "string") return false;
  if (title && typeof title !== "string") return false;
  if (notes && typeof notes !== "string") return false;
  if (dueDate && typeof dueDate !== "string") return false;
  if (id && typeof id !== "string") return false;
  
  return true;
}

function isCalendarArgs(args: unknown): args is {
  operation: "list" | "find" | "create";
  searchText?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  description?: string;
  location?: string;
  duration?: number;
} {
  if (typeof args !== "object" || args === null) return false;
  
  const { operation, searchText, startDate, endDate, title, description, location, duration } = args as any;
  
  if (!operation || !["list", "find", "create"].includes(operation)) {
    return false;
  }
  
  // Validate required fields based on operation
  switch (operation) {
    case "find":
      if (!searchText) return false;
      break;
    case "create":
      if (!title || !startDate || !duration) return false;
      break;
    case "list":
      // No additional required fields
      break;
  }
  
  // Validate field types if present
  if (searchText && typeof searchText !== "string") return false;
  if (startDate && typeof startDate !== "string") return false;
  if (endDate && typeof endDate !== "string") return false;
  if (title && typeof title !== "string") return false;
  if (description && typeof description !== "string") return false;
  if (location && typeof location !== "string") return false;
  if (duration && typeof duration !== "number") return false;
  
  return true;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, CALENDAR_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "contacts": {
        if (!isContactsArgs(args)) {
          throw new Error("Invalid arguments for contacts tool");
        }

        try {
          if (args.name) {
            const numbers = await contacts.findNumber(args.name);
            return {
              content: [{
                type: "text",
                text: numbers.length ? 
                  `${args.name}: ${numbers.join(", ")}` :
                  `No contact found for "${args.name}". Try a different name or use no name parameter to list all contacts.`
              }],
              isError: false
            };
          } else {
            const allNumbers = await contacts.getAllNumbers();
            const contactCount = Object.keys(allNumbers).length;
            
            if (contactCount === 0) {
              return {
                content: [{
                  type: "text",
                  text: "No contacts found in the address book. Please make sure you have granted access to Contacts."
                }],
                isError: false
              };
            }

            const formattedContacts = Object.entries(allNumbers)
              .filter(([_, phones]) => phones.length > 0)
              .map(([name, phones]) => `${name}: ${phones.join(", ")}`);

            return {
              content: [{
                type: "text",
                text: formattedContacts.length > 0 ?
                  `Found ${contactCount} contacts:\n\n${formattedContacts.join("\n")}` :
                  "Found contacts but none have phone numbers. Try searching by name to see more details."
              }],
              isError: false
            };
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error accessing contacts: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }

      case "notes": {
        if (!isNotesArgs(args)) {
          throw new Error("Invalid arguments for notes tool");
        }

        if (args.searchText) {
          const foundNotes = await notes.findNote(args.searchText);
          return {
            content: [{
              type: "text",
              text: foundNotes.length ?
                foundNotes.map(note => `${note.name}:\n${note.content}`).join("\n\n") :
                `No notes found for "${args.searchText}"`
            }],
            isError: false
          };
        } else {
          const allNotes = await notes.getAllNotes();
          return {
            content: [{
              type: "text",
              text: Object.entries(allNotes)
                .map(([name, content]) => `${name}:\n${content}`)
                .join("\n\n")
            }],
            isError: false
          };
        }
      }

      case "messages": {
        if (!isMessagesArgs(args)) {
          throw new Error("Invalid arguments for messages tool");
        }

        switch (args.operation) {
          case "send": {
            if (!args.phoneNumber || !args.message) {
              throw new Error("Phone number and message are required for send operation");
            }
            await message.sendMessage(args.phoneNumber, args.message);
            return {
              content: [{ type: "text", text: `Message sent to ${args.phoneNumber}` }],
              isError: false
            };
          }

          case "read": {
            if (!args.phoneNumber) {
              throw new Error("Phone number is required for read operation");
            }
            const messages = await message.readMessages(args.phoneNumber, args.limit);
            return {
              content: [{ 
                type: "text", 
                text: messages.length > 0 ? 
                  messages.map(msg => 
                    `[${new Date(msg.date).toLocaleString()}] ${msg.is_from_me ? 'Me' : msg.sender}: ${msg.content}`
                  ).join("\n") :
                  "No messages found"
              }],
              isError: false
            };
          }

          case "schedule": {
            if (!args.phoneNumber || !args.message || !args.scheduledTime) {
              throw new Error("Phone number, message, and scheduled time are required for schedule operation");
            }
            const scheduledMsg = await message.scheduleMessage(
              args.phoneNumber,
              args.message,
              new Date(args.scheduledTime)
            );
            return {
              content: [{ 
                type: "text", 
                text: `Message scheduled to be sent to ${args.phoneNumber} at ${scheduledMsg.scheduledTime}` 
              }],
              isError: false
            };
          }

          case "unread": {
            const messages = await message.getUnreadMessages(args.limit);
            
            // Look up contact names for all messages
            const messagesWithNames = await Promise.all(
              messages.map(async msg => {
                // Only look up names for messages not from me
                if (!msg.is_from_me) {
                  const contactName = await contacts.findContactByPhone(msg.sender);
                  return {
                    ...msg,
                    displayName: contactName || msg.sender // Use contact name if found, otherwise use phone/email
                  };
                }
                return {
                  ...msg,
                  displayName: 'Me'
                };
              })
            );

            return {
              content: [{ 
                type: "text", 
                text: messagesWithNames.length > 0 ? 
                  `Found ${messagesWithNames.length} unread message(s):\n` +
                  messagesWithNames.map(msg => 
                    `[${new Date(msg.date).toLocaleString()}] From ${msg.displayName}:\n${msg.content}`
                  ).join("\n\n") :
                  "No unread messages found"
              }],
              isError: false
            };
          }

          default:
            throw new Error(`Unknown operation: ${args.operation}`);
        }
      }

      case "reminders": {
        if (!isRemindersArgs(args)) {
          throw new Error("Invalid arguments for reminders tool");
        }

        switch (args.operation) {
          case "list": {
            const allReminders = await reminders.getAllReminders();
            return {
              content: [{ 
                type: "text", 
                text: allReminders.length > 0 ?
                  `Found ${allReminders.length} reminders:\n\n` +
                  allReminders.map(reminder => {
                    const status = reminder.isCompleted ? "[✓]" : "[ ]";
                    const dueInfo = reminder.dueDate ? `(Due: ${reminder.dueDate})` : "";
                    return `${status} [ID: ${reminder.id}] ${reminder.title} ${dueInfo}\n${reminder.notes ? `Notes: ${reminder.notes}\n` : ""}`;
                  }).join("\n\n") :
                  "No reminders found"
              }],
              isError: false
            };
          }

          case "find": {
            if (!args.searchText) {
              throw new Error("Search text is required for find operation");
            }
            const foundReminders = await reminders.findReminders(args.searchText);
            return {
              content: [{ 
                type: "text", 
                text: foundReminders.length > 0 ?
                  `Found ${foundReminders.length} matching reminders:\n\n` +
                  foundReminders.map(reminder => {
                    const status = reminder.isCompleted ? "[✓]" : "[ ]";
                    const dueInfo = reminder.dueDate ? `(Due: ${reminder.dueDate})` : "";
                    return `${status} [ID: ${reminder.id}] ${reminder.title} ${dueInfo}\n${reminder.notes ? `Notes: ${reminder.notes}\n` : ""}`;
                  }).join("\n\n") :
                  `No reminders found matching "${args.searchText}"`
              }],
              isError: false
            };
          }

          case "create": {
            if (!args.title) {
              throw new Error("Title is required for create operation");
            }
            const dueDate = args.dueDate ? new Date(args.dueDate) : undefined;
            const newReminder = await reminders.createReminder(args.title, args.notes || "", dueDate);
            
            if (!newReminder) {
              throw new Error("Failed to create reminder");
            }
            
            return {
              content: [{ 
                type: "text", 
                text: `Reminder created: "${newReminder.title}"${newReminder.dueDate ? ` (Due: ${newReminder.dueDate})` : ""}`
              }],
              isError: false
            };
          }

          case "complete": {
            if (!args.id) {
              throw new Error("Reminder ID is required for complete operation");
            }
            const success = await reminders.completeReminder(args.id);
            return {
              content: [{ 
                type: "text", 
                text: success ? 
                  `Reminder marked as completed` :
                  `Failed to complete reminder. ID ${args.id} not found.`
              }],
              isError: !success
            };
          }

          default:
            throw new Error(`Unknown operation: ${args.operation}`);
        }
      }

      case "calendar": {
        if (!isCalendarArgs(args)) {
          throw new Error("Invalid arguments for calendar tool");
        }

        switch (args.operation) {
          case "list": {
            const allEvents = await calendar.getAllEvents();
            return {
              content: [{ 
                type: "text", 
                text: allEvents.length > 0 ?
                  `Found ${allEvents.length} calendar events:\n\n` +
                  allEvents.map(event => {
                    const dateRange = `${new Date(event.startDate).toLocaleString()} - ${new Date(event.endDate).toLocaleString()}`;
                    const location = event.location ? `Location: ${event.location}\n` : "";
                    const desc = event.description ? `Description: ${event.description}\n` : "";
                    return `[${event.calendarName}] ${event.title}\n${dateRange}\n${location}${desc}`;
                  }).join("\n\n") :
                  "No calendar events found"
              }],
              isError: false
            };
          }

          case "find": {
            if (!args.searchText) {
              throw new Error("Search text is required for find operation");
            }
            
            // Parse dates if provided
            const startDate = args.startDate ? new Date(args.startDate) : undefined;
            const endDate = args.endDate ? new Date(args.endDate) : undefined;
            
            const foundEvents = await calendar.findEvents(args.searchText, startDate, endDate);
            return {
              content: [{ 
                type: "text", 
                text: foundEvents.length > 0 ?
                  `Found ${foundEvents.length} matching events:\n\n` +
                  foundEvents.map(event => {
                    const dateRange = `${new Date(event.startDate).toLocaleString()} - ${new Date(event.endDate).toLocaleString()}`;
                    const location = event.location ? `Location: ${event.location}\n` : "";
                    const desc = event.description ? `Description: ${event.description}\n` : "";
                    return `[${event.calendarName}] ${event.title}\n${dateRange}\n${location}${desc}`;
                  }).join("\n\n") :
                  `No calendar events found matching "${args.searchText}"`
              }],
              isError: false
            };
          }

          case "create": {
            if (!args.title || !args.startDate || !args.duration) {
              throw new Error("Title, start date, and duration are required for create operation");
            }
            
            const startDate = new Date(args.startDate);
            const newEvent = await calendar.createEvent(
              args.title,
              startDate,
              args.duration,
              args.description || "",
              args.location || ""
            );
            
            if (!newEvent) {
              throw new Error("Failed to create calendar event");
            }
            
            const dateRange = `${new Date(newEvent.startDate).toLocaleString()} - ${new Date(newEvent.endDate).toLocaleString()}`;
            return {
              content: [{ 
                type: "text", 
                text: `Calendar event created: "${newEvent.title}"\n${dateRange}${newEvent.location ? `\nLocation: ${newEvent.location}` : ""}`
              }],
              isError: false
            };
          }

          default:
            throw new Error(`Unknown operation: ${args.operation}`);
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Apple MCP Server running on stdio");