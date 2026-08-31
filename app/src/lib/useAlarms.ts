import { useEffect, useRef } from 'react';
import { getState } from './store';
import { addDaysStr, pad2, todayStr } from './date';

/**
 * Fires each enabled alarm at most once per day, checked on the minute.
 * The plan-tomorrow alarm stays quiet if tomorrow already has blocks — a
 * reminder to do something already done just trains you to ignore it.
 */
export function useAlarms() {
  const firedOn = useRef<Record<string, string>>({});

  useEffect(() => {
    const tick = () => {
      const s = getState();
      const alarms = s.settings.alarms ?? [];
      const anyBlockReminder = s.blocks.some((b) => b.reminder);
      if (!alarms.some((a) => a.enabled) && !anyBlockReminder) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const now = new Date();
      const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const today = todayStr();

      alarms.forEach((alarm) => {
        if (!alarm.enabled || alarm.time !== hhmm) return;
        if (firedOn.current[alarm.id] === today) return;
        if (alarm.checkPlanning && s.blocks.some((b) => b.date === addDaysStr(today, 1))) return;
        firedOn.current[alarm.id] = today;
        new Notification(alarm.label, alarm.checkPlanning
          ? { body: "You haven't built tomorrow's timetable yet." }
          : undefined);
      });

      // Per-block reminders, at the time the block is due to start. Only
      // today's blocks: a reminder for a day already gone has nothing to say.
      s.blocks.forEach((b) => {
        if (!b.reminder || b.date !== today || b.start !== hhmm) return;
        if (firedOn.current[b.id] === today) return;
        firedOn.current[b.id] = today;
        const linked = b.taskIds.length;
        new Notification(b.title, {
          body: `Starts now, until ${b.end}${linked ? ` · ${linked} task${linked === 1 ? '' : 's'}` : ''}`,
        });
      });
    };

    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, []);
}
