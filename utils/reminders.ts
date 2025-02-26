import { run } from '@jxa/run';
import { runAppleScript } from 'run-applescript';

interface Reminder {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  isCompleted: boolean;
}

async function checkRemindersAccess(): Promise<boolean> {
  try {
    // Try to get the count of reminders as a simple test
    await runAppleScript(`
tell application "Reminders"
    count every reminder
end tell`);
    return true;
  } catch (error) {
    throw new Error(`Cannot access Reminders app. Please grant access in System Preferences > Security & Privacy > Privacy > Reminders.`);
  }
}

async function getAllReminders(): Promise<Reminder[]> {
  try {
    if (!await checkRemindersAccess()) {
      return [];
    }

    const reminders: Reminder[] = await run(() => {
      const Reminders = Application('Reminders');
      const allLists = Reminders.lists();
      let allReminders: any[] = [];

      // Get reminders from all lists
      for (const list of allLists) {
        const remindersInList = list.reminders();
        allReminders = [...allReminders, ...remindersInList];
      }

      return allReminders.map((reminder: any) => ({
        id: reminder.id(),
        title: reminder.name(),
        notes: reminder.body() || '',
        dueDate: reminder.dueDate() ? reminder.dueDate().toString() : null,
        isCompleted: reminder.completed()
      }));
    });

    return reminders;
  } catch (error) {
    throw new Error(`Error accessing reminders: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function findReminders(searchText: string): Promise<Reminder[]> {
  try {
    if (!await checkRemindersAccess()) {
      return [];
    }

    const reminders: Reminder[] = await run((searchText: string) => {
      const Reminders = Application('Reminders');
      const allLists = Reminders.lists();
      let matchingReminders: any[] = [];

      // Search in all lists
      for (const list of allLists) {
        const remindersInList = list.reminders.whose({
          _or: [
            { name: { _contains: searchText } },
            { body: { _contains: searchText } }
          ]
        })();
        
        matchingReminders = [...matchingReminders, ...remindersInList];
      }

      return matchingReminders.map((reminder: any) => ({
        id: reminder.id(),
        title: reminder.name(),
        notes: reminder.body() || '',
        dueDate: reminder.dueDate() ? reminder.dueDate().toString() : null,
        isCompleted: reminder.completed()
      }));
    }, searchText);

    // If no reminders found, try a broader search
    if (reminders.length === 0) {
      const allReminders = await getAllReminders();
      return allReminders.filter(reminder => 
        reminder.title.toLowerCase().includes(searchText.toLowerCase()) || 
        reminder.notes.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return reminders;
  } catch (error) {
    throw new Error(`Error finding reminders: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createReminder(title: string, notes: string = '', dueDate?: Date): Promise<Reminder | null> {
  try {
    if (!await checkRemindersAccess()) {
      return null;
    }

    const newReminder: Reminder = await run((title: string, notes: string, dueDate?: string) => {
      const Reminders = Application('Reminders');
      const defaultList = Reminders.defaultList();
      
      // Create a new reminder
      const reminder = Reminders.Reminder({
        name: title,
        body: notes
      });
      
      // Set due date if provided
      if (dueDate) {
        reminder.dueDate = new Date(dueDate);
      }
      
      // Add to default list
      defaultList.reminders.push(reminder);
      
      return {
        id: reminder.id(),
        title: reminder.name(),
        notes: reminder.body() || '',
        dueDate: reminder.dueDate() ? reminder.dueDate().toString() : null,
        isCompleted: reminder.completed()
      };
    }, title, notes, dueDate?.toISOString());

    return newReminder;
  } catch (error) {
    throw new Error(`Error creating reminder: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function completeReminder(id: string): Promise<boolean> {
  try {
    if (!await checkRemindersAccess()) {
      return false;
    }

    const success: boolean = await run((id: string) => {
      const Reminders = Application('Reminders');
      const allLists = Reminders.lists();
      
      // Find the reminder by ID
      let targetReminder = null;
      for (const list of allLists) {
        const remindersInList = list.reminders();
        for (const reminder of remindersInList) {
          if (reminder.id() === id) {
            targetReminder = reminder;
            break;
          }
        }
        if (targetReminder) break;
      }
      
      // Mark as completed if found
      if (targetReminder) {
        targetReminder.completed = true;
        return true;
      }
      
      return false;
    }, id);

    return success;
  } catch (error) {
    throw new Error(`Error completing reminder: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default { getAllReminders, findReminders, createReminder, completeReminder };