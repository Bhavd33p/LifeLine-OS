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
      if (!alarms.some((a) => a.enabled)) return;
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
    };

    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, []);
}
