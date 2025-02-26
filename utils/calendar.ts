import { run } from '@jxa/run';
import { runAppleScript } from 'run-applescript';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  calendarName: string;
}

async function checkCalendarAccess(): Promise<boolean> {
  try {
    // Try to get the count of calendars as a simple test
    await runAppleScript(`
tell application "Calendar"
    count every calendar
end tell`);
    return true;
  } catch (error) {
    throw new Error(`Cannot access Calendar app. Please grant access in System Preferences > Security & Privacy > Privacy > Calendars.`);
  }
}

async function getAllEvents(): Promise<CalendarEvent[]> {
  try {
    if (!await checkCalendarAccess()) {
      return [];
    }

    const events: CalendarEvent[] = await run(() => {
      const Calendar = Application('Calendar');
      const allCalendars = Calendar.calendars();
      let allEvents: any[] = [];

      // Get events from all calendars
      for (const calendar of allCalendars) {
        try {
          const eventsInCalendar = calendar.events();
          allEvents = [...allEvents, ...eventsInCalendar];
        } catch (error) {
          // Skip calendars that can't be accessed
        }
      }

      return allEvents.map((event: any) => ({
        id: event.id(),
        title: event.summary(),
        description: event.description() || '',
        startDate: event.startDate().toString(),
        endDate: event.endDate().toString(),
        location: event.location() || '',
        calendarName: event.calendar().name()
      }));
    });

    return events;
  } catch (error) {
    throw new Error(`Error accessing calendar events: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function findEvents(searchText: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
  try {
    if (!await checkCalendarAccess()) {
      return [];
    }

    const events: CalendarEvent[] = await run((searchText: string, startDateStr?: string, endDateStr?: string) => {
      const Calendar = Application('Calendar');
      const allCalendars = Calendar.calendars();
      let matchingEvents: any[] = [];
      
      const startDateObj = startDateStr ? new Date(startDateStr) : null;
      const endDateObj = endDateStr ? new Date(endDateStr) : null;

      // Search in all calendars
      for (const calendar of allCalendars) {
        try {
          let eventsInCalendar;
          
          // If both dates are provided, filter by date range
          if (startDateObj && endDateObj) {
            eventsInCalendar = calendar.events.whose({
              startDate: { _greaterThanEquals: startDateObj },
              endDate: { _lessThanEquals: endDateObj }
            })();
          } else {
            eventsInCalendar = calendar.events();
          }
          
          // Filter by search text manually since we can't combine date and text criteria easily
          const filtered = eventsInCalendar.filter((event: any) => {
            const title = event.summary() || '';
            const desc = event.description() || '';
            const loc = event.location() || '';
            return title.includes(searchText) || 
                   desc.includes(searchText) || 
                   loc.includes(searchText);
          });
          
          matchingEvents = [...matchingEvents, ...filtered];
        } catch (error) {
          // Skip calendars that can't be accessed
        }
      }

      return matchingEvents.map((event: any) => ({
        id: event.id(),
        title: event.summary(),
        description: event.description() || '',
        startDate: event.startDate().toString(),
        endDate: event.endDate().toString(),
        location: event.location() || '',
        calendarName: event.calendar().name()
      }));
    }, searchText, startDate?.toISOString(), endDate?.toISOString());

    // If no events found with exact match, try a broader search
    if (events.length === 0 && !startDate && !endDate) {
      const allEvents = await getAllEvents();
      return allEvents.filter(event => 
        event.title.toLowerCase().includes(searchText.toLowerCase()) || 
        event.description.toLowerCase().includes(searchText.toLowerCase()) ||
        event.location.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return events;
  } catch (error) {
    throw new Error(`Error finding calendar events: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createEvent(
  title: string, 
  startDate: Date, 
  duration: number, // in minutes
  description: string = '', 
  location: string = ''
): Promise<CalendarEvent | null> {
  try {
    if (!await checkCalendarAccess()) {
      return null;
    }

    const endDate = new Date(startDate.getTime() + duration * 60000);

    const newEvent: CalendarEvent = await run(
      (title: string, startDateStr: string, endDateStr: string, description: string, location: string) => {
        const Calendar = Application('Calendar');
        const defaultCalendar = Calendar.defaultCalendar();
        
        // Create a new event
        const event = Calendar.Event({
          summary: title,
          description: description,
          location: location,
          startDate: new Date(startDateStr),
          endDate: new Date(endDateStr)
        });
        
        // Add to default calendar
        defaultCalendar.events.push(event);
        
        return {
          id: event.id(),
          title: event.summary(),
          description: event.description() || '',
          startDate: event.startDate().toString(),
          endDate: event.endDate().toString(),
          location: event.location() || '',
          calendarName: event.calendar().name()
        };
      }, 
      title, 
      startDate.toISOString(), 
      endDate.toISOString(), 
      description, 
      location
    );

    return newEvent;
  } catch (error) {
    throw new Error(`Error creating calendar event: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default { getAllEvents, findEvents, createEvent };